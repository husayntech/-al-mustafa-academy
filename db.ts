import type { Database as SqlJsDatabase } from "sql.js";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// sql.js is loaded lazily (only in local SQLite mode). Importing it at the top
// level drags its WASM binary into the serverless bundle, which can crash the
// function on Vercel — so it is only ever imported when DATABASE_URL is unset.
type InitSqlJs = typeof import("sql.js").default;
// sql.js's default export is the initSqlJs() FUNCTION. It must be called to
// obtain the module that exposes the Database constructor — calling it is
// what this loader returns. (Without the call, SQL.Database is undefined and
// local SQLite mode crashes with "SQL.Database is not a constructor".)
type SqlJsApi = Awaited<ReturnType<InitSqlJs>>;
let initSqlJsFn: InitSqlJs | null = null;
async function loadSqlJs(): Promise<SqlJsApi> {
  if (!initSqlJsFn) {
    const mod = await import("sql.js");
    initSqlJsFn = mod.default;
  }
  return initSqlJsFn();
}

// Resolve the project root safely. In serverless/CJS bundles (Vercel) the
// import.meta.url is unavailable, so fall back to the working directory.
const __dirname = (() => {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return process.cwd();
  }
})();
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "academy.db");

// When DATABASE_URL is set (production / Vercel / Supabase / Neon), use PostgreSQL.
// Otherwise fall back to the local sql.js file database (development).
const USE_POSTGRES = Boolean(process.env.DATABASE_URL);

let db: SqlJsDatabase | null = null;
let sql: postgres.Sql | null = null;

/**
 * Initialize the database. Call this once at server startup.
 * - Postgres mode: connects to DATABASE_URL, ensures schema + seed.
 * - SQLite mode: loads/creates the local academy.db file.
 */
// Hard upper bound for each startup step. On serverless runtimes (Vercel) a
// cold start that hangs on a slow/misconfigured database exceeds the function
// execution limit and crashes the deployment in a crash-loop — so startup must
// always fail fast and leave the app serving (requests then get proper 500s
// instead of killing the instance).
function withStartupTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => {
      const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      if (typeof (t as any).unref === "function") (t as any).unref();
    }),
  ]);
}

// Cheap existence check for the core tables. Returns true when the schema is
// already present — so an existing database can skip the dozen CREATE TABLE
// round-trips on every cold start (which would stall the first request past
// the serverless function limit on slow poolers).
async function checkCoreTables(): Promise<boolean> {
  if (!sql) return false;
  const rows = await sql.unsafe(
    `SELECT
       to_regclass('public.classes') IS NOT NULL AS has_classes,
       to_regclass('public.site_content') IS NOT NULL AS has_content,
       to_regclass('public.users') IS NOT NULL AS has_users`
  );
  const r = (rows[0] || {}) as { has_classes?: boolean; has_content?: boolean; has_users?: boolean };
  return Boolean(r.has_classes && r.has_content && r.has_users);
}

export async function initDatabase(): Promise<any> {
  if (USE_POSTGRES) {
    if (sql) return sql;
    // Supabase connection-pooler friendly: `prepare: false` avoids prepared-
    // statement errors under PgBouncer (transaction mode), and `max: 1` keeps
    // the pool small for serverless invocations. Works with direct 5432 URLs too.
    const baseOptions: postgres.Options<{}> = {
      // max: 2 gives cheap insurance: if one connection gets stuck on a query
      // that is not cancelled server-side, the other can still serve traffic
      // instead of the whole pool queueing behind the zombie. Still tiny for
      // serverless — one extra socket at most.
      max: 2,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 15,
      // Recycle connections so a stale socket can never wedge the pool forever.
      max_lifetime: 60 * 5,
      onclose: () => {
        // Log drops so wedged connections are visible instead of silent hangs
        console.warn("[db] PostgreSQL connection closed — will reconnect on next query");
      },
    } as postgres.Options<{}>;
    sql = postgres(process.env.DATABASE_URL as string, baseOptions);
    // Schema/seed failures must NEVER reject initDatabase — on serverless runtimes
    // an unhandled rejection from the module-load path crashes the whole function.
    // The client is already usable for queries; a missing table just yields a 500.
    let tablesExist = false;
    try {
      tablesExist = await withStartupTimeout(checkCoreTables(), 8_000, "Table check");
    } catch (err: any) {
      console.warn("⚠️  Table check failed (running full init):", err?.message || err);
    }
    if (tablesExist) {
      // Fast path — schema already present. Only ensure seed data (the seed's
      // own count check short-circuits when classes already exist) and apply
      // targeted table upgrades. This keeps cold starts to a few round-trips
      // instead of a dozen slow ones.
      try {
        await withStartupTimeout(ensureTableUpgrades(), 15_000, "Schema upgrade");
      } catch (err: any) {
        console.warn("⚠️  Schema upgrade failed/timed out (continuing):", err?.message || err);
      }
      try {
        await withStartupTimeout(seedPostgresIfEmpty(), 30_000, "Seed step");
      } catch (err: any) {
        console.warn("⚠️  Seed step failed/timed out (continuing):", err?.message || err);
      }
      console.log("✅ Connected to PostgreSQL database (existing schema)");
      return sql;
    }
    try {
      await withStartupTimeout(ensurePostgresSchema(), 20_000, "Schema ensure");
    } catch (err: any) {
      console.warn("⚠️  Schema ensure failed/timed out (continuing):", err?.message || err);
    }
    try {
      await withStartupTimeout(seedPostgresIfEmpty(), 30_000, "Seed step");
    } catch (err: any) {
      console.warn("⚠️  Seed step failed/timed out (continuing):", err?.message || err);
    }
    console.log("✅ Connected to PostgreSQL database");
    return sql;
  }

  if (db) return db;

  // Ensure data directory exists (may fail on read-only serverless filesystems
  // when DATABASE_URL is not set — then we run in-memory and skip persistence)
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {
    console.warn("⚠️  data/ directory is not writable — running without persistence");
  }

  const SQL = await loadSqlJs();
  const fileExists = fs.existsSync(DB_PATH);

  if (fileExists) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
    console.log("✅ Loaded existing SQLite database");
  } else {
    db = new SQL.Database();
    console.log("✅ Created new SQLite database");
  }

  // Run migrations and seed
  ensureSchema(db);
  seedData(db);
  ensureContentKeys(db);

  // Save to disk
  saveDatabase();

  return db;
}

/* =========================================================================
 * PostgreSQL helpers
 * ========================================================================= */

/** Full PostgreSQL schema. Also used by scripts/migrate-to-postgres.ts. */
export const POSTGRES_SCHEMA_SQL = `
    CREATE TABLE IF NOT EXISTS public.classes (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      name_arabic TEXT,
      display_order INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS public.users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      surname TEXT,
      first_name TEXT,
      middle_name TEXT,
      role TEXT DEFAULT 'teacher',
      is_admin INTEGER DEFAULT 0,
      phone TEXT,
      email TEXT,
      address TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.subjects (
      id SERIAL PRIMARY KEY,
      class_id INTEGER NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      book_name TEXT,
      book_author TEXT
    );
    CREATE TABLE IF NOT EXISTS public.students (
      id SERIAL PRIMARY KEY,
      class_id INTEGER NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      surname TEXT,
      first_name TEXT,
      middle_name TEXT,
      gender TEXT,
      date_of_birth TEXT,
      address TEXT,
      parent_name TEXT,
      parent_phone TEXT,
      passport_photo TEXT,
      student_password TEXT DEFAULT 'student123',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.results (
      id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
      subject_id INTEGER NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
      term INTEGER NOT NULL CHECK (term IN (1, 2, 3)),
      year TEXT NOT NULL,
      test_score DOUBLE PRECISION CHECK (test_score IS NULL OR (test_score >= 0 AND test_score <= 30)),
      exam_score DOUBLE PRECISION CHECK (exam_score IS NULL OR (exam_score >= 0 AND exam_score <= 70)),
      ca1_score DOUBLE PRECISION CHECK (ca1_score IS NULL OR (ca1_score >= 0 AND ca1_score <= 10)),
      ca2_score DOUBLE PRECISION CHECK (ca2_score IS NULL OR (ca2_score >= 0 AND ca2_score <= 10)),
      ca3_score DOUBLE PRECISION CHECK (ca3_score IS NULL OR (ca3_score >= 0 AND ca3_score <= 10)),
      total_score DOUBLE PRECISION GENERATED ALWAYS AS (COALESCE(test_score, 0) + COALESCE(exam_score, 0)) STORED,
      remarks TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.attendance (
      id SERIAL PRIMARY KEY,
      class_id INTEGER NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
      session_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late')),
      marked_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(student_id, session_date)
    );
    CREATE TABLE IF NOT EXISTS public.student_term_reports (
      id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
      term INTEGER NOT NULL CHECK (term IN (1, 2, 3)),
      year TEXT NOT NULL,
      hifdh_progress TEXT,
      behavior_remarks TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(student_id, term, year)
    );
    CREATE TABLE IF NOT EXISTS public.student_pins (
      id SERIAL PRIMARY KEY,
      student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
      class_id INTEGER REFERENCES public.classes(id) ON DELETE SET NULL,
      pin TEXT UNIQUE NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES public.users(id),
      login_time TIMESTAMPTZ NOT NULL,
      logout_time TIMESTAMPTZ,
      session_date DATE NOT NULL
    );
    CREATE TABLE IF NOT EXISTS public.password_resets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used INTEGER DEFAULT 0,
      attempts INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.site_content (
      id SERIAL PRIMARY KEY,
      content_key TEXT UNIQUE NOT NULL,
      content_value TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS public.teacher_classes (
      id SERIAL PRIMARY KEY,
      teacher_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
      UNIQUE(teacher_id, class_id)
    );
    CREATE TABLE IF NOT EXISTS public.result_sheet_config (
      id SERIAL PRIMARY KEY,
      config_key TEXT UNIQUE NOT NULL,
      config_value TEXT NOT NULL DEFAULT ''
    );
`;

// Targeted upgrades applied even when the core schema fast-path is taken (existing
// databases skip ensurePostgresSchema). Each statement is idempotent and cheap, so
// running them on every cold start is safe — the attendance check short-circuits.
const POSTGRES_UPGRADE_SQL = `
  CREATE TABLE IF NOT EXISTS public.attendance (
    id SERIAL PRIMARY KEY,
    class_id INTEGER NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late')),
    marked_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, session_date)
  );
  CREATE TABLE IF NOT EXISTS public.student_term_reports (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    class_id INTEGER NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    term INTEGER NOT NULL CHECK (term IN (1, 2, 3)),
    year TEXT NOT NULL,
    hifdh_progress TEXT,
    behavior_remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, term, year)
  );
  CREATE TABLE IF NOT EXISTS public.student_pins (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    class_id INTEGER REFERENCES public.classes(id) ON DELETE SET NULL,
    pin TEXT UNIQUE NOT NULL,
    active INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ALTER TABLE public.student_pins ADD COLUMN IF NOT EXISTS class_id INTEGER REFERENCES public.classes(id) ON DELETE SET NULL;
  ALTER TABLE public.student_pins ALTER COLUMN student_id DROP NOT NULL;
  ALTER TABLE public.results ADD COLUMN IF NOT EXISTS ca1_score DOUBLE PRECISION;
  ALTER TABLE public.results ADD COLUMN IF NOT EXISTS ca2_score DOUBLE PRECISION;
  ALTER TABLE public.results ADD COLUMN IF NOT EXISTS ca3_score DOUBLE PRECISION;
`;

async function ensureTableUpgrades() {
  if (!sql) return;
  // Every statement below is idempotent (CREATE TABLE IF NOT EXISTS / ADD COLUMN
  // IF NOT EXISTS / DROP NOT NULL), so we run them ALL on every cold start. An
  // early-exit guard is a footgun: it skipped newer tables on existing databases
  // twice already, so correctness wins over saving a few round-trips.
  const statements = POSTGRES_UPGRADE_SQL
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s && s.length > 0);
  for (const stmt of statements) {
    try {
      await sql.unsafe(stmt);
    } catch (err: any) {
      console.warn("⚠️  Schema upgrade statement skipped:", err?.message || err);
    }
  }
}

async function ensurePostgresSchema() {
  if (!sql) return;
  // Run each CREATE TABLE separately: a single giant multi-statement query can be
  // cancelled by the Supabase pooler's statement timeout, and is not supported by
  // prepared-statement paths. Each statement here is tiny and idempotent.
  const statements = POSTGRES_SCHEMA_SQL
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s && s.length > 0);
  for (const stmt of statements) {
    try {
      await sql.unsafe(stmt);
    } catch (err: any) {
      // Table may already exist with a concurrent deploy — log and keep going.
      console.warn("⚠️  Schema statement skipped:", err?.message || err);
    }
  }
}

async function seedPostgresIfEmpty() {
  if (!sql) return;
  // Use the guarded query helper: on a wedged/slow connection it THROWS after
  // the 10s cap instead of hanging — and a failed count must NEVER trigger a
  // seed (a stale socket answering the first query with an empty result is how
  // duplicate classes got written to a live production database before).
  let cnt: number | null = null;
  try {
    const rows = await queryAll(`SELECT COUNT(*)::int as cnt FROM public.classes`);
    cnt = rows[0]?.cnt ?? null;
  } catch (err: any) {
    console.warn("⚠️  Class count check failed — skipping seed to avoid duplicates:", err?.message || err);
    return;
  }
  // Only seed when we are CERTAIN the table is empty. Any uncertainty (null /
  // unexpected value) skips seeding — the safest failure mode is "do nothing".
  if (cnt !== 0) {
    if (cnt !== null && cnt > 0) console.log("✅ Classes already exist — skipping seed");
    else console.warn("⚠️  Class count returned an unexpected value (" + String(cnt) + ") — skipping seed");
    return;
  }
  console.log("🌱 Seeding default data (PostgreSQL)...");

  // Helper: one round-trip per table instead of one per row — the Supabase
  // pooler can be slow (seconds per round-trip), so 100+ sequential inserts can
  // hang past the serverless function limit. Batched multi-row inserts keep the
  // seed well under any timeout.
  const insertMany = async (table: string, columns: string[], rows: any[][], extraSql = "") => {
    if (!rows.length) return;
    const placeholders = rows
      .map((_, r) => `(${columns.map((_, c) => `$${r * columns.length + c + 1}`).join(", ")})`)
      .join(", ");
    await sql!.unsafe(
      `INSERT INTO public.${table} (${columns.join(", ")}) VALUES ${placeholders} ${extraSql}`,
      rows.flat()
    );
  };

  // Classes — Rawdah & Ibtidaai (primary) levels first, then I'daadi & Tawjihi
  const classes = [
    { name: "Rawdah", name_arabic: "الروضة", order: 1 },
    { name: "Awwal-Ibtidaai", name_arabic: "الأول الابتدائي", order: 2 },
    { name: "Thaani-Ibtidaai", name_arabic: "الثانى الابتدائي", order: 3 },
    { name: "Thaalith-Ibtidaai", name_arabic: "الثالث الابتدائي", order: 4 },
    { name: " Al-Awwal Al-Idadi", name_arabic: "الأول الإعدادي", order: 5 },
    { name: " Ath-Thani Al-Idadi", name_arabic: "الثاني الإعدادي", order: 6 },
    { name: " Ath-Thalith Al-Idadi", name_arabic: "الثالث الإعدادي", order: 7 },
    { name: " Ar-Rabi' Al-Idadi", name_arabic: "الرابع الإعدادي", order: 8 },
    { name: " Al-Awwal At-Tawjihi", name_arabic: "الأول التوجيهي", order: 9 },
    { name: " Ath-Thani At-Tawjihi", name_arabic: "الثاني التوجيهي", order: 10 },
  ];
  await insertMany("classes", ["name", "name_arabic", "display_order"], classes.map((c) => [c.name, c.name_arabic, c.order]));

  // Users
  const teacherHash = bcrypt.hashSync("teacher123", 10);
  const adminHash = bcrypt.hashSync("admin123", 10);
  await insertMany("users", ["username", "password_hash", "full_name", "role"], [
    ["teacher", teacherHash, "Teacher", "teacher"],
    ["admin", adminHash, "Administrator", "admin"],
  ]);

  // Subjects — seeded ONLY for the original I'daadi & Tawjihi classes (5-10).
  // The Rawdah & Ibtidaai (primary) classes (1-4) intentionally start with no
  // subjects — teachers add them per-class as needed.
  const madrasahSubjects: { name: string; name_arabic: string }[] = [
    { name: "Qur'an Memorization", name_arabic: "تحفيظ القرآن" },
    { name: "Tajwid", name_arabic: "التجويد" },
    { name: "Hadith", name_arabic: "الحديث" },
    { name: "Science of Hadith", name_arabic: "علوم الحديث" },
    { name: "Jurisprudence (Fiqh)", name_arabic: "الفقه" },
    { name: "Theology (Aqeedah)", name_arabic: "العقيدة" },
    { name: "Exegesis (Tafsir)", name_arabic: "التفسير" },
    { name: "Arabic Grammar (Nahw)", name_arabic: "النحو" },
    { name: "Rhetoric (Balaghah)", name_arabic: "البلاغة" },
    { name: "Arabic Passage Reading", name_arabic: "القراءة العربية" },
    { name: "Poem (Nazm)", name_arabic: "النظم" },
    { name: "Islamic Moral / Ethics", name_arabic: "الآداب الإسلامية" },
    { name: "Islamic History", name_arabic: "التاريخ الإسلامي" },
  ];
  const subjectRows: any[][] = [];
  for (let classId = 5; classId <= 10; classId++) {
    for (const subj of madrasahSubjects) {
      subjectRows.push([classId, subj.name, `Level ${classId} - ${subj.name_arabic}`, ""]);
    }
  }
  await insertMany("subjects", ["class_id", "name", "book_name", "book_author"], subjectRows);

  // Site content
  const contentItems: [string, string][] = [
    ["school_announcement", "Registration for the new academic year is now open."],
    ["about_text", "Nurturing intellect, faith, and ethical leadership for a globalized world."],
    ["footer_text", "Al Mustafa Academy. Where the Qur'an and Sunnah Shape Character and Excellence since 2013."],
    ["footer_tagline", "Nurturing Souls, Educating Minds"],
    ["hero_subtitle", "A world-class education where tradition meets modern excellence."],
    ["established_tag", "Established in 2013"],
    ["hero_title", "Empowering Minds, Anchored in Faith"],
    ["hero_tagline_arabic", "أكاديمية المصطفى لتحفيظ القرآن والدراسات الإسلامية"],
    ["mission_heading", "Our Sacred Mission"],
    ["mission_arabic", "رسالتنا المقدسة"],
    ["cta_button_text", "Join Our Community"],
    ["tradition_title", "Tradition"],
    ["tradition_text", "Rooted in Islamic scholarship, ethics, and heritage."],
    ["excellence_title", "Excellence"],
    ["excellence_text", "Rigorous schooling in Islamic Sciences, languages, and critical thinking."],
    ["color_primary", "#0B6E4F"],
    ["color_primary_hover", "#085c41"],
    ["color_secondary", "#D4AF37"],
    ["color_secondary_hover", "#c4a026"],
    ["color_secondary_fixed", "#f7d44a"],
    ["color_secondary_container", "#f5e6b8"],
    ["contact_phone", "08037525855"],
    ["contact_email", "almustafaacademyilorin@gmail.com"],
    ["school_address", "25, Sabo-Line Road, Opposite Saw-Mill, Ilorin, Nigeria"],
    ["hero_image_url", "https://drive.google.com/uc?export=view&id=1DPf6NnO7GMmdX4Kmi6ZVL8AHjK39dskS"],
    ["logo_url", "/uploads/logo_1785834148413.jpeg"],
    ["nav_curriculum_label", "Madrasah Activities"],
  ];
  await insertMany(
    "site_content",
    ["content_key", "content_value"],
    contentItems.map(([key, value]) => [key, value]),
    "ON CONFLICT (content_key) DO NOTHING"
  );

  console.log("✅ Default data seeded successfully (PostgreSQL)");
}

/* =========================================================================
 * Query API — works for both Postgres and SQLite
 * ========================================================================= */

// Hard per-query ceiling. If the pooler is slow/saturated, a query that would
// otherwise hang forever (wedging the single connection and every later route)
// instead fails fast so the request gets a clean 500 and the server recovers.
const QUERY_TIMEOUT_MS = 10_000;
function withQueryTimeout<T>(p: Promise<T>): Promise<T> {
  // Caps any single request so a slow pooler can never hang a route forever.
  // When it fires, the query is left to resolve in the background, but
  // max_lifetime + max: 2 mean the pool recovers on its own instead of
  // everything queueing behind one stuck connection.
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error("Query timed out after 10s (database slow)"));
    }, QUERY_TIMEOUT_MS);
    if (typeof (t as any).unref === "function") (t as any).unref();
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

export async function queryAll(query: string, params: any[] = []): Promise<Record<string, any>[]> {
  if (USE_POSTGRES) {
    await ensurePg();
    const rows = await withQueryTimeout(sql!.unsafe(query, params));
    return rows as Record<string, any>[];
  }
  const database = getDatabase();
  // Convert PostgreSQL $1, $2 placeholders to sql.js ? placeholders
  const sqliteQuery = query.replace(/\$\d+/g, "?");
  const stmt = database.prepare(sqliteQuery);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const rows: Record<string, any>[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

export async function queryOne(query: string, params: any[] = []): Promise<Record<string, any> | null> {
  const rows = await queryAll(query, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function execute(query: string, params: any[] = []): Promise<number> {
  if (USE_POSTGRES) {
    await ensurePg();
    // For INSERT queries, append RETURNING id so we can return the new row id
    const trimmed = query.trim();
    if (/^INSERT/i.test(trimmed) && !/RETURNING/i.test(trimmed)) {
      const withReturning = `${trimmed} RETURNING id`;
      const rows = await withQueryTimeout(sql!.unsafe(withReturning, params));
      return rows[0]?.id ?? 1;
    }
    await withQueryTimeout(sql!.unsafe(trimmed, params));
    return 1;
  }
  const database = getDatabase();
  // Convert PostgreSQL $1, $2 placeholders to sql.js ? placeholders
  const sqliteQuery = query.replace(/\$\d+/g, "?");
  database.run(sqliteQuery, params);
  saveDatabase();

  if (query.trim().toUpperCase().startsWith("INSERT")) {
    const result = database.exec("SELECT last_insert_rowid() as id");
    return result.length > 0 ? (result[0].values[0][0] as number) : 0;
  }
  return 1;
}

let pgEnsurePromise: Promise<void> | null = null;
async function ensurePg() {
  if (!USE_POSTGRES || sql) return;
  if (!pgEnsurePromise) {
    // Attach a rejection handler to the underlying promise so a failed init can
    // never surface as an unhandled rejection (which crashes serverless runtimes).
    // The error still propagates to the awaiting request so it returns a 500.
    pgEnsurePromise = initDatabase().then(
      () => undefined,
      (err: any) => {
        console.error("Postgres init failed:", err?.message || err);
        throw err;
      }
    );
  }
  await pgEnsurePromise;
}

/* =========================================================================
 * SQLite helpers (local development only)
 * ========================================================================= */

/**
 * Save the in-memory database to disk.
 */
function saveDatabase() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err: any) {
    // Read-only filesystem (e.g. Vercel without DATABASE_URL) — skip persistence
    console.warn("⚠️  Could not persist database file:", err?.message || err);
  }
}

/**
 * Create tables if they don't exist.
 */
function ensureSchema(database: SqlJsDatabase) {
  database.run(`
    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_arabic TEXT,
      display_order INTEGER NOT NULL
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      surname TEXT,
      first_name TEXT,
      middle_name TEXT,
      role TEXT DEFAULT 'teacher',
      is_admin INTEGER DEFAULT 0,
      phone TEXT,
      email TEXT,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      book_name TEXT,
      book_author TEXT
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      surname TEXT,
      first_name TEXT,
      middle_name TEXT,
      gender TEXT,
      date_of_birth TEXT,
      address TEXT,
      parent_name TEXT,
      parent_phone TEXT,
      passport_photo TEXT,
      student_password TEXT DEFAULT 'student123',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      term INTEGER NOT NULL CHECK (term IN (1, 2, 3)),
      year TEXT NOT NULL,
      test_score REAL CHECK (test_score IS NULL OR (test_score >= 0 AND test_score <= 30)),
      exam_score REAL CHECK (exam_score IS NULL OR (exam_score >= 0 AND exam_score <= 70)),
      ca1_score REAL CHECK (ca1_score IS NULL OR (ca1_score >= 0 AND ca1_score <= 10)),
      ca2_score REAL CHECK (ca2_score IS NULL OR (ca2_score >= 0 AND ca2_score <= 10)),
      ca3_score REAL CHECK (ca3_score IS NULL OR (ca3_score >= 0 AND ca3_score <= 10)),
      total_score REAL GENERATED ALWAYS AS (COALESCE(test_score, 0) + COALESCE(exam_score, 0)) STORED,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      session_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late')),
      marked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, session_date)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS student_term_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      term INTEGER NOT NULL CHECK (term IN (1, 2, 3)),
      year TEXT NOT NULL,
      hifdh_progress TEXT,
      behavior_remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, term, year)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS student_pins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
      class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
      pin TEXT UNIQUE NOT NULL,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      login_time DATETIME NOT NULL,
      logout_time DATETIME,
      session_date DATE NOT NULL
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      attempts INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  try { database.run(`ALTER TABLE password_resets ADD COLUMN attempts INTEGER DEFAULT 0`); } catch {}

  database.run(`
    CREATE TABLE IF NOT EXISTS site_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content_key TEXT UNIQUE NOT NULL,
      content_value TEXT NOT NULL DEFAULT ''
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS teacher_classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      UNIQUE(teacher_id, class_id)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS result_sheet_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_key TEXT UNIQUE NOT NULL,
      config_value TEXT NOT NULL DEFAULT ''
    )
  `);

  // Migration: add new columns if they don't exist
  try { database.run(`ALTER TABLE students ADD COLUMN surname TEXT`); } catch {}
  try { database.run(`ALTER TABLE students ADD COLUMN first_name TEXT`); } catch {}
  try { database.run(`ALTER TABLE students ADD COLUMN middle_name TEXT`); } catch {}
  try { database.run(`ALTER TABLE students ADD COLUMN gender TEXT`); } catch {}
  try { database.run(`ALTER TABLE students ADD COLUMN date_of_birth TEXT`); } catch {}
  try { database.run(`ALTER TABLE students ADD COLUMN address TEXT`); } catch {}
  try { database.run(`ALTER TABLE students ADD COLUMN parent_name TEXT`); } catch {}
  try { database.run(`ALTER TABLE students ADD COLUMN parent_phone TEXT`); } catch {}
  try { database.run(`ALTER TABLE students ADD COLUMN passport_photo TEXT`); } catch {}
  try { database.run(`ALTER TABLE students ADD COLUMN student_password TEXT DEFAULT 'student123'`); } catch {}
  try { database.run(`ALTER TABLE student_pins ADD COLUMN class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL`); } catch {}
  try { database.run(`ALTER TABLE users ADD COLUMN surname TEXT`); } catch {}
  try { database.run(`ALTER TABLE users ADD COLUMN first_name TEXT`); } catch {}
  try { database.run(`ALTER TABLE users ADD COLUMN middle_name TEXT`); } catch {}
  try { database.run(`ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0`); } catch {}
  try { database.run(`ALTER TABLE users ADD COLUMN phone TEXT`); } catch {}
  try { database.run(`ALTER TABLE users ADD COLUMN email TEXT`); } catch {}
  try { database.run(`ALTER TABLE users ADD COLUMN address TEXT`); } catch {}
  try { database.run(`ALTER TABLE results ADD COLUMN ca1_score REAL`); } catch {}
  try { database.run(`ALTER TABLE results ADD COLUMN ca2_score REAL`); } catch {}
  try { database.run(`ALTER TABLE results ADD COLUMN ca3_score REAL`); } catch {}

  saveDatabase();
}

/**
 * Seed default data if the database is empty.
 */
function seedData(database: SqlJsDatabase) {
  // Check if data already exists
  const countResult = database.exec("SELECT COUNT(*) as cnt FROM classes");
  if (countResult.length > 0 && countResult[0].values[0][0] > 0) return;

  console.log("🌱 Seeding default data...");

  // Seed classes — Rawdah & Ibtidaai (primary) levels first, then I'daadi & Tawjihi
  const classes = [
    { name: "Rawdah", name_arabic: "الروضة", order: 1 },
    { name: "Awwal-Ibtidaai", name_arabic: "الأول الابتدائي", order: 2 },
    { name: "Thaani-Ibtidaai", name_arabic: "الثانى الابتدائي", order: 3 },
    { name: "Thaalith-Ibtidaai", name_arabic: "الثالث الابتدائي", order: 4 },
    { name: " Al-Awwal Al-Idadi", name_arabic: "الأول الإعدادي", order: 5 },
    { name: " Ath-Thani Al-Idadi", name_arabic: "الثاني الإعدادي", order: 6 },
    { name: " Ath-Thalith Al-Idadi", name_arabic: "الثالث الإعدادي", order: 7 },
    { name: " Ar-Rabi' Al-Idadi", name_arabic: "الرابع الإعدادي", order: 8 },
    { name: " Al-Awwal At-Tawjihi", name_arabic: "الأول التوجيهي", order: 9 },
    { name: " Ath-Thani At-Tawjihi", name_arabic: "الثاني التوجيهي", order: 10 },
  ];

  for (const c of classes) {
    database.run(
      "INSERT INTO classes (name, name_arabic, display_order) VALUES (?, ?, ?)",
      [c.name, c.name_arabic, c.order]
    );
  }

  // Seed users
  const teacherHash = bcrypt.hashSync("teacher123", 10);
  const adminHash = bcrypt.hashSync("admin123", 10);

  database.run(
    "INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)",
    ["teacher", teacherHash, "Teacher", "teacher"]
  );
  database.run(
    "INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)",
    ["admin", adminHash, "Administrator", "admin"]
  );

  // Seed subjects — ONLY for the original I'daadi & Tawjihi classes (5-10).
  // The Rawdah & Ibtidaai (primary) classes (1-4) start with no subjects.
  const madrasahSubjects: { name: string; name_arabic: string }[] = [
    { name: "Qur'an Memorization", name_arabic: "تحفيظ القرآن" },
    { name: "Tajwid", name_arabic: "التجويد" },
    { name: "Hadith", name_arabic: "الحديث" },
    { name: "Science of Hadith", name_arabic: "علوم الحديث" },
    { name: "Jurisprudence (Fiqh)", name_arabic: "الفقه" },
    { name: "Theology (Aqeedah)", name_arabic: "العقيدة" },
    { name: "Exegesis (Tafsir)", name_arabic: "التفسير" },
    { name: "Arabic Grammar (Nahw)", name_arabic: "النحو" },
    { name: "Rhetoric (Balaghah)", name_arabic: "البلاغة" },
    { name: "Arabic Passage Reading", name_arabic: "القراءة العربية" },
    { name: "Poem (Nazm)", name_arabic: "النظم" },
    { name: "Islamic Moral / Ethics", name_arabic: "الآداب الإسلامية" },
    { name: "Islamic History", name_arabic: "التاريخ الإسلامي" },
  ];

  for (let classId = 5; classId <= 10; classId++) {
    for (const subj of madrasahSubjects) {
      database.run(
        "INSERT INTO subjects (class_id, name, book_name, book_author) VALUES (?, ?, ?, ?)",
        [classId, subj.name, `Level ${classId} - ${subj.name_arabic}`, ""]
      );
    }
  }

  // Seed site content
  const contentItems = [
    { key: "school_announcement", value: "Registration for the new academic year is now open." },
    { key: "about_text", value: "Nurturing intellect, faith, and ethical leadership for a globalized world." },
    { key: "footer_text", value: "Al Mustafa Academy. Where the Qur'an and Sunnah Shape Character and Excellence since 2013." },
    { key: "footer_tagline", value: "Nurturing Souls, Educating Minds" },
    { key: "hero_subtitle", value: "A world-class education where tradition meets modern excellence." },
    { key: "established_tag", value: "Established in 2013" },
    { key: "hero_title", value: "Empowering Minds, Anchored in Faith" },
    { key: "hero_tagline_arabic", value: "أكاديمية المصطفى لتحفيظ القرآن والدراسات الإسلامية" },
    { key: "mission_heading", value: "Our Sacred Mission" },
    { key: "mission_arabic", value: "رسالتنا المقدسة" },
    { key: "cta_button_text", value: "Join Our Community" },
    { key: "tradition_title", value: "Tradition" },
    { key: "tradition_text", value: "Rooted in Islamic scholarship, ethics, and heritage." },
    { key: "excellence_title", value: "Excellence" },
    { key: "excellence_text", value: "Rigorous schooling in Islamic Sciences, languages, and critical thinking." },
    { key: "color_primary", value: "#0B6E4F" },
    { key: "color_primary_hover", value: "#085c41" },
    { key: "color_secondary", value: "#D4AF37" },
    { key: "color_secondary_hover", value: "#c4a026" },
    { key: "color_secondary_fixed", value: "#f7d44a" },
    { key: "color_secondary_container", value: "#f5e6b8" },
    { key: "contact_phone", value: "08037525855" },
    { key: "contact_email", value: "almustafaacademyilorin@gmail.com" },
    { key: "school_address", value: "25, Sabo-Line Road, Opposite Saw-Mill, Ilorin, Nigeria" },
    { key: "hero_image_url", value: "https://drive.google.com/uc?export=view&id=1DPf6NnO7GMmdX4Kmi6ZVL8AHjK39dskS" },
    { key: "logo_url", value: "/uploads/logo_1785834148413.jpeg" },
  ];

  for (const item of contentItems) {
    database.run(
      "INSERT OR IGNORE INTO site_content (content_key, content_value) VALUES (?, ?)",
      [item.key, item.value]
    );
  }

  saveDatabase();
  console.log("✅ Default data seeded successfully");
}

/**
 * Ensure critical content keys exist even if the database was already seeded.
 * - Missing keys are inserted with their (short) defaults.
 * - Legacy long-form text is shortened ONLY when it still matches the original
 *   seed value — admin edits are never overwritten.
 */
function ensureContentKeys(database: SqlJsDatabase) {
  const requiredKeys: Record<string, string> = {
    hero_image_url: "https://drive.google.com/uc?export=view&id=1DPf6NnO7GMmdX4Kmi6ZVL8AHjK39dskS",
    logo_url: "/uploads/logo_1785834148413.jpeg",
    school_announcement: "Registration for the new academic year is now open.",
    about_text: "Nurturing intellect, faith, and ethical leadership for a globalized world.",
    hero_subtitle: "A world-class education where tradition meets modern excellence.",
    hero_title: "Empowering Minds, Anchored in Faith",
    hero_tagline_arabic: "أكاديمية المصطفى لتحفيظ القرآن والدراسات الإسلامية",
    mission_heading: "Our Sacred Mission",
    mission_arabic: "رسالتنا المقدسة",
    cta_button_text: "Join Our Community",
    tradition_title: "Tradition",
    tradition_text: "Rooted in Islamic scholarship, ethics, and heritage.",
    excellence_title: "Excellence",
    excellence_text: "Rigorous schooling in Islamic Sciences, languages, and critical thinking.",
    color_primary: "#0B6E4F",
    color_primary_hover: "#085c41",
    color_secondary: "#D4AF37",
    color_secondary_hover: "#c4a026",
    color_secondary_fixed: "#f7d44a",
    color_secondary_container: "#f5e6b8",
    nav_curriculum_label: "Madrasah Activities",
  };

  // Original long-form seed values — only replaced if unchanged (i.e. not edited)
  const legacyLong: Record<string, string> = {
    school_announcement: "Welcome to Al Mustafa Academy! Registration for the new academic year is now open.",
    about_text: "We provide an environment that fosters intellectual rigor, spiritual growth, and ethical leadership, preparing students to excel in a globalized world.",
    hero_subtitle: "Experience a world-class education where traditional values meet contemporary academic excellence.",
    nav_curriculum_label: "Curriculum",
  };

  for (const [key, value] of Object.entries(requiredKeys)) {
    const stmt = database.prepare("SELECT content_value FROM site_content WHERE content_key = ?");
    stmt.bind([key]);
    const exists = stmt.step();
    const currentVal = exists ? String(stmt.get()[0] ?? "") : "";
    stmt.free();

    if (!exists) {
      database.run(
        "INSERT INTO site_content (content_key, content_value) VALUES (?, ?)",
        [key, value]
      );
    } else if (legacyLong[key] !== undefined && currentVal === legacyLong[key]) {
      // Legacy default still in place → shorten it (admin edits are preserved)
      database.run(
        "UPDATE site_content SET content_value = ? WHERE content_key = ?",
        [value, key]
      );
    }
  }
  saveDatabase();
}

/**
 * Get the database instance (SQLite only — Postgres mode uses the sql client).
 */
export function getDatabase(): SqlJsDatabase {
  if (USE_POSTGRES) throw new Error("getDatabase() is only available in SQLite mode");
  if (!db) throw new Error("Database not initialized. Call initDatabase() first.");
  return db;
}

/**
 * Cleanup: close the database connection.
 */
export async function closeDatabase(): Promise<void> {
  if (USE_POSTGRES && sql) {
    await sql.end({ timeout: 5 });
    sql = null;
    return;
  }
  if (db) {
    saveDatabase();
    db.close();
    db = null;
  }
}
