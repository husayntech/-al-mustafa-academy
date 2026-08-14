import express, { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { initDatabase, queryAll, queryOne, execute } from "./db.js";
import { RESULT_SHEET_DEFAULTS } from "./src/lib/resultSheetConfig.js";
import { cleanHtmlMarkup } from "./src/lib/cleanHtml.js";
import { fileURLToPath } from "url";
import os from "os";

dotenv.config();

// Safety nets: on Vercel's serverless runtime, an unhandled promise rejection
// or uncaught exception crashes the entire function process (FUNCTION_INVOCATION_FAILED).
// We log them instead so a transient cold-start DB hiccup can never take the
// whole API down. Individual routes still return proper 500 responses.
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason instanceof Error ? reason.message : reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err?.message || err);
});

// Resolve the project root safely. In serverless/CJS bundles (Vercel) the
// import.meta.url is unavailable, so fall back to the working directory.
const __dirname = (() => {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return process.cwd();
  }
})();

// Uploads directory — on serverless (Vercel) the filesystem is read-only except
// /tmp, so fall back to the OS temp dir when the project dir is not writable.
let UPLOADS_DIR = path.join(__dirname, "uploads");
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch {
  UPLOADS_DIR = path.join(os.tmpdir(), "almustafa-uploads");
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  } catch {}
}

// --- Persistent image storage (Supabase Storage) ---
// When SUPABASE_URL + a key are configured (e.g. on Vercel), admin uploads are
// stored in a PUBLIC Supabase Storage bucket so they survive cold starts and
// deployments. Without them (local dev) uploads keep using the local disk dir.
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "site-images";
const useSupabaseStorage = Boolean(
  process.env.SUPABASE_URL &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)
);

// Lazy-loaded Supabase client (dynamic import keeps the module out of the CJS
// serverless bundle until actually needed — same pattern as the Gemini client).
let storageClient: any = null;
async function getStorageClient() {
  if (!storageClient) {
    const { createClient } = await import("@supabase/supabase-js");
    storageClient = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );
  }
  return storageClient;
}

// Upload an image buffer to the public bucket (auto-creates it once).
async function storeImageInSupabase(buffer: Buffer, filename: string, contentType: string): Promise<string> {
  const client = await getStorageClient();
  const { data: buckets } = await client.storage.listBuckets();
  const bucket = buckets?.find((b: any) => b.name === SUPABASE_BUCKET);
  if (!bucket) {
    try {
      await client.storage.createBucket(SUPABASE_BUCKET, { public: true });
    } catch (createErr: any) {
      // A concurrent request may have created it first — only real failures propagate.
      if (!/already exists|exists/i.test(createErr?.message || "")) throw createErr;
    }
  } else if (bucket.public !== true) {
    // Make sure an existing bucket is public so the returned URL is actually servable.
    await client.storage.updateBucket(SUPABASE_BUCKET, { public: true });
  }
  const { error } = await client.storage.from(SUPABASE_BUCKET).upload(filename, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw error;
  const { data } = client.storage.from(SUPABASE_BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

// Multer storage configuration — in-memory when using Supabase Storage
// (so the buffer can be uploaded), disk otherwise.
const storage = useSupabaseStorage
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname) || ".png";
        cb(null, `logo_${Date.now()}${ext}`);
      },
    });
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    const allowed = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (PNG, JPG, GIF, WebP) are allowed"));
    }
  },
});

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "al-mustafa-academy-secret-key-2025";

// ---- Gmail SMTP (password reset emails) ----
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587");
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const MAIL_FROM = process.env.MAIL_FROM || (SMTP_USER ? `Al Mustafa Academy <${SMTP_USER}>` : "Al Mustafa Academy <noreply@almustafa.edu>");

function isEmailConfigured() {
  return Boolean(SMTP_USER && SMTP_PASS);
}

async function sendResetEmail(to: string, code: string, fullName: string) {
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  await transporter.sendMail({
    from: MAIL_FROM,
    to,
    subject: "Al Mustafa Academy — Password Reset Code",
    text: `Assalamu Alaikum ${fullName},\n\nYou requested a password reset for your staff portal account.\nYour verification code is:\n\n  ${code}\n\nThis code expires in 15 minutes. If you did not request this, you can safely ignore this email.\n\n— Al Mustafa Academy`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e0e0e0;border-radius:12px">
      <h2 style="color:#0B6E4F;margin:0 0 8px">Al Mustafa Academy</h2>
      <p style="color:#555;font-size:14px">Assalamu Alaikum <strong>${fullName}</strong>,</p>
      <p style="color:#555;font-size:14px">You requested a password reset. Use this code to set a new password:</p>
      <div style="text-align:center;margin:20px 0"><span style="display:inline-block;font-size:28px;font-weight:bold;letter-spacing:6px;color:#0B6E4F;background:#f0faf5;padding:12px 20px;border-radius:10px;border:1px solid #c8e6d5">${code}</span></div>
      <p style="color:#888;font-size:12px">This code expires in 15 minutes. If you did not request this, you can safely ignore this email.</p>
      <p style="color:#aaa;font-size:11px;margin-top:20px">— Al Mustafa Academy · For Qur'an Memorization & Islamic Studies</p>
    </div>`,
  });
}

app.use(express.json());

// Serve static files (uploads)
app.use("/uploads", express.static(UPLOADS_DIR));

// Initialize database on startup
let dbReady = false;
initDatabase()
  .then(() => {
    dbReady = true;
    console.log("Database initialized successfully");
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
  });

// Lazy-loaded Gemini AI client (dynamic import keeps the ESM-only package out
// of the CJS serverless bundle; returns null when no API key is configured)
let aiClient: any = null;
async function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn(
        "WARNING: GEMINI_API_KEY is not defined in the environment. Chatbot will run in mock mode."
      );
      return null;
    }
    const { GoogleGenAI } = await import("@google/genai");
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Custom interface to add user to Request
export interface AuthenticatedRequest extends Request {
  user?: any;
}

// System instructions containing complete Academy institutional details
const ACADEMY_SYSTEM_INSTRUCTION = `
You are Al Mustafa, a helpful, highly professional, and welcoming AI admissions and information assistant for Al Mustafa Academy ("Where the Qur'an and Sunnah Shape Character and Excellence"). 
Your goal is to answer questions from parents, students, and guests with absolute accuracy, warmth, and dignity.

Use the following official Academy information to answer questions:

- **Identity**: Established in 2013, Al Mustafa Academy delivers a world-class education bridging traditional Islamic values with modern academic excellence.
- **Sacred Mission**: To provide an environment fostering intellectual rigor, spiritual growth, and ethical leadership, preparing students to excel in a globalized world.
- **Educational Pillars**:
  1. Secular Academic Rigor: Follows Common Core & NGSS (Next Generation Science Standards) to ensure global competitiveness. Islamic Sciences-focused, inquiry-based (Singapore Math), robotics, coding, creative writing.
  2. Character (Tarbiyah): Cultivating character, focus on 'Adab' (conduct) and 'Akhlaq' (ethics/morals) in every interaction.
  3. Arabic Fluency: Immersive language learning techniques & classical literature to gain fluency in the language of the Noble Quran.
  4. Islamic Integrated Studies: Theology. Exploring seerah, history, fiqh, and ethical reasoning.

- **Admissions Process**:
  Stage 1: Inquiry - Submit online inquiry, download prospectus, schedule campus tour.
  Stage 2: Application - Fill online application & upload all documents.
  Stage 3: Assessment - Sit academic assessment & personal friendly interview with faculty.
  Stage 4: Admission - Receive official proposal, offer letter, and setup enrollment.

- **Required Documents for Admissions**:
  - Official Birth Certificate (original and copy)
  - Academic Records & Transcripts of the past 2 years
  - Character Reference letter from the previous school
  - Up-to-date Immunization & Medical Health records
  - 4 recent Passport-sized Photographs of the student

- **Tuition & Fees**:
  - Academic Application Fee: ₦1,000 (non-refundable)
  - Enrollment Fee: ₦7,000
  - Options for flexible payment plans and scholarship grants are available for outstanding candidates. Full schedules must be requested via the Admissions page.

- **Facilities**:
  - Central Prayer Hall: Spacious, vaulted structure, green carpet, bathed in beautiful natural light; a quiet sanctuary for daily prayers.
  - Innovation Labs: Cutting-edge Islamic Sciences laboratories equipped with advanced microscopy and workstations.
  - Athletic Grounds: FIFA-standard turf, soccer pitches, professional basketball courts.

- **Extracurricular Programs**:
  - Competitive Sports leagues (Football regular season, Varsity Basketball, Archery training, Martial Arts classes).
  - Student Clubs (Calligraphy & Fine Arts, Robotics & AI Society, Debate & Public Speaking).
  - Regular Competitions (Annual Holy Quran Recitation, Regional Science Olympiad, Math Challenge).

- **Daily Timetable (Madrasah Activities)**:
  - 09:00 AM: Morning Assembly (الاصطفاف الصباحي).
  - 09:00 – 09:30 AM: Kalimatu Sabahi (كلمة الصباح) — the morning word shared with all students.
  - 09:30 – 10:30 AM: Memorization & Muraaja'ah — Quranic memorization (Hifdh) and revision.
  - 10:30 – 11:30 AM: Normal classes.
  - 11:30 AM – 12:00 PM: Break time (30 minutes).
  - 12:00 – 1:30 PM: Classes continue.
  - 1:30 PM: Call for Salah (prayer). After the prayer and activities, a student may be invited to address his or her fellow students, or staff pass on information that is crucial to them.
  - 2:00 – 3:30 PM: Extra lessons and other activities for some students who stay behind.

Respond concisely, clearly, and respectably. In case a question is outside these domains, answer politely with what you know or direct them to write to almustafaacademyilorin@gmail.com or call +2348037525855. Use bullet points or lists for structured answers. Keep responses pleasant, polite, and encouraging!
`;

// Compose a display name from surname / first / middle name parts.
// Returns the composed name, or falls back to the existing full_name if provided.
function composeFullName(parts: { first_name?: string; middle_name?: string; surname?: string }, existingFullName?: string): string {
  const composed = [parts.first_name, parts.middle_name, parts.surname]
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean)
    .join(" ")
    .trim();
  return composed || (existingFullName && existingFullName.trim()) || "";
}

// Arabic → Latin transliteration map (used to build readable usernames from Arabic names)
const ARABIC_MAP: Record<string, string> = {
  "ا": "a", "أ": "a", "إ": "i", "آ": "a", "ء": "", "ب": "b", "ت": "t", "ث": "th", "ج": "j",
  "ح": "h", "خ": "kh", "د": "d", "ذ": "dh", "ر": "r", "ز": "z", "س": "s", "ش": "sh",
  "ص": "s", "ض": "d", "ط": "t", "ظ": "z", "ع": "a", "غ": "gh", "ف": "f", "ق": "q", "ك": "k",
  "ل": "l", "م": "m", "ن": "n", "ه": "h", "و": "u", "ي": "y", "ؤ": "w", "ئ": "y", "ة": "h", "ى": "a",
};

// Honorific titles stripped from names when generating usernames
const HONORIFIC_TITLES = ["الأستاذ", "الاستاذ", "الأستاذة", "الاستاذة", "الشيخ", "الدكتور", "الست", "الحاج", "ملا"];
const LATIN_TITLES = ["mr.", "mrs.", "ms.", "dr.", "ustaz", "ustadh", "mallam", "malam", "alhaji", "sheikh", "hajia", "sir"];

// Strip a leading honorific title (e.g. "الأستاذ") from a name
function stripTitles(value: string) {
  let v = (value || "").trim();
  for (const t of HONORIFIC_TITLES) {
    // Only strip when the title is followed by a space or is the whole word,
    // so "الأستاذة" is not partially matched by "الأستاذ"
    if (v.startsWith(t) && (v.length === t.length || v[t.length] === " ")) {
      v = v.slice(t.length).trim();
      break;
    }
  }
  const lower = v.toLowerCase();
  for (const t of LATIN_TITLES) {
    if (lower === t || lower.startsWith(t + " ")) {
      v = v.slice(t.length).trim();
      break;
    }
  }
  return v;
}

// Transliterate Arabic letters to Latin. ي/و become y/w at the start of a word
// (or after a vowel) and i/u after a consonant.
function transliterateArabic(value: string) {
  let out = "";
  for (const ch of value || "") {
    let latin = ARABIC_MAP[ch];
    if (ch === "و" || ch === "ي") {
      const prev = out[out.length - 1] || "";
      latin =
        ch === "و"
          ? out === "" || "aeiou".includes(prev)
            ? "w"
            : "u"
          : out === "" || "aeiou".includes(prev)
          ? "y"
          : "i";
    }
    out += latin !== undefined ? latin : ch;
  }
  return out;
}

// Slugify a name into a safe username fragment (transliterated, lowercase, alphanumeric only)
function slugify(value: string) {
  return transliterateArabic(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

// Patronymic prefixes — when a name starts with one of these, the whole name is
// used for the username instead of just the first word (e.g. "عبد الرفيع" → abdalrfia)
const PATRONYMIC_PREFIXES = ["عبد", "ابو", "أبو", "بنت", "أم", "ام", "ابن", "ابنة", "ذو", "ذي"];

// Build the username base from a staff's full name (titles stripped)
function usernameBaseFromName(fullName: string) {
  const clean = stripTitles(fullName || "");
  const words = clean.split(/\s+/).filter(Boolean);
  const firstWord = words[0] || "";
  if (!firstWord) return "";
  return slugify(PATRONYMIC_PREFIXES.includes(firstWord) ? clean : firstWord);
}

// Resolve a unique username for a staff member.
// - If requested is provided, use it (dedup with a numeric suffix if taken).
// - Otherwise auto-generate from the name: "الأستاذ إبراهيم" → "staff_ibrahim".
async function resolveStaffUsername(
  requested: string | undefined,
  fullName: string,
  used: Set<string>
) {
  let candidate = (requested || "").trim().toLowerCase();
  if (!candidate) {
    const base = usernameBaseFromName(fullName);
    candidate = base ? `staff_${base}` : "staff";
  }
  const baseCandidate = candidate;
  let i = 2;
  while (used.has(candidate) || (await queryOne("SELECT id FROM users WHERE username = $1", [candidate]))) {
    candidate = `${baseCandidate}${i}`;
    i++;
  }
  used.add(candidate);
  return candidate;
}

// --- Auth Middleware ---
function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
}

// --- Health Check ---
// Probes the database LIVE instead of trusting the startup flag. On serverless
// cold starts (and slow local pools) the startup flag can still be false long
// after the DB is actually queryable — and queries themselves have a 10s cap,
// so this probe fails fast if the DB is genuinely down.
app.get("/api/health", async (req: Request, res: Response) => {
  let liveDb = false;
  try {
    await queryAll("SELECT 1 AS ok");
    liveDb = true;
  } catch (err: any) {
    console.warn("Health probe failed:", err?.message || err);
  }
  res.json({
    status: "ok",
    time: new Date().toISOString(),
    dbReady: liveDb || dbReady,
    dbMode: process.env.DATABASE_URL ? "postgres" : "sqlite",
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
  });
});

// --- Auth Routes ---
app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const { username, password, remember } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const user = await queryOne("SELECT * FROM users WHERE username = $1", [username]);
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const valid = bcrypt.compareSync(password, user.password_hash as string);
    if (!valid) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, full_name: user.full_name, role: user.role, is_admin: user.is_admin || 0 },
      JWT_SECRET,
      { expiresIn: remember ? "30d" : "8h" }
    );

    // Log session start
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    await execute(
      "INSERT INTO sessions (user_id, login_time, session_date) VALUES ($1, $2, $3)",
      [user.id as number, now.toISOString(), dateStr]
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        surname: user.surname || null,
        first_name: user.first_name || null,
        middle_name: user.middle_name || null,
        role: user.role,
        is_admin: user.is_admin ? 1 : 0,
        phone: user.phone || null,
        email: user.email || null,
        address: user.address || null,
      },
    });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

app.post("/api/auth/logout", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Update the latest session for this user
    const latestSession = await queryOne(
      "SELECT id FROM sessions WHERE user_id = $1 AND logout_time IS NULL ORDER BY login_time DESC LIMIT 1",
      [req.user.id]
    );
    if (latestSession) {
      await execute("UPDATE sessions SET logout_time = $1 WHERE id = $2", [
        new Date().toISOString(),
        latestSession.id,
      ]);
    }
    res.json({ message: "Logged out successfully" });
  } catch (error: any) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
});

app.get("/api/auth/me", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await queryOne(
      "SELECT id, username, full_name, surname, first_name, middle_name, role, is_admin, phone, email, address FROM users WHERE id = $1",
      [req.user.id]
    );
    if (!user) return res.status(401).json({ error: "User not found" });
    res.json({ user });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// --- Staff count (any logged-in user — shown on the staff/teacher dashboard) ---
app.get("/api/staff/count", authMiddleware, async (req: Request, res: Response) => {
  try {
    const row = await queryOne("SELECT COUNT(*) as cnt FROM users");
    res.json({ count: Number(row?.cnt || 0) });
  } catch (error: any) {
    console.error("Staff count error:", error);
    res.status(500).json({ error: "Failed to fetch staff count" });
  }
});

// --- Password Reset (Gmail-linked) ---
app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
  try {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ error: "Username or email is required" });

    const user = await queryOne(
      "SELECT * FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)",
      [identifier.trim()]
    );
    if (!user) {
      // Never reveal whether an account exists
      return res.json({ message: "If that account exists, a reset code has been sent to its email." });
    }

    // Invalidate any previous unused codes for this user
    await execute("UPDATE password_resets SET used = 1 WHERE user_id = $1 AND used = 0", [user.id]);

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await execute(
      "INSERT INTO password_resets (user_id, code, expires_at) VALUES ($1, $2, $3)",
      [user.id, code, expiresAt]
    );

    const email = (user.email as string) || "";
    if (email && isEmailConfigured()) {
      try {
        await sendResetEmail(email, code, user.full_name as string);
      } catch (err: any) {
        console.error("Reset email send failed:", err?.message || err);
      }
    } else {
      // Dev fallback: log the code so the flow can be tested without SMTP
      console.log(`[password-reset] DEV MODE — code for ${user.username}: ${code}`);
    }

    res.json({
      message: "If that account exists, a reset code has been sent to its email.",
      // Only expose the code in dev (no SMTP configured + not production) so the flow is testable
      devCode: !isEmailConfigured() && process.env.NODE_ENV !== "production" ? code : undefined,
      hasEmail: Boolean(email),
      noEmail: !email,
    });
  } catch (error: any) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Failed to process request" });
  }
});

app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
  try {
    const { identifier, code, new_password } = req.body;
    if (!identifier || !code || !new_password) {
      return res.status(400).json({ error: "Username/email, code, and new password are required" });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    const user = await queryOne(
      "SELECT * FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)",
      [identifier.trim()]
    );
    if (!user) return res.status(400).json({ error: "Invalid request" });

    const reset = await queryOne(
      "SELECT * FROM password_resets WHERE user_id = $1 AND used = 0 AND expires_at > $2 ORDER BY id DESC LIMIT 1",
      [user.id, new Date().toISOString()]
    );
    if (!reset) return res.status(400).json({ error: "Invalid or expired reset code" });
    if ((reset.attempts || 0) >= 5) {
      return res.status(400).json({ error: "Too many attempts. Please request a new code." });
    }
    if (String(reset.code) !== String(code).trim()) {
      await execute("UPDATE password_resets SET attempts = attempts + 1 WHERE id = $1", [reset.id]);
      return res.status(400).json({ error: "Invalid or expired reset code" });
    }

    const passwordHash = bcrypt.hashSync(new_password, 10);
    await execute("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, user.id]);
    await execute("UPDATE password_resets SET used = 1 WHERE id = $1", [reset.id]);

    res.json({ message: "Password reset successfully. You can now sign in." });
  } catch (error: any) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// --- Class Access Control Helper ---
// Admins can access any class. Teachers can only access classes they are assigned to.
async function hasClassAccess(user: any, classId: number): Promise<boolean> {
  if (!user) return false;
  if (user.role === "admin" || user.is_admin) return true;
  if (user.role === "teacher") {
    const assignment = await queryOne(
      "SELECT id FROM teacher_classes WHERE teacher_id = $1 AND class_id = $2",
      [user.id, classId]
    );
    return !!assignment;
  }
  return false;
}

// --- Subject Routes ---
app.get("/api/classes/:classId/subjects", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const classId = parseInt(req.params.classId);
    if (!(await hasClassAccess(req.user, classId))) {
      return res.status(403).json({ error: "You are not assigned to this class" });
    }
    const subjects = await queryAll(
      "SELECT * FROM subjects WHERE class_id = $1 ORDER BY id ASC",
      [classId]
    );
    res.json({ subjects });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch subjects" });
  }
});

app.post("/api/classes/:classId/subjects", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const classId = parseInt(req.params.classId);
    if (!(await hasClassAccess(req.user, classId))) {
      return res.status(403).json({ error: "You are not assigned to this class" });
    }
    const { name, book_name, book_author } = req.body;
    if (!name) return res.status(400).json({ error: "Subject name is required" });

    const id = await execute(
      "INSERT INTO subjects (class_id, name, book_name, book_author) VALUES ($1, $2, $3, $4)",
      [classId, name, book_name || "", book_author || ""]
    );
    res.json({ id, message: "Subject added successfully" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to add subject" });
  }
});

app.put("/api/subjects/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const subject = await queryOne("SELECT class_id FROM subjects WHERE id = $1", [parseInt(req.params.id)]);
    if (!subject) return res.status(404).json({ error: "Subject not found" });
    if (!(await hasClassAccess(req.user, subject.class_id))) {
      return res.status(403).json({ error: "You are not assigned to this class" });
    }
    const { name, book_name, book_author } = req.body;
    await execute(
      "UPDATE subjects SET name = $1, book_name = $2, book_author = $3 WHERE id = $4",
      [name, book_name || "", book_author || "", parseInt(req.params.id)]
    );
    res.json({ message: "Subject updated successfully" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update subject" });
  }
});

app.delete("/api/subjects/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const subject = await queryOne("SELECT class_id FROM subjects WHERE id = $1", [parseInt(req.params.id)]);
    if (!subject) return res.status(404).json({ error: "Subject not found" });
    if (!(await hasClassAccess(req.user, subject.class_id))) {
      return res.status(403).json({ error: "You are not assigned to this class" });
    }
    await execute("DELETE FROM subjects WHERE id = $1", [parseInt(req.params.id)]);
    res.json({ message: "Subject deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete subject" });
  }
});

// Batch add subjects (admin only)
app.post("/api/subjects/batch", authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { class_id, subjects } = req.body;
    if (!class_id || !subjects || !Array.isArray(subjects) || subjects.length === 0) {
      return res.status(400).json({ error: "Class ID and subjects array are required" });
    }

    let addedCount = 0;
    for (const subj of subjects) {
      if (subj.name && subj.name.trim()) {
        await execute(
          "INSERT INTO subjects (class_id, name, book_name, book_author) VALUES ($1, $2, $3, $4)",
          [class_id, subj.name.trim(), subj.book_name || "", subj.book_author || ""]
        );
        addedCount++;
      }
    }

    res.json({ message: `${addedCount} subjects added successfully` });
  } catch (error: any) {
    console.error("Batch subject add error:", error);
    res.status(500).json({ error: "Failed to add subjects" });
  }
});

// Delete all subjects (admin only - global)
app.delete("/api/subjects/all", authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await execute("DELETE FROM results");
    await execute("DELETE FROM subjects");
    res.json({ message: "All subjects and their results deleted" });
  } catch (error: any) {
    console.error("Delete all subjects error:", error);
    res.status(500).json({ error: "Failed to delete subjects" });
  }
});

// Delete all subjects for a specific class (teacher or admin)
app.delete("/api/classes/:classId/subjects/all", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const classId = parseInt(req.params.classId);
    // If teacher without admin privileges, verify they are assigned to this class
    if (req.user?.role === "teacher" && !req.user?.is_admin) {
      const assignment = await queryOne(
        "SELECT id FROM teacher_classes WHERE teacher_id = $1 AND class_id = $2",
        [req.user.id, classId]
      );
      if (!assignment) {
        return res.status(403).json({ error: "You are not assigned to this class" });
      }
    }
    // Delete results for students in this class
    await execute(
      "DELETE FROM results WHERE student_id IN (SELECT id FROM students WHERE class_id = $1)",
      [classId]
    );
    // Delete subjects for this class
    await execute("DELETE FROM subjects WHERE class_id = $1", [classId]);
    res.json({ message: "All subjects and results for this class deleted" });
  } catch (error: any) {
    console.error("Delete class subjects error:", error);
    res.status(500).json({ error: "Failed to delete subjects" });
  }
});

// --- Student Routes ---
app.get("/api/classes/:classId/students", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const classId = parseInt(req.params.classId);
    if (!(await hasClassAccess(req.user, classId))) {
      return res.status(403).json({ error: "You are not assigned to this class" });
    }
    const students = await queryAll(
      `SELECT s.*, (SELECT COUNT(*) FROM results r WHERE r.student_id = s.id) as result_count FROM students s WHERE s.class_id = $1 ORDER BY s.full_name ASC`,
      [classId]
    );
    res.json({ students });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch students" });
  }
});

// Admin-only: create student with full details
app.post("/api/students", authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { class_id, full_name, surname, first_name, middle_name, gender, date_of_birth, address, parent_name, parent_phone, passport_photo, student_password } = req.body;
    const composedName = composeFullName({ first_name, middle_name, surname }, full_name);
    if (!composedName) return res.status(400).json({ error: "Student name is required" });

    const id = await execute(
      `INSERT INTO students (class_id, full_name, surname, first_name, middle_name, gender, date_of_birth, address, parent_name, parent_phone, passport_photo, student_password) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [class_id, composedName, surname?.trim() || null, first_name?.trim() || null, middle_name?.trim() || null, gender || null, date_of_birth || null, address || null, parent_name || null, parent_phone || null, passport_photo || null, student_password || 'student123']
    );
    res.json({ id, message: "Student added successfully" });
  } catch (error: any) {
    console.error("Add student error:", error);
    res.status(500).json({ error: "Failed to add student" });
  }
});

// Update student with full details (admin + teachers assigned to the class)
app.put("/api/students/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const studentId = parseInt(req.params.id);

    // If teacher (not admin), verify they are assigned to this student's class
    if (req.user?.role === "teacher" && !req.user?.is_admin) {
      const student = await queryOne("SELECT class_id FROM students WHERE id = $1", [studentId]);
      if (!student) return res.status(404).json({ error: "Student not found" });
      const assignment = await queryOne(
        "SELECT id FROM teacher_classes WHERE teacher_id = $1 AND class_id = $2",
        [req.user.id, student.class_id]
      );
      if (!assignment) {
        return res.status(403).json({ error: "You are not assigned to this student's class" });
      }
    }

    const { full_name, surname, first_name, middle_name, gender, date_of_birth, address, parent_name, parent_phone, passport_photo, student_password, class_id } = req.body;
    const composedName = composeFullName({ first_name, middle_name, surname }, full_name);
    await execute(
      `UPDATE students SET full_name = $1, surname = $2, first_name = $3, middle_name = $4, gender = $5, date_of_birth = $6, address = $7, parent_name = $8, parent_phone = $9, passport_photo = $10, student_password = $11, class_id = $12 WHERE id = $13`,
      [composedName, surname?.trim() || null, first_name?.trim() || null, middle_name?.trim() || null, gender || null, date_of_birth || null, address || null, parent_name || null, parent_phone || null, passport_photo || null, student_password || 'student123', class_id || undefined, studentId]
    );
    res.json({ message: "Student updated successfully" });
  } catch (error: any) {
    console.error("Update student error:", error);
    res.status(500).json({ error: "Failed to update student" });
  }
});

// Admin-only: delete student
app.delete("/api/students/:id", authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await execute("DELETE FROM students WHERE id = $1", [parseInt(req.params.id)]);
    res.json({ message: "Student deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete student" });
  }
});

// --- Result Routes ---
app.get("/api/students/:studentId/results", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const student = await queryOne("SELECT class_id FROM students WHERE id = $1", [parseInt(req.params.studentId)]);
    if (!student) return res.status(404).json({ error: "Student not found" });
    if (!(await hasClassAccess(req.user, student.class_id))) {
      return res.status(403).json({ error: "You are not assigned to this student's class" });
    }
    const results = await queryAll(
      `SELECT r.*, sub.name as subject_name, sub.book_name 
       FROM results r 
       JOIN subjects sub ON r.subject_id = sub.id 
       WHERE r.student_id = $1 
       ORDER BY r.term ASC, sub.name ASC`,
      [parseInt(req.params.studentId)]
    );
    res.json({ results });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch results" });
  }
});

app.post("/api/results", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { student_id, subject_id, term, year, test_score, exam_score, ca1_score, ca2_score, ca3_score, remarks } = req.body;

    // Teachers can only save results for students in their assigned classes
    const student = await queryOne("SELECT class_id FROM students WHERE id = $1", [student_id]);
    if (!student) return res.status(404).json({ error: "Student not found" });
    if (!(await hasClassAccess(req.user, student.class_id))) {
      return res.status(403).json({ error: "You are not assigned to this student's class" });
    }

    // Check if result already exists
    const existing = await queryOne(
      "SELECT id FROM results WHERE student_id = $1 AND subject_id = $2 AND term = $3 AND year = $4",
      [student_id, subject_id, term, year]
    );

    const ts = test_score !== undefined && test_score !== null && test_score !== '' ? parseFloat(test_score) : null;
    const es = exam_score !== undefined && exam_score !== null && exam_score !== '' ? parseFloat(exam_score) : null;
    const ca1 = ca1_score !== undefined && ca1_score !== null && ca1_score !== '' ? parseFloat(ca1_score) : null;
    const ca2 = ca2_score !== undefined && ca2_score !== null && ca2_score !== '' ? parseFloat(ca2_score) : null;
    const ca3 = ca3_score !== undefined && ca3_score !== null && ca3_score !== '' ? parseFloat(ca3_score) : null;

    if (existing) {
      await execute(
        "UPDATE results SET test_score = $1, exam_score = $2, ca1_score = $3, ca2_score = $4, ca3_score = $5, remarks = $6 WHERE id = $7",
        [ts, es, ca1, ca2, ca3, remarks || null, existing.id]
      );
      res.json({ id: existing.id, message: "Result updated successfully" });
    } else {
      const id = await execute(
        "INSERT INTO results (student_id, subject_id, term, year, test_score, exam_score, ca1_score, ca2_score, ca3_score, remarks) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
        [student_id, subject_id, term, year, ts, es, ca1, ca2, ca3, remarks || null]
      );
      res.json({ id, message: "Result saved successfully" });
    }
  } catch (error: any) {
    console.error("Result save error:", error);
    res.status(500).json({ error: "Failed to save result" });
  }
});

// Bulk save results
app.post("/api/results/bulk", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { results } = req.body;
    if (!Array.isArray(results)) {
      return res.status(400).json({ error: "Results array is required" });
    }

    // Teachers can only bulk-save results for students in their assigned classes
    if (req.user?.role === "teacher" && !req.user?.is_admin) {
      const studentIds = [...new Set(results.map((r: any) => r.student_id))];
      for (const sid of studentIds) {
        const st = await queryOne("SELECT class_id FROM students WHERE id = $1", [sid]);
        if (!st) return res.status(404).json({ error: "Student not found" });
        if (!(await hasClassAccess(req.user, st.class_id))) {
          return res.status(403).json({ error: "You are not assigned to this student's class" });
        }
      }
    }

    for (const r of results) {
      const { student_id, subject_id, term, year, test_score, exam_score, ca1_score, ca2_score, ca3_score, remarks } = r;
      const ts = test_score !== undefined && test_score !== null && test_score !== '' ? parseFloat(test_score) : null;
      const es = exam_score !== undefined && exam_score !== null && exam_score !== '' ? parseFloat(exam_score) : null;
      const ca1 = ca1_score !== undefined && ca1_score !== null && ca1_score !== '' ? parseFloat(ca1_score) : null;
      const ca2 = ca2_score !== undefined && ca2_score !== null && ca2_score !== '' ? parseFloat(ca2_score) : null;
      const ca3 = ca3_score !== undefined && ca3_score !== null && ca3_score !== '' ? parseFloat(ca3_score) : null;
      const existing = await queryOne(
        "SELECT id FROM results WHERE student_id = $1 AND subject_id = $2 AND term = $3 AND year = $4",
        [student_id, subject_id, term, year]
      );

      if (existing) {
        await execute(
          "UPDATE results SET test_score = $1, exam_score = $2, ca1_score = $3, ca2_score = $4, ca3_score = $5, remarks = $6 WHERE id = $7",
          [ts, es, ca1, ca2, ca3, remarks || null, existing.id]
        );
      } else {
        await execute(
          "INSERT INTO results (student_id, subject_id, term, year, test_score, exam_score, ca1_score, ca2_score, ca3_score, remarks) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
          [student_id, subject_id, term, year, ts, es, ca1, ca2, ca3, remarks || null]
        );
      }
    }

    res.json({ message: `${results.length} results saved successfully` });
  } catch (error: any) {
    console.error("Bulk result save error:", error);
    res.status(500).json({ error: "Failed to save results" });
  }
});

// --- Attendance Routes ---
app.get("/api/classes/:id/attendance", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const classId = parseInt(req.params.id);
    if (!(await hasClassAccess(req.user, classId))) {
      return res.status(403).json({ error: "You are not assigned to this class" });
    }
    const date = String(req.query.date || new Date().toISOString().split("T")[0]);
    const students = await queryAll(
      `SELECT id, full_name, surname, first_name, middle_name FROM students WHERE class_id = $1 ORDER BY full_name`,
      [classId]
    );
    const records = await queryAll(
      `SELECT student_id, status FROM attendance WHERE class_id = $1 AND session_date = $2`,
      [classId, date]
    );
    res.json({ date, students, records });
  } catch (error: any) {
    console.error("Attendance fetch error:", error);
    res.status(500).json({ error: "Failed to fetch attendance" });
  }
});

app.put("/api/classes/:id/attendance", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const classId = parseInt(req.params.id);
    if (!(await hasClassAccess(req.user, classId))) {
      return res.status(403).json({ error: "You are not assigned to this class" });
    }
    const { date, entries } = req.body;
    if (!date || !Array.isArray(entries)) {
      return res.status(400).json({ error: "date and entries are required" });
    }
    for (const entry of entries) {
      const status = ["present", "absent", "late"].includes(entry?.status) ? entry.status : "present";
      const sid = parseInt(entry?.studentId);
      if (!sid) continue;
      const existing = await queryOne(
        "SELECT id FROM attendance WHERE student_id = $1 AND session_date = $2",
        [sid, date]
      );
      if (existing) {
        await execute("UPDATE attendance SET status = $1 WHERE id = $2", [status, existing.id]);
      } else {
        await execute(
          "INSERT INTO attendance (class_id, student_id, session_date, status, marked_by) VALUES ($1, $2, $3, $4, $5)",
          [classId, sid, date, status, req.user?.id || null]
        );
      }
    }
    res.json({ message: `${entries.length} attendance records saved` });
  } catch (error: any) {
    console.error("Attendance save error:", error);
    res.status(500).json({ error: "Failed to save attendance" });
  }
});

app.get("/api/students/:id/attendance", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const studentId = parseInt(req.params.id);
    const student = await queryOne("SELECT class_id FROM students WHERE id = $1", [studentId]);
    if (!student) return res.status(404).json({ error: "Student not found" });
    const isSelf = req.user?.type === "student" && Number(req.user?.id) === studentId;
    if (!isSelf && !(await hasClassAccess(req.user, student.class_id))) {
      return res.status(403).json({ error: "Access denied" });
    }
    const summary = await queryAll(
      `SELECT status, COUNT(*)::int as count FROM attendance WHERE student_id = $1 GROUP BY status`,
      [studentId]
    );
    const records = await queryAll(
      `SELECT session_date, status FROM attendance WHERE student_id = $1 ORDER BY session_date DESC LIMIT 60`,
      [studentId]
    );
    res.json({ summary, records });
  } catch (error: any) {
    console.error("Student attendance error:", error);
    res.status(500).json({ error: "Failed to fetch attendance" });
  }
});

// --- Term Report Routes (Hifdh progress + behaviour remarks) ---
app.get("/api/students/:id/term-report", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const studentId = parseInt(req.params.id);
    const term = parseInt(String(req.query.term || "1"));
    const year = String(req.query.year || "");
    const student = await queryOne("SELECT class_id FROM students WHERE id = $1", [studentId]);
    if (!student) return res.status(404).json({ error: "Student not found" });
    const isSelf = req.user?.type === "student" && Number(req.user?.id) === studentId;
    if (!isSelf && !(await hasClassAccess(req.user, student.class_id))) {
      return res.status(403).json({ error: "Access denied" });
    }
    const report = await queryOne(
      `SELECT * FROM student_term_reports WHERE student_id = $1 AND term = $2 AND year = $3`,
      [studentId, term, year]
    );
    res.json({ report });
  } catch (error: any) {
    console.error("Term report fetch error:", error);
    res.status(500).json({ error: "Failed to fetch term report" });
  }
});

app.put("/api/students/:id/term-report", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const studentId = parseInt(req.params.id);
    const { term, year, hifdh_progress, behavior_remarks } = req.body;
    const student = await queryOne("SELECT class_id FROM students WHERE id = $1", [studentId]);
    if (!student) return res.status(404).json({ error: "Student not found" });
    if (!(await hasClassAccess(req.user, student.class_id))) {
      return res.status(403).json({ error: "You are not assigned to this student's class" });
    }
    const existing = await queryOne(
      "SELECT id FROM student_term_reports WHERE student_id = $1 AND term = $2 AND year = $3",
      [studentId, term, year]
    );
    if (existing) {
      await execute(
        "UPDATE student_term_reports SET hifdh_progress = $1, behavior_remarks = $2, updated_at = NOW() WHERE id = $3",
        [hifdh_progress || null, behavior_remarks || null, existing.id]
      );
    } else {
      await execute(
        "INSERT INTO student_term_reports (student_id, class_id, term, year, hifdh_progress, behavior_remarks) VALUES ($1, $2, $3, $4, $5, $6)",
        [studentId, student.class_id, term, year, hifdh_progress || null, behavior_remarks || null]
      );
    }
    res.json({ message: "Term report saved" });
  } catch (error: any) {
    console.error("Term report save error:", error);
    res.status(500).json({ error: "Failed to save term report" });
  }
});

// --- Teacher-Class Assignment Routes (admin only) ---
app.get("/api/admin/teacher-classes", authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const assignments = await queryAll(
      `SELECT tc.*, u.full_name as teacher_name, c.name as class_name, c.name_arabic as class_name_arabic
       FROM teacher_classes tc
       JOIN users u ON tc.teacher_id = u.id
       JOIN classes c ON tc.class_id = c.id
       ORDER BY u.full_name ASC, c.display_order ASC`
    );
    res.json({ assignments });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch teacher-class assignments" });
  }
});

app.post("/api/admin/teacher-classes", authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { teacher_id, class_id } = req.body;
    if (!teacher_id || !class_id) {
      return res.status(400).json({ error: "teacher_id and class_id are required" });
    }
    // Check if assignment already exists
    const existing = await queryOne(
      "SELECT id FROM teacher_classes WHERE teacher_id = $1 AND class_id = $2",
      [teacher_id, class_id]
    );
    if (existing) {
      return res.status(400).json({ error: "This teacher is already assigned to this class" });
    }
    const id = await execute(
      "INSERT INTO teacher_classes (teacher_id, class_id) VALUES ($1, $2)",
      [teacher_id, class_id]
    );
    res.json({ id, message: "Teacher assigned to class successfully" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to assign teacher to class" });
  }
});

app.delete("/api/admin/teacher-classes/:id", authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await execute("DELETE FROM teacher_classes WHERE id = $1", [parseInt(req.params.id)]);
    res.json({ message: "Assignment removed successfully" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to remove assignment" });
  }
});

// --- Class Routes ---
app.get("/api/classes", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    let classes;
    // If user is a teacher without admin privileges, only return assigned classes
    if (req.user?.role === "teacher" && !req.user?.is_admin) {
      classes = await queryAll(
        `SELECT c.* FROM classes c
         JOIN teacher_classes tc ON c.id = tc.class_id
         WHERE tc.teacher_id = $1
         ORDER BY c.display_order ASC`,
        [req.user.id]
      );
    } else {
      // Admin sees all classes
      classes = await queryAll("SELECT * FROM classes ORDER BY display_order ASC");
    }
    res.json({ classes });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch classes" });
  }
});

// --- Session Routes ---
app.get("/api/session/current", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = await queryOne(
      "SELECT * FROM sessions WHERE user_id = $1 AND logout_time IS NULL ORDER BY login_time DESC LIMIT 1",
      [req.user.id]
    );
    res.json({ session });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch session" });
  }
});

app.get("/api/sessions", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessions = await queryAll(
      `SELECT s.*, u.full_name 
       FROM sessions s 
       JOIN users u ON s.user_id = u.id 
       ORDER BY s.login_time DESC 
       LIMIT 50`
    );
    res.json({ sessions });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

// --- AI Chatbot endpoint ---
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res
        .status(400)
        .json({ error: "Invalid request. 'messages' array must be provided." });
    }

    const client = await getGeminiClient();

    // If API Key is missing or unavailable, fallback to helper simulation
    if (!client) {
      const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || "";
      let reply =
        "Thank you for reaching out to Al Mustafa Academy. ";

      if (
        lastMessage.includes("fee") ||
        lastMessage.includes("tuition") ||
        lastMessage.includes("cost") ||
        lastMessage.includes("pay")
      ) {
        reply +=
          "Our Academic Application Fee is ₦1,000 (non-refundable) and the Enrollment Fee is ₦7,000. We offer flexible payment plans and scholarships for exceptional candidates. You can view full options on our Admissions page!";
      } else if (
        lastMessage.includes("doc") ||
        lastMessage.includes("document") ||
        lastMessage.includes("require")
      ) {
        reply +=
          "To apply, you will need to submit: 1. Official Birth Certificate (original & copy), 2. Transcript records of the past 2 years, 3. School Character Reference, 4. Health & Immunization records, 5. 4 passport-size photographs of the student.";
      } else if (
        lastMessage.includes("admiss") ||
        lastMessage.includes("apply") ||
        lastMessage.includes("enroll")
      ) {
        reply +=
          "Our admissions process follows 4 simple stages: 1. Inquiry and campus tour, 2. Online application, 3. Assessment & interview, and 4. Official admission. You can submit our online inquiry form anytime!";
      } else if (
        lastMessage.includes("curriculum") ||
        lastMessage.includes("pillar") ||
        lastMessage.includes("stud") ||
        lastMessage.includes("learn")
      ) {
        reply +=
          "We nurture our students through four educational pillars: secular academic rigor (Common Core & NGSS), Character (Tarbiyah), Arabic Fluency, and Islamic Integrated Studies. Our day runs from a 09:00 AM morning assembly with Kalimatu Sabahi (كلمة الصباح), through memorization and Muraaja'ah, normal classes, and a 30-minute break, ending with the 1:30 PM call for Salah and extra lessons until 3:30 PM.";
      } else if (
        lastMessage.includes("facilit") ||
        lastMessage.includes("lab") ||
        lastMessage.includes("prayer") ||
        lastMessage.includes("sport")
      ) {
        reply +=
          "Our pupils explore world-class facilities: the Central Prayer Hall sanctuary, cutting-edge Islamic Sciences Innovation Labs, and gorgeous athletic grounds with FIFA-standard turf.";
      } else {
        reply +=
          "I'm the Academy assistant. I can answer inquiries regarding our admissions process, tuition structures, required documents, our daily Madrasah Activities schedule, and extracurricular clubs. How can I help you today?";
      }

      return res.json({ text: reply, isMock: true });
    }

    // Format conversational history for Gemini SDK
    const formattedContents = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: formattedContents,
      config: {
        systemInstruction: ACADEMY_SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
    });

    res.json({
      text:
        response.text ||
        "I apologize, I wasn't able to process that correctly. Please ask me again.",
    });
  } catch (error: any) {
    console.error("Gemini Chat API Error:", error);
    res
      .status(500)
      .json({ error: "Failed to connect to the assistant server.", details: error.message });
  }
});

// --- Admin Routes (admin only) ---
function adminMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin" && !req.user?.is_admin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

// List all users
app.get("/api/admin/users", authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await queryAll(
      "SELECT id, username, full_name, surname, first_name, middle_name, role, is_admin, phone, email, address FROM users ORDER BY id ASC"
    );
    res.json({ users });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Create new user (admin). Only a name is required — the username is auto-generated
// from the staff's name (e.g. staff_ibrahim) and the password defaults to "staff123".
app.post("/api/admin/users", authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username, password, full_name, surname, first_name, middle_name, role, is_admin, phone, email, address } = req.body;
    const composedName = composeFullName({ first_name, middle_name, surname }, full_name);
    if (!composedName) {
      return res.status(400).json({ error: "Staff name (surname / first name) is required" });
    }

    const finalUsername = await resolveStaffUsername(username, composedName, new Set<string>());
    const finalPassword = password || "staff123";

    const passwordHash = bcrypt.hashSync(finalPassword, 10);
    const id = await execute(
      "INSERT INTO users (username, password_hash, full_name, surname, first_name, middle_name, role, is_admin, phone, email, address) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
      [finalUsername, passwordHash, composedName, surname?.trim() || null, first_name?.trim() || null, middle_name?.trim() || null, role || "teacher", is_admin ? 1 : 0, phone || null, email || null, address || null]
    );
    res.json({ id, username: finalUsername, password: finalPassword, message: "User created successfully" });
  } catch (error: any) {
    console.error("Create user error:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// Batch add users (admin only)
app.post("/api/admin/users/batch", authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { users } = req.body;
    if (!users || !Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ error: "users array is required" });
    }

    let addedCount = 0;
    const errors: string[] = [];
    const usedUsernames = new Set<string>();

    for (const u of users) {
      try {
        const composedName = composeFullName({ first_name: u.first_name, middle_name: u.middle_name, surname: u.surname }, u.full_name);
        if (!composedName) {
          errors.push(`Skipped: missing name for "${u.surname || u.first_name || '?'}"`);
          continue;
        }

        const finalUsername = await resolveStaffUsername(u.username, composedName, usedUsernames);
        const finalPassword = u.password || "staff123";

        const passwordHash = bcrypt.hashSync(finalPassword, 10);
        await execute(
          "INSERT INTO users (username, password_hash, full_name, surname, first_name, middle_name, role, is_admin, phone, email, address) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
          [finalUsername, passwordHash, composedName, u.surname?.trim() || null, u.first_name?.trim() || null, u.middle_name?.trim() || null, u.role || "teacher", u.is_admin ? 1 : 0, u.phone || null, u.email || null, u.address || null]
        );
        addedCount++;
      } catch (err: any) {
        errors.push(`Failed: "${u.username || u.first_name || '?'}" — ${err.message}`);
      }
    }

    res.json({ addedCount, errors, message: `${addedCount} staff added successfully` + (errors.length ? ` (${errors.length} skipped)` : '') });
  } catch (error: any) {
    console.error("Batch user creation error:", error);
    res.status(500).json({ error: "Failed to batch create users" });
  }
});

// Update user
app.put("/api/admin/users/:id", authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { full_name, surname, first_name, middle_name, username, role, is_admin, phone, email, address, password } = req.body;
    const composedName = composeFullName({ first_name, middle_name, surname }, full_name);
    const userId = parseInt(req.params.id);
    if (password) {
      const passwordHash = bcrypt.hashSync(password, 10);
      await execute(
        "UPDATE users SET full_name = $1, surname = $2, first_name = $3, middle_name = $4, username = $5, role = $6, is_admin = $7, phone = $8, email = $9, address = $10, password_hash = $11 WHERE id = $12",
        [composedName, surname?.trim() || null, first_name?.trim() || null, middle_name?.trim() || null, username, role, is_admin ? 1 : 0, phone || null, email || null, address || null, passwordHash, userId]
      );
    } else {
      await execute(
        "UPDATE users SET full_name = $1, surname = $2, first_name = $3, middle_name = $4, username = $5, role = $6, is_admin = $7, phone = $8, email = $9, address = $10 WHERE id = $11",
        [composedName, surname?.trim() || null, first_name?.trim() || null, middle_name?.trim() || null, username, role, is_admin ? 1 : 0, phone || null, email || null, address || null, userId]
      );
    }
    res.json({ message: "User updated successfully" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update user" });
  }
});

// Delete user
app.delete("/api/admin/users/:id", authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    if (userId === req.user.id) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }
    await execute("DELETE FROM users WHERE id = $1", [userId]);
    res.json({ message: "User deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// --- Admin Class Editing ---
app.put("/api/admin/classes/:id", authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, name_arabic, display_order } = req.body;
    await execute(
      "UPDATE classes SET name = $1, name_arabic = $2, display_order = $3 WHERE id = $4",
      [name, name_arabic || null, display_order, parseInt(req.params.id)]
    );
    res.json({ message: "Class updated successfully" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update class" });
  }
});

// --- Admin Result Sheet Config ---
app.get("/api/admin/result-sheet-config", authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = await queryAll("SELECT config_key, config_value FROM result_sheet_config");
    const config: Record<string, string> = {};
    for (const r of rows) {
      config[r.config_key as string] = r.config_value as string;
    }
    res.json({ config });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch config" });
  }
});

app.put("/api/admin/result-sheet-config", authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { updates } = req.body;
    if (!updates || typeof updates !== "object") {
      return res.status(400).json({ error: "Updates object is required" });
    }
    for (const [key, value] of Object.entries(updates)) {
      const existing = await queryOne("SELECT id FROM result_sheet_config WHERE config_key = $1", [key]);
      if (existing) {
        await execute("UPDATE result_sheet_config SET config_value = $1 WHERE config_key = $2", [value as string, key]);
      } else {
        await execute("INSERT INTO result_sheet_config (config_key, config_value) VALUES ($1, $2)", [key, value as string]);
      }
    }
    res.json({ message: "Config updated successfully" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update config" });
  }
});

// Public result-sheet config read (used by the result sheet renderer on both portals)
app.get("/api/result-sheet-config", async (req: Request, res: Response) => {
  try {
    const rows = await queryAll("SELECT config_key, config_value FROM result_sheet_config");
    const config: Record<string, string> = { ...RESULT_SHEET_DEFAULTS };
    for (const r of rows) {
      config[r.config_key as string] = r.config_value as string;
    }
    res.json({ config });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch config" });
  }
});

// Seed sample students (admin only)
app.post("/api/seed/students", authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existingStudents = await queryAll("SELECT COUNT(*) as c FROM students");
    if (existingStudents[0]?.c > 0) {
      return res.status(400).json({ error: "Students already exist. Delete them first to re-seed." });
    }

    const sampleStudents: { name: string; classId: number }[] = [
      { name: "Ahmed Ali Hassan", classId: 1 },
      { name: "Fatima Omar Mahmoud", classId: 1 },
      { name: "Mohammed Ibrahim Khalil", classId: 1 },
      { name: "Aisha Yusuf Abdullah", classId: 1 },
      { name: "Omar Hassan Ahmed", classId: 1 },
      { name: "Khalid Mohammed Ali", classId: 2 },
      { name: "Mariam Ahmed Hassan", classId: 2 },
      { name: "Yusuf Ibrahim Nasser", classId: 2 },
      { name: "Layla Hassan Omar", classId: 2 },
      { name: "Hassan Ali Mahmoud", classId: 2 },
      { name: "Abdullah Khalid Omar", classId: 3 },
      { name: "Sara Mohammed Ali", classId: 3 },
      { name: "Ibrahim Ahmed Yusuf", classId: 3 },
      { name: "Noor Fatima Hassan", classId: 3 },
      { name: "Hussein Ali Ahmed", classId: 3 },
      { name: "Zainab Mohammed Khalid", classId: 4 },
      { name: "Hamza Omar Ibrahim", classId: 4 },
      { name: "Rania Hassan Ali", classId: 4 },
      { name: "Bilal Ahmed Nasser", classId: 4 },
      { name: "Huda Yusuf Mahmoud", classId: 4 },
      { name: "Mustafa Ali Hassan", classId: 5 },
      { name: "Amina Omar Khalid", classId: 5 },
      { name: "Yahya Ibrahim Ahmed", classId: 5 },
      { name: "Salma Hassan Mohammed", classId: 5 },
      { name: "Tariq Mahmoud Ali", classId: 5 },
      { name: "Nadia Ahmed Omar", classId: 6 },
      { name: "Rashid Khalid Hassan", classId: 6 },
      { name: "Samira Ibrahim Ali", classId: 6 },
      { name: "Jamal Yusuf Mohammed", classId: 6 },
      { name: "Karima Hassan Ahmed", classId: 6 },
    ];

    for (const s of sampleStudents) {
      await execute("INSERT INTO students (class_id, full_name) VALUES ($1, $2)", [s.classId, s.name]);
    }

    res.json({ message: `Seeded ${sampleStudents.length} students successfully` });
  } catch (error: any) {
    console.error("Seed error:", error);
    res.status(500).json({ error: "Failed to seed students" });
  }
});

// Delete all students (for re-seeding) (admin only)
app.delete("/api/students/all", authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await execute("DELETE FROM results");
    await execute("DELETE FROM students");
    res.json({ message: "All students deleted" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete students" });
  }
});

// Move student to another class
app.put("/api/students/:id/class", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { class_id } = req.body;
    if (!class_id) return res.status(400).json({ error: "Class ID is required" });
    const student = await queryOne("SELECT class_id FROM students WHERE id = $1", [parseInt(req.params.id)]);
    if (!student) return res.status(404).json({ error: "Student not found" });
    // Teacher must be assigned to both the student's current class and the target class
    if (!(await hasClassAccess(req.user, student.class_id))) {
      return res.status(403).json({ error: "You are not assigned to this student's class" });
    }
    if (!(await hasClassAccess(req.user, class_id))) {
      return res.status(403).json({ error: "You are not assigned to the target class" });
    }
    await execute("UPDATE students SET class_id = $1 WHERE id = $2", [class_id, parseInt(req.params.id)]);
    res.json({ message: "Student moved successfully" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to move student" });
  }
});

// Export class data as CSV
app.get("/api/classes/:classId/export/csv", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const classId = parseInt(req.params.classId);
    if (!(await hasClassAccess(req.user, classId))) {
      return res.status(403).json({ error: "You are not assigned to this class" });
    }
    const classInfo = await queryOne("SELECT name FROM classes WHERE id = $1", [classId]);
    const subjects = await queryAll("SELECT * FROM subjects WHERE class_id = $1 ORDER BY id", [classId]);
    const students = await queryAll("SELECT * FROM students WHERE class_id = $1 ORDER BY full_name ASC", [classId]);

    let csv = `Class,${classInfo?.name || "Unknown"}\n`;
    csv += `Total Students,${students.length}\n`;
    csv += `Subjects,"${subjects.map((s: any) => s.name).join(", ")}"\n\n`;

    csv += "Student Name";
    const termLabels = ["T1", "T2", "T3"];
    for (const subj of subjects) {
      for (const tl of termLabels) {
        csv += `,"${(subj as any).name} ${tl} (Test/30)","${(subj as any).name} ${tl} (Exam/70)","${(subj as any).name} ${tl} (Total/100)","${(subj as any).name} ${tl} (Remarks)"`;
      }
    }
    csv += "\n";

    const allTerms = [1, 2, 3];
    for (const student of students) {
      csv += `"${(student as any).full_name}"`;
      for (const subj of subjects) {
        for (const term of allTerms) {
          const result = await queryOne(
            "SELECT test_score, exam_score, total_score, remarks FROM results WHERE student_id = $1 AND subject_id = $2 AND term = $3",
            [(student as any).id, (subj as any).id, term]
          );
          csv += `,${result?.test_score ?? ""},${result?.exam_score ?? ""},${result?.total_score ?? ""},${result?.remarks ?? ""}`;
        }
      }
      csv += "\n";
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${classInfo?.name || "class"}_results.csv"`);
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to export data" });
  }
});

// Teacher login (last name + class name)
app.post("/api/auth/teacher-login", async (req: Request, res: Response) => {
  try {
    const { last_name, class_name } = req.body;
    if (!last_name) return res.status(400).json({ error: "Last name is required" });
    if (!class_name) return res.status(400).json({ error: "Class name is required" });

    // Find teacher by last name (match against full_name or username)
    let teacher = await queryOne(
      "SELECT * FROM users WHERE (LOWER(full_name) LIKE '%' || LOWER($1) || '%' OR LOWER(username) = LOWER($1)) AND role = 'teacher' LIMIT 1",
      [last_name.trim()]
    );

    if (!teacher) {
      // Also try matching by username directly
      teacher = await queryOne(
        "SELECT * FROM users WHERE LOWER(username) = LOWER($1) AND role = 'teacher' LIMIT 1",
        [last_name.trim()]
      );
    }

    if (!teacher) {
      return res.status(401).json({ error: "Teacher not found with this last name" });
    }

    // Find the class by name (English only as requested)
    const classRecord = await queryOne(
      "SELECT * FROM classes WHERE LOWER(name) LIKE '%' || LOWER($1) || '%' LIMIT 1",
      [class_name.trim()]
    );

    if (!classRecord) {
      return res.status(401).json({ error: "Class not found with this name" });
    }

    // Check if this teacher is assigned to this class
    const assignment = await queryOne(
      "SELECT id FROM teacher_classes WHERE teacher_id = $1 AND class_id = $2",
      [teacher.id, classRecord.id]
    );

    if (!assignment && teacher.role !== 'admin' && !teacher.is_admin) {
      return res.status(403).json({ error: "You are not assigned to this class. Please contact the admin." });
    }

    const token = jwt.sign(
      { id: teacher.id, username: teacher.username, full_name: teacher.full_name, role: teacher.role, is_admin: teacher.is_admin || 0 },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    // Log session start
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    await execute(
      "INSERT INTO sessions (user_id, login_time, session_date) VALUES ($1, $2, $3)",
      [teacher.id as number, now.toISOString(), dateStr]
    );

    res.json({
      token,
      user: {
        id: teacher.id,
        username: teacher.username,
        full_name: teacher.full_name,
        surname: teacher.surname || null,
        first_name: teacher.first_name || null,
        middle_name: teacher.middle_name || null,
        role: teacher.role,
        is_admin: teacher.is_admin ? 1 : 0,
        phone: teacher.phone || null,
        email: teacher.email || null,
        address: teacher.address || null,
      },
    });
  } catch (error: any) {
    console.error("Teacher login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// Student login (surname + password)
app.post("/api/auth/student-login", async (req: Request, res: Response) => {
  try {
    const { surname, password } = req.body;
    if (!surname) return res.status(400).json({ error: "Surname is required" });
    if (!password) return res.status(400).json({ error: "Password is required" });

    // Find student by surname (exact match on surname column, or fallback to last word in full_name)
    let student = await queryOne(
      "SELECT * FROM students WHERE LOWER(surname) = LOWER($1) LIMIT 1",
      [surname.trim()]
    );

    // Fallback: match last word of full_name
    if (!student) {
      student = await queryOne(
        "SELECT * FROM students WHERE LOWER(full_name) LIKE '%' || LOWER($1) || '%' ORDER BY full_name ASC LIMIT 1",
        [surname.trim()]
      );
    }

    if (!student) {
      return res.status(401).json({ error: "Student not found with this surname" });
    }

    // Check password: use the student_password field, fallback to default
    const storedPassword = (student as any).student_password || 'student123';
    if (password !== storedPassword) {
      return res.status(401).json({ error: "Invalid password" });
    }

    const token = jwt.sign(
      { id: student.id, type: "student", full_name: (student as any).full_name, class_id: (student as any).class_id },
      JWT_SECRET,
      { expiresIn: "4h" }
    );

    const classInfo = await queryOne("SELECT name FROM classes WHERE id = $1", [(student as any).class_id]);

    res.json({
      token,
      student: {
        id: student.id,
        full_name: (student as any).full_name,
        surname: (student as any).surname || null,
        first_name: (student as any).first_name || null,
        middle_name: (student as any).middle_name || null,
        gender: (student as any).gender || null,
        date_of_birth: (student as any).date_of_birth || null,
        address: (student as any).address || null,
        parent_name: (student as any).parent_name || null,
        parent_phone: (student as any).parent_phone || null,
        passport_photo: (student as any).passport_photo || null,
        class_name: classInfo?.name || "",
        class_id: (student as any).class_id,
      },
    });
  } catch (error: any) {
    console.error("Student login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// Get student results (for student portal)
app.get("/api/student/my-results", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.type !== "student") {
      return res.status(403).json({ error: "Student access required" });
    }
    const results = await queryAll(
      `SELECT r.*, sub.name as subject_name, sub.book_name 
       FROM results r 
       JOIN subjects sub ON r.subject_id = sub.id 
       WHERE r.student_id = $1 
       ORDER BY r.term ASC, sub.name ASC`,
      [req.user.id]
    );
    const subjects = await queryAll("SELECT * FROM subjects WHERE class_id = $1 ORDER BY id", [req.user.class_id]);
    const termReports = await queryAll(
      "SELECT * FROM student_term_reports WHERE student_id = $1 ORDER BY term ASC",
      [req.user.id]
    );
    const attendance = await queryAll(
      `SELECT status, COUNT(*)::int as count FROM attendance WHERE student_id = $1 GROUP BY status`,
      [req.user.id]
    );
    res.json({ results, subjects, termReports, attendance });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch results" });
  }
});

// --- Site Content Routes ---

app.get("/api/admin/content", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const content = await queryAll("SELECT content_key, content_value FROM site_content ORDER BY id");
    const contentMap: Record<string, string> = {};
    for (const c of content) {
      contentMap[c.content_key as string] = cleanHtmlMarkup(String(c.content_value));
    }
    res.json({ content: contentMap });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch content" });
  }
});

app.put("/api/admin/content", authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { updates } = req.body;
    if (!updates || typeof updates !== "object") {
      return res.status(400).json({ error: "Updates object is required" });
    }
    for (const [key, value] of Object.entries(updates)) {
      const cleanValue = cleanHtmlMarkup(String(value));
      const existing = await queryOne("SELECT id FROM site_content WHERE content_key = $1", [key]);
      if (existing) {
        await execute("UPDATE site_content SET content_value = $1 WHERE content_key = $2", [cleanValue, key]);
      } else {
        await execute("INSERT INTO site_content (content_key, content_value) VALUES ($1, $2)", [key, cleanValue]);
      }
    }
    res.json({ message: "Content updated successfully" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update content" });
  }
});

// Public content route (no auth)
app.get("/api/content", async (req: Request, res: Response) => {
  try {
    // Never cache content — every load must reflect the current admin edits so
    // localhost and Vercel (and any installed app) always show the same fresh UI.
    res.setHeader("Cache-Control", "no-store");
    const content = await queryAll("SELECT content_key, content_value FROM site_content ORDER BY id");
    const contentMap: Record<string, string> = {};
    for (const c of content) {
      contentMap[c.content_key as string] = cleanHtmlMarkup(String(c.content_value));
    }
    res.json({ content: contentMap });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch content" });
  }
});

// Batch add students (admin only)
app.post("/api/students/batch", authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { class_id, names } = req.body;
    if (!class_id || !names || !Array.isArray(names) || names.length === 0) {
      return res.status(400).json({ error: "Class ID and names array are required" });
    }

    let addedCount = 0;
    for (const name of names) {
      if (name.trim()) {
        // Extract surname (last word)
        const parts = name.trim().split(/\s+/);
        const surname = parts.length > 1 ? parts[parts.length - 1] : parts[0];
        await execute(
          "INSERT INTO students (class_id, full_name, surname, student_password) VALUES ($1, $2, $3, $4)",
          [class_id, name.trim(), surname, 'student123']
        );
        addedCount++;
      }
    }

    res.json({ message: `${addedCount} students added successfully` });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to add students" });
  }
});

// --- Logo / Image Upload Route ---
app.post("/api/upload", authMiddleware, adminMiddleware, (req: AuthenticatedRequest, res: Response) => {
  upload.single("image")(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "File too large. Max 5MB allowed." });
      }
      return res.status(400).json({ error: err.message });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    try {
      if (useSupabaseStorage) {
        // Persistent upload: store in the public Supabase Storage bucket and
        // return a CDN-served URL that works on every deployment.
        const ext = path.extname(req.file.originalname).toLowerCase() || ".png";
        const name = `logo_${Date.now()}${ext}`;
        const url = await storeImageInSupabase(req.file.buffer, name, req.file.mimetype || "image/jpeg");
        return res.json({ url, message: "Image uploaded successfully" });
      }

      // Local/disk fallback: multer already wrote the file into UPLOADS_DIR.
      const url = `/uploads/${req.file.filename}`;
      res.json({ url, message: "Image uploaded successfully" });
    } catch (e: any) {
      console.error("Image upload error:", e?.message || e);
      res.status(500).json({ error: "Failed to upload image" });
    }
  });
});

// ---- Vite / Static Asset setup ----
async function setupServer() {
  // NEVER boot the Vite dev server inside a serverless function (Vercel).
  // Serverless functions have no long-lived process and Vite middleware mode
  // crashes there on every invocation (FUNCTION_INVOCATION_FAILED).
  // process.env.VERCEL is the reliable serverless signal — NODE_ENV alone is
  // NOT dependable in the function runtime, so "vercel OR production" is
  // treated as static mode. Vite is only ever booted for local development.
  const isServerless = Boolean(process.env.VERCEL);
  const isProduction = process.env.NODE_ENV === "production";
  console.log(
    `[setup] serverless=${isServerless} NODE_ENV=${process.env.NODE_ENV || "unset"}`
  );

  if (!isServerless && !isProduction) {
    // Lazy import so Vite is never bundled into the serverless function
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(
      express.static(distPath, {
        maxAge: 0,
        immutable: false,
        // express.static serves the directory index (/) before our catch-all,
        // so force no-store on the HTML shell here as well — the browser must
        // always fetch the newest build (hashed assets stay cacheable).
        setHeaders: (res, filePath) => {
          if (filePath.endsWith("index.html")) {
            res.setHeader("Cache-Control", "no-store");
            res.setHeader("Pragma", "no-cache");
          }
        },
      })
    );
    app.get("*", (req, res) => {
      const indexHtml = path.join(distPath, "index.html");
      if (fs.existsSync(indexHtml)) {
        // Never cache the HTML shell — the browser must always fetch the newest
        // build (hashed JS/CSS URLs change per deploy, so assets are safe to
        // cache but index.html itself must never go stale).
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Pragma", "no-cache");
        res.sendFile(indexHtml);
      } else {
        // No frontend build present (e.g. bare serverless function) — never crash
        res.status(404).send("Not found");
      }
    });
  }

  // In serverless (Vercel), do not call listen() — the platform boots the handler.
  if (!isServerless) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server is running at http://0.0.0.0:${PORT}`);
    });
  }
}

setupServer();

export default app;
