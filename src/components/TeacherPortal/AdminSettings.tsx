import { useState, useEffect, useMemo, useRef, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft, Shield, UserPlus, Trash2, Users, Clock,
  Sprout, Database, X, AlertCircle, CheckCircle,
  FileText, Save, BarChart3, School, BookOpen, LayoutDashboard,
  GraduationCap, Globe, Eye, EyeOff, Search, RefreshCw, Terminal,
  UserCheck, BookMarked, Palette, Image as ImageIcon, Upload, Edit2, LayoutTemplate, Languages as LanguagesIcon, Type, Ruler, Copy,
  MousePointerClick, ExternalLink,
  Ticket, Megaphone, Send, Plus, KeyRound, Loader2
} from "lucide-react";
import { User, Session, Class, Subject, Result } from "../../types";
import { CONTENT_FIELDS, CONTENT_DEFAULTS, normalizeImageUrl, cleanHtmlMarkup } from "../../lib/siteContent";
import { getEditMode, setEditMode } from "../../lib/editMode";
import RichTextEditor from "./RichTextEditor";
import ConfirmModal from "./ConfirmModal";
import FontPicker from "./FontPicker";
import { RESULT_SHEET_DEFAULTS, RESULT_SHEET_PLACEHOLDERS } from "../../lib/resultSheetConfig";
import { buildResultSheetData, renderResultSheetTemplate } from "../../lib/resultSheet";

const PAGE_GROUP_MAP: Record<string, string[]> = {
  home: ["Text & Announcements", "Header & Footer", "Colors & Theme", "Typography & Styling", "Images", "Contact", "Section Spacing"],
  admissions: ["Admissions Page", "Admissions Spacing"],
  curriculum: ["Madrasah Activities Page", "Madrasah Spacing"],
};

// Split a full name into surname / first name / middle name parts
// (last word → surname, first word → first name, everything between → middle name)
function splitFullName(fullName: string) {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { surname: "", first_name: "", middle_name: "" };
  if (parts.length === 1) return { surname: parts[0], first_name: "", middle_name: "" };
  if (parts.length === 2) return { surname: parts[1], first_name: parts[0], middle_name: "" };
  return { surname: parts[parts.length - 1], first_name: parts[0], middle_name: parts.slice(1, -1).join(" ") };
}

// Compose a full name from surname / first name / middle name parts
function composeFullName(parts: { surname?: string; first_name?: string; middle_name?: string }) {
  return [parts.first_name, parts.middle_name, parts.surname]
    .map((p) => (p || "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
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

// Auto username for a staff member, e.g. "Ibrahim Mustapha" → "staff_ibrahim",
// "الأستاذ عبد الرفيع" → "staff_abdalrfia"
function autoStaffUsername(firstName: string, surname: string, middleName = "") {
  const full = [firstName, middleName, surname].map((p) => (p || "").trim()).filter(Boolean).join(" ");
  const base = usernameBaseFromName(full);
  return base ? `staff_${base}` : "";
}

const SAMPLE_SUBJECTS: Subject[] = [
  { id: 1, class_id: 1, name: "Qur'an Memorization", book_name: "Juz Amma", book_author: "" },
  { id: 2, class_id: 1, name: "Tajweed", book_name: "", book_author: "" },
  { id: 3, class_id: 1, name: "Arabic Grammar (Nahw)", book_name: "", book_author: "" },
  { id: 4, class_id: 1, name: "Fiqh", book_name: "", book_author: "" },
  { id: 5, class_id: 1, name: "Tawheed", book_name: "", book_author: "" },
  { id: 6, class_id: 1, name: "Reading (Mutala'ah)", book_name: "", book_author: "" },
];

const SAMPLE_RESULTS: Result[] = [
  { id: 1, student_id: 1, subject_id: 1, term: 1, year: "2026/2027", test_score: 28, exam_score: 65, total_score: 93, remarks: "Excellent", created_at: "" },
  { id: 2, student_id: 1, subject_id: 2, term: 1, year: "2026/2027", test_score: 24, exam_score: 55, total_score: 79, remarks: "Very Good", created_at: "" },
  { id: 3, student_id: 1, subject_id: 3, term: 1, year: "2026/2027", test_score: 20, exam_score: 50, total_score: 70, remarks: "Good", created_at: "" },
  { id: 4, student_id: 1, subject_id: 4, term: 1, year: "2026/2027", test_score: 18, exam_score: 45, total_score: 63, remarks: "", created_at: "" },
  { id: 5, student_id: 1, subject_id: 5, term: 1, year: "2026/2027", test_score: 15, exam_score: 40, total_score: 55, remarks: "", created_at: "" },
  { id: 6, student_id: 1, subject_id: 6, term: 1, year: "2026/2027", test_score: 10, exam_score: 30, total_score: 40, remarks: "", created_at: "" },
];

interface AdminSettingsProps {
  token: string;
  user: User;
  onBack: () => void;
}

interface DashboardStats {
  totalUsers: number;
  totalClasses: number;
  totalStudents: number;
  totalSubjects: number;
  totalResults: number;
  activeSessions: number;
}

export default function AdminSettings({ token, user, onBack }: AdminSettingsProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  // Scratch-card PINs + Broadcast state
  const [pins, setPins] = useState<any[]>([]);
  const [pinCount, setPinCount] = useState(10);
  const [pinClassId, setPinClassId] = useState<string>("");
  const [pinLoading, setPinLoading] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastSubject, setBroadcastSubject] = useState("Al Mustafa Academy — Announcement");
  const [broadcastChannel, setBroadcastChannel] = useState<"sms" | "email">("sms");
  const [broadcastClassId, setBroadcastClassId] = useState<string>("");
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "users" | "students" | "classes" | "assignments" | "sessions" | "content" | "result-sheet" | "tools" | "scratch-cards" | "broadcast">("dashboard");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", surname: "", first_name: "", middle_name: "", role: "teacher", is_admin: false, phone: "", email: "", address: "" });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [showBatchStaffModal, setShowBatchStaffModal] = useState(false);
  const [batchStaffText, setBatchStaffText] = useState("");
  const [batchStaffLoading, setBatchStaffLoading] = useState(false);
  const usernameEdited = useRef(false);

  // Open the staff edit/add modal pre-filled with a user's details
  const openEditUser = (u: any) => {
    const parts = splitFullName(u.full_name);
    setEditingUser(u);
    setNewUser({
      username: u.username, password: '',
      surname: u.surname || parts.surname, first_name: u.first_name || parts.first_name, middle_name: u.middle_name || parts.middle_name,
      role: u.role, is_admin: !!u.is_admin, phone: u.phone || '', email: u.email || '', address: u.address || ''
    });
    usernameEdited.current = true;
    setShowAddModal(true);
  };

  // Generate a strong random password for a staff member (shown to the admin to share with them)
  const generatePassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#";
    let pw = "";
    for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    setNewUser((prev) => ({ ...prev, password: pw }));
    setShowStaffPassword(true);
  };
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [content, setContent] = useState<Record<string, string>>({});
  const [contentDirty, setContentDirty] = useState(false);
  const [contentPage, setContentPage] = useState<"home" | "admissions" | "curriculum">("home");
  const [savingContent, setSavingContent] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0, totalClasses: 0, totalStudents: 0,
    totalSubjects: 0, totalResults: 0, activeSessions: 0,
  });
  const [showServerStatus, setShowServerStatus] = useState(false);
  const [serverLog, setServerLog] = useState("");
  // Teacher-class assignment state
  const [assignments, setAssignments] = useState<any[]>([]);
  const [allTeachers, setAllTeachers] = useState<User[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({ teacher_id: 0, class_ids: [] as number[] });
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [classForm, setClassForm] = useState({ name: "", name_arabic: "", display_order: 0 });
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [studentForm, setStudentForm] = useState({
    surname: "", first_name: "", middle_name: "", gender: "", date_of_birth: "",
    address: "", parent_name: "", parent_phone: "", passport_photo: "",
    student_password: "student123", class_id: 0
  });
  const [resultSheetConfig, setResultSheetConfig] = useState<Record<string, string>>({});
  const [configDirty, setConfigDirty] = useState(false);

  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({
    open: false, title: "", message: "", onConfirm: () => {},
  });

  // In-place "Edit Mode" — when ON, the landing page shows image "Change" buttons,
  // the Style Inspector and the Style Editor. Only switchable from here (admin).
  const [editModeOn, setEditModeOn] = useState(getEditMode());
  const handleEditModeToggle = (on: boolean) => {
    setEditMode(on);
    setEditModeOn(on);
  };
  const openWebsite = () => window.open("/", "_blank", "noopener,noreferrer");

  // Map teacher id → assigned class names (for showing classes at the front of staff names)
  const classNamesByTeacher = useMemo(() => {
    const map: Record<number, string[]> = {};
    for (const a of assignments) {
      if (!a.teacher_id || !a.class_name) continue;
      if (!map[a.teacher_id]) map[a.teacher_id] = [];
      if (!map[a.teacher_id].includes(a.class_name)) map[a.teacher_id].push(a.class_name);
    }
    return map;
  }, [assignments]);

  // Live preview data for the result-sheet template editor
  const resultSheetPreviewData = useMemo(
    () =>
      buildResultSheetData({
        config: resultSheetConfig,
        studentName: "Ahmed Ali Hassan",
        className: "Primary 1",
        classNameArabic: "الابتدائية الأولى",
        subjects: SAMPLE_SUBJECTS,
        results: SAMPLE_RESULTS,
        term: 1,
        academicYear: "2026/2027",
      }),
    [resultSheetConfig]
  );

  useEffect(() => {
    fetchUsers();
    fetchSessions();
    fetchContent();
    fetchStats();
    fetchServerStatus();
    fetchAssignments();
    fetchAllTeachers();
    fetchResultSheetConfig();
    fetchClasses(); // This also triggers fetchAllStudents after loading
  }, []);

  const fetchClasses = async () => {
    try {
      const res = await fetch("/api/classes", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const classesList = data.classes || [];
      setClasses(classesList);
      // Also fetch all students now that we have classes
      fetchAllStudentsFromList(classesList);
    } catch (err) {
      console.error("Failed to fetch classes:", err);
    }
  };

  const fetchAllStudentsFromList = async (classesList: Class[]) => {
    try {
      const allStuds: any[] = [];
      for (const cls of classesList) {
        const res = await fetch(`/api/classes/${cls.id}/students`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        for (const s of (data.students || [])) {
          allStuds.push({ ...s, class_name: cls.name, class_name_arabic: cls.name_arabic });
        }
      }
      setAllStudents(allStuds);
    } catch (err) {
      console.error("Failed to fetch students:", err);
    }
  };

  const fetchStats = async () => {
    try {
      const [uRes, cRes, sRes, subRes, rRes, sesRes] = await Promise.all([
        fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/classes", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/classes", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/classes", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/sessions", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/session/current", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const uData = await uRes.json();
      const cData = await cRes.json();

      // Get total students count across all classes
      let totalStudents = 0;
      let totalSubjects = 0;
      const classesList = cData.classes || [];
      for (const cls of classesList) {
        try {
          const stRes = await fetch(`/api/classes/${cls.id}/students`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const stData = await stRes.json();
          totalStudents += (stData.students || []).length;

          const subRes = await fetch(`/api/classes/${cls.id}/subjects`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const subData = await subRes.json();
          totalSubjects += (subData.subjects || []).length;
        } catch {}
      }

      const sesData = await sesRes.json();
      const sesList = await (await fetch("/api/sessions", { headers: { Authorization: `Bearer ${token}` } })).json();
      const activeCount = (sesList.sessions || []).filter((s: any) => !s.logout_time).length;

      setStats({
        totalUsers: (uData.users || []).length,
        totalClasses: classesList.length,
        totalStudents,
        totalSubjects,
        totalResults: 0,
        activeSessions: activeCount,
      });
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  };

  const fetchAssignments = async () => {
    try {
      const res = await fetch("/api/admin/teacher-classes", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAssignments(data.assignments || []);
    } catch (err) {
      console.error("Failed to fetch assignments:", err);
    }
  };

  const fetchAllTeachers = async () => {
    try {
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      // All staff can be assigned to classes — including admins (an admin can also teach a class).
      setAllTeachers(data.users || []);
    } catch (err) {
      console.error("Failed to fetch teachers:", err);
    }
  };

  const handleAssignTeacher = async () => {
    if (!assignForm.teacher_id || assignForm.class_ids.length === 0) return;
    const alreadyAssigned = classNamesByTeacher[assignForm.teacher_id] || [];
    const newClasses = classes.filter((c) => assignForm.class_ids.includes(c.id) && !alreadyAssigned.includes(c.name));
    if (newClasses.length === 0) {
      setMessage({ type: "error", text: "The classes you picked are already assigned to this staff member" });
      setTimeout(() => setMessage(null), 4000);
      return;
    }
    let ok = 0;
    let fail = 0;
    const results: string[] = [];
    for (const c of newClasses) {
      try {
        const res = await fetch("/api/admin/teacher-classes", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ teacher_id: assignForm.teacher_id, class_id: c.id }),
        });
        const data = await res.json();
        if (res.ok) {
          ok++;
          results.push(c.name);
        } else {
          fail++;
          results.push(`${c.name} (${data.error || "failed"})`);
        }
      } catch {
        fail++;
        results.push(`${c.name} (connection error)`);
      }
    }
    setMessage({
      type: fail === 0 ? "success" : ok > 0 ? "success" : "error",
      text: fail === 0
        ? `Assigned to ${ok} class${ok !== 1 ? "es" : ""}: ${results.join(", ")}`
        : ok > 0
          ? `Assigned to ${ok} class${ok !== 1 ? "es" : ""} · ${fail} failed: ${results.join(", ")}`
          : `Could not assign: ${results.join(", ")}`,
    });
    setShowAssignModal(false);
    setAssignForm({ teacher_id: 0, class_ids: [] });
    fetchAssignments();
    fetchAllTeachers();
    setTimeout(() => setMessage(null), 5000);
  };

  const handleRemoveAssignment = async (id: number) => {
    setConfirmModal({
      open: true,
      title: "Remove Assignment?",
      message: "This will remove this teacher from the class. The teacher will no longer be able to access this class.",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/teacher-classes/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            setMessage({ type: "success", text: "Assignment removed" });
            fetchAssignments();
          }
        } catch {
          setMessage({ type: "error", text: "Failed to remove" });
        }
        setTimeout(() => setMessage(null), 3000);
        setConfirmModal({ open: false, title: "", message: "", onConfirm: () => {} });
      },
    });
  };

  const fetchServerStatus = async () => {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setServerLog(data.dbReady ? "✅ Database connected" : "❌ Database not ready");
    } catch {
      setServerLog("❌ Server not reachable");
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/sessions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
    }
  };

  const fetchPins = async () => {
    try {
      const res = await fetch("/api/admin/pins", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setPins(data.pins || []);
    } catch (err) {
      console.error("Failed to fetch pins:", err);
    }
  };

  const handleGeneratePins = async () => {
    setPinLoading(true);
    try {
      const res = await fetch("/api/admin/pins/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ count: pinCount, class_id: pinClassId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed to generate PINs" });
        setTimeout(() => setMessage(null), 3000);
        return;
      }
      setMessage({ type: "success", text: data.message });
      setTimeout(() => setMessage(null), 3000);
      fetchPins();
    } catch (err) {
      setMessage({ type: "error", text: "Connection error generating PINs" });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setPinLoading(false);
    }
  };

  const handleDeactivatePin = async (id: number) => {
    try {
      await fetch("/api/admin/pins/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      fetchPins();
    } catch (err) {
      console.error("Failed to deactivate pin:", err);
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim()) {
      setMessage({ type: "error", text: "Message is required" });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    setBroadcastLoading(true);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: broadcastMessage,
          channel: broadcastChannel,
          subject: broadcastSubject,
          class_id: broadcastClassId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Broadcast failed" });
        setTimeout(() => setMessage(null), 3000);
        return;
      }
      setMessage({ type: "success", text: data.message });
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      setMessage({ type: "error", text: "Connection error sending broadcast" });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setBroadcastLoading(false);
    }
  };

  // Update a name field; while the admin hasn't manually edited the username,
  // keep the auto-generated username (staff_<first name>) in sync with the name.
  const updateNameField = (field: "surname" | "first_name" | "middle_name", value: string) => {
    setNewUser((prev) => {
      const next = { ...prev, [field]: value };
      if (!usernameEdited.current) {
        next.username = autoStaffUsername(next.first_name, next.surname, next.middle_name);
      }
      return next;
    });
  };

  const handleBatchAddStaff = async () => {
    const lines = batchStaffText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setBatchStaffLoading(true);
    try {
      // Each line is simply a staff member's full name, e.g. "Ibrahim Mustapha".
      // Username is auto-generated (staff_ibrahim) and password defaults to staff123.
      const users = lines.map((line) => {
        const parts = splitFullName(line);
        return {
          username: "",
          password: "staff123",
          surname: parts.surname,
          first_name: parts.first_name,
          middle_name: parts.middle_name,
          role: "teacher",
        };
      });

      const res = await fetch("/api/admin/users/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ users }),
      });
      const data = await res.json();
      if (res.ok) {
        let msg = data.message;
        if (data.errors && data.errors.length > 0) {
          msg += " — " + data.errors.join("; ");
        }
        setMessage({ type: "success", text: msg });
        setShowBatchStaffModal(false);
        setBatchStaffText("");
        fetchUsers();
        fetchStats();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to batch add" });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error" });
    }
    setBatchStaffLoading(false);
    setTimeout(() => setMessage(null), 4000);
  };

  const handleAddUser = async () => {
    const composedName = composeFullName(newUser);
    if (!composedName) return;
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...newUser,
          full_name: composedName,
          username: newUser.username || autoStaffUsername(newUser.first_name, newUser.surname, newUser.middle_name),
          password: newUser.password || "staff123",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const loginDetails = `Login: ${data.username || newUser.username} / ${data.password || newUser.password || "staff123"}`;
        setMessage({ type: "success", text: `"${composedName}" created! ${loginDetails}` });
        setShowAddModal(false);
        setNewUser({ username: "", password: "staff123", surname: "", first_name: "", middle_name: "", role: "teacher", is_admin: false, phone: "", email: "", address: "" }); usernameEdited.current = false;
        fetchUsers();
        fetchStats();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to create user" });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error" });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    setConfirmModal({
      open: true,
      title: `Delete user "${username}"?`,
      message: "This will permanently remove this user account. They will no longer be able to log in.",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/users/${userId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            setMessage({ type: "success", text: `User "${username}" deleted` });
            fetchUsers();
            fetchStats();
          }
        } catch {
          setMessage({ type: "error", text: "Failed to delete user" });
        }
        setTimeout(() => setMessage(null), 3000);
        setConfirmModal({ open: false, title: "", message: "", onConfirm: () => {} });
      },
    });
  };

  const handleSeedStudents = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/seed/students", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMessage({ type: res.ok ? "success" : "error", text: data.message || data.error || "Seeding failed" });
    } catch {
      setMessage({ type: "error", text: "Connection error" });
    }
    setSeeding(false);
    setTimeout(() => setMessage(null), 4000);
  };

  const fetchContent = async () => {
    try {
      const res = await fetch("/api/admin/content", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      // Merge with defaults so EVERY field shows, even if not yet in the DB.
      // Clean pasted fragment artifacts (<!--StartFragment--> etc.) so already-dirty
      // values stop showing up as raw text; saving afterwards persists the cleanup.
      const saved: Record<string, string> = {};
      for (const [key, val] of Object.entries(data.content || {})) {
        saved[key] = cleanHtmlMarkup(String(val));
      }
      setContent({ ...CONTENT_DEFAULTS, ...saved });
    } catch (err) {
      console.error("Failed to fetch content:", err);
    }
  };

  const handleContentChange = (key: string, value: string) => {
    setContent((prev) => ({ ...prev, [key]: value }));
    setContentDirty(true);
  };

  const handleSaveContent = async () => {
    setSavingContent(true);
    try {
      const res = await fetch("/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ updates: content }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Content saved!" });
        setContentDirty(false);
        // Tell the live site to refresh text & theme colors immediately
        window.dispatchEvent(new CustomEvent("content-saved"));
        // Also set localStorage for cross-tab sync
        try { localStorage.setItem('content-saved', Date.now().toString()); } catch {}
      }
    } catch {}
    setSavingContent(false);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        handleContentChange(key, data.url);
        setMessage({ type: "success", text: "Image uploaded! Save changes below." });
      } else {
        setMessage({ type: "error", text: data.error || "Upload failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Upload connection error" });
    }
    setTimeout(() => setMessage(null), 4000);
  };

  const fetchResultSheetConfig = async () => {
    try {
      const res = await fetch("/api/admin/result-sheet-config", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setResultSheetConfig(data.config || {});
    } catch (err) {
      console.error("Failed to fetch result sheet config:", err);
    }
  };

  const handleSaveResultSheetConfig = async () => {
    setSavingContent(true);
    try {
      const res = await fetch("/api/admin/result-sheet-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ updates: resultSheetConfig }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Result sheet config saved!" });
        setConfigDirty(false);
      }
    } catch {}
    setSavingContent(false);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAddStudent = async () => {
    const composedName = composeFullName(studentForm);
    if (!composedName || !studentForm.class_id) return;
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...studentForm, full_name: composedName }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: `"${composedName}" added!` });
        setShowStudentModal(false);
        setStudentForm({ surname: "", first_name: "", middle_name: "", gender: "", date_of_birth: "", address: "", parent_name: "", parent_phone: "", passport_photo: "", student_password: "student123", class_id: 0 });
        fetchAllStudentsFromList(classes);
        fetchStats();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to add student" });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error" });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleEditStudent = async () => {
    const composedName = composeFullName(studentForm);
    if (!composedName || !editingStudent) return;
    try {
      const res = await fetch(`/api/students/${editingStudent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...studentForm, full_name: composedName }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: `"${composedName}" updated!` });
        setShowStudentModal(false);
        setEditingStudent(null);
        setStudentForm({ surname: "", first_name: "", middle_name: "", gender: "", date_of_birth: "", address: "", parent_name: "", parent_phone: "", passport_photo: "", student_password: "student123", class_id: 0 });
        fetchAllStudentsFromList(classes);
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to update student" });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error" });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDeleteStudent = async (student: any) => {
    setConfirmModal({
      open: true,
      title: `Delete "${student.full_name}"?`,
      message: "This will permanently remove this student and all their results. This action cannot be undone.",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/students/${student.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            setMessage({ type: "success", text: `"${student.full_name}" deleted` });
            fetchAllStudentsFromList(classes);
            fetchStats();
          }
        } catch {
          setMessage({ type: "error", text: "Failed to delete" });
        }
        setTimeout(() => setMessage(null), 3000);
        setConfirmModal({ open: false, title: "", message: "", onConfirm: () => {} });
      },
    });
  };

  const handleEditClass = async () => {
    if (!classForm.name.trim() || !editingClass) return;
    try {
      const res = await fetch(`/api/admin/classes/${editingClass.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(classForm),
      });
      if (res.ok) {
        setMessage({ type: "success", text: `"${classForm.name}" updated!` });
        setEditingClass(null);
        setClassForm({ name: "", name_arabic: "", display_order: 0 });
        fetchClasses();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to update class" });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error" });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleEditUser = async () => {
    if (!editingUser) return;
    const composedName = composeFullName(newUser);
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          full_name: composedName,
          surname: newUser.surname,
          first_name: newUser.first_name,
          middle_name: newUser.middle_name,
          username: newUser.username,
          role: newUser.role,
          is_admin: newUser.is_admin,
          phone: newUser.phone,
          email: newUser.email,
          address: newUser.address,
          password: newUser.password || undefined,
        }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: `User "${composedName}" updated!` });
        setShowAddModal(false);
        setEditingUser(null);
        setNewUser({ username: "", password: "staff123", surname: "", first_name: "", middle_name: "", role: "teacher", is_admin: false, phone: "", email: "", address: "" }); usernameEdited.current = false;
        fetchUsers();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to update user" });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error" });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDeleteAllStudents = async () => {
    setConfirmModal({
      open: true,
      title: "Delete ALL Students?",
      message: "This will permanently delete ALL students across ALL classes and all their results. This action cannot be undone.",
      onConfirm: async () => {
        try {
          const res = await fetch("/api/students/all", {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            setMessage({ type: "success", text: "All students deleted" });
            fetchStats();
          }
        } catch {
          setMessage({ type: "error", text: "Failed to delete" });
        }
        setTimeout(() => setMessage(null), 3000);
        setConfirmModal({ open: false, title: "", message: "", onConfirm: () => {} });
      },
    });
  };

  const handleDeleteAllSubjects = async () => {
    setConfirmModal({
      open: true,
      title: "Delete ALL Subjects?",
      message: "This will permanently delete ALL subjects across ALL classes AND all student results. This action cannot be undone.",
      onConfirm: async () => {
        try {
          const res = await fetch("/api/subjects/all", {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            setMessage({ type: "success", text: "All subjects and results deleted" });
            fetchStats();
          }
        } catch {
          setMessage({ type: "error", text: "Failed to delete subjects" });
        }
        setTimeout(() => setMessage(null), 3000);
        setConfirmModal({ open: false, title: "", message: "", onConfirm: () => {} });
      },
    });
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const getDuration = (login: string, logout: string | null) => {
    const start = new Date(login).getTime();
    const end = logout ? new Date(logout).getTime() : Date.now();
    const diff = Math.floor((end - start) / 1000);
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const refreshCurrentTab = async () => {
    switch (activeTab) {
      case 'dashboard':
        fetchStats();
        fetchServerStatus();
        fetchClasses();
        break;
      case 'users':
        fetchUsers();
        break;
      case 'students':
        fetchAllStudentsFromList(classes);
        fetchStats();
        break;
      case 'classes':
        fetchClasses();
        break;
      case 'assignments':
        fetchAssignments();
        fetchAllTeachers();
        break;
      case 'sessions':
        fetchSessions();
        break;
      case 'content':
        fetchContent();
        break;
      case 'result-sheet':
        fetchResultSheetConfig();
        break;
      case 'scratch-cards':
        fetchPins();
        fetchClasses();
        break;
      case 'broadcast':
        fetchClasses();
        break;
      case 'tools':
        fetchStats();
        fetchServerStatus();
        break;
    }
    setMessage({ type: 'success', text: 'Refreshed!' });
    setTimeout(() => setMessage(null), 1500);
  };

  const tabs = [
    { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
    { id: "users" as const, label: "Staff", icon: Users },
    { id: "students" as const, label: "Students", icon: GraduationCap },
    { id: "classes" as const, label: "Classes", icon: School },
    { id: "assignments" as const, label: "Assignments", icon: UserCheck },
    { id: "sessions" as const, label: "Sessions", icon: Clock },
    { id: "content" as const, label: "Content", icon: FileText },
    { id: "result-sheet" as const, label: "Result Sheet", icon: FileText },
    { id: "scratch-cards" as const, label: "Scratch Cards", icon: Ticket },
    { id: "broadcast" as const, label: "Broadcast", icon: Megaphone },
    { id: "tools" as const, label: "Tools", icon: Database },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-background"
    >
      {/* Header */}
      <div className="bg-primary text-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-serif text-lg font-bold">Admin Dashboard</h1>
              <p className="text-white/70 text-xs">General oversight — Landing Page, Teacher Portal & Student Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* In-place Edit Mode toggle — enables image & style editing on the landing page */}
            <div
              className="flex items-center gap-2 bg-white/10 rounded-lg border border-white/15 px-3 py-1.5"
              title="When ON, the website shows image Change buttons + the Style Inspector/Editor. Turn it off when you're done."
            >
              <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${editModeOn ? "text-secondary-fixed" : "text-white/50"}`}>
                <MousePointerClick className={`w-3.5 h-3.5 ${editModeOn ? "text-secondary-fixed" : "text-white/40"}`} />
                Edit Mode
              </span>
              <div className="flex rounded-md overflow-hidden border border-white/15 text-[10px] font-bold">
                <button
                  onClick={() => handleEditModeToggle(true)}
                  aria-pressed={editModeOn}
                  className={`px-3 py-1.5 transition-colors cursor-pointer ${
                    editModeOn ? "bg-secondary text-primary" : "bg-white/5 text-white/50 hover:text-white hover:bg-white/15"
                  }`}
                >
                  Enable
                </button>
                <button
                  onClick={() => handleEditModeToggle(false)}
                  aria-pressed={!editModeOn}
                  className={`px-3 py-1.5 transition-colors cursor-pointer ${
                    !editModeOn ? "bg-red-500 text-white" : "bg-white/5 text-white/50 hover:text-white hover:bg-white/15"
                  }`}
                >
                  Disable
                </button>
              </div>
            </div>

            {/* Jump straight to the live site (same tab keeps the session) */}
            <button
              onClick={openWebsite}
              className="bg-white/10 hover:bg-white/20 px-2.5 py-1.5 rounded-lg border border-white/15 text-[10px] font-bold text-white/80 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
              title="Open the website in a new tab"
            >
              <ExternalLink className="w-3 h-3" />
              Website
            </button>

            <button
              onClick={() => setShowServerStatus(!showServerStatus)}
              className="bg-secondary-container/20 px-2 py-1.5 rounded-lg border border-secondary/20 text-[10px] font-mono text-secondary-fixed cursor-pointer hover:bg-secondary-container/30 transition-colors"
              title="Server Status"
            >
              <Terminal className="w-3.5 h-3.5 inline mr-1" />
              {serverLog.includes("✅") ? "Online" : "Check"}
            </button>
            <div className="bg-secondary-container/20 px-3 py-1.5 rounded-lg border border-secondary/20">
              <span className="text-xs font-semibold text-secondary-fixed">{user.full_name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Mode status banner — shown while enabled */}
      <AnimatePresence>
        {editModeOn && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-50 border-b border-amber-200 overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-6 py-2.5 flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-amber-800 font-medium flex items-center gap-2">
                <MousePointerClick className="w-4 h-4 text-amber-600 shrink-0" />
                Edit Mode is <strong>ON</strong> — open the website to change images &amp; styles in place. Disable it when you&apos;re done.
              </p>
              <button
                onClick={openWebsite}
                className="text-xs font-bold text-amber-900 bg-amber-200/70 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                Open Website <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Server Status Bar */}
      <AnimatePresence>
        {showServerStatus && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-gray-900 text-green-400 overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-6 py-3">
              <div className="flex items-center gap-4 text-[11px] font-mono">
                <span>Status: {serverLog}</span>
                <span>|</span>
                <span>Port: 3000</span>
                <span>|</span>
                <span>DB: PostgreSQL</span>
                <button
                  onClick={() => { fetchServerStatus(); fetchStats(); }}
                  className="ml-auto text-green-300 hover:text-white cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Message */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`px-6 py-3 text-xs font-medium flex items-center gap-2 ${
              message.type === "success" ? "bg-green-50 text-green-700 border-b border-green-200" : "bg-red-50 text-red-700 border-b border-red-200"
            }`}
          >
            {message.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="border-b border-primary/5 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex gap-0 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "border-secondary text-secondary"
                    : "border-transparent text-on-surface-variant hover:text-primary hover:border-primary/20"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* ======= DASHBOARD TAB ======= */}
        {activeTab === "dashboard" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-xl font-bold text-primary">System Overview</h2>
              <button
                onClick={refreshCurrentTab}
                className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-primary px-3 py-2 rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              {[
                { label: "Users", value: stats.totalUsers, icon: Users, color: "text-blue-600 bg-blue-50", tab: "users" as const },
                { label: "Classes", value: stats.totalClasses, icon: School, color: "text-purple-600 bg-purple-50", tab: "classes" as const },
                { label: "Students", value: stats.totalStudents, icon: GraduationCap, color: "text-green-600 bg-green-50", tab: "students" as const },
                { label: "Subjects", value: stats.totalSubjects, icon: BookOpen, color: "text-amber-600 bg-amber-50", tab: "classes" as const },
                { label: "Active Now", value: stats.activeSessions, icon: Clock, color: "text-rose-600 bg-rose-50", tab: "sessions" as const },
                { label: "Classes", value: stats.totalClasses, icon: Globe, color: "text-teal-600 bg-teal-50", tab: "classes" as const },
              ].map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <motion.button
                    key={stat.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => setActiveTab(stat.tab)}
                    whileHover={{ y: -3 }}
                    className="bg-white border border-primary/5 rounded-xl p-4 hover:shadow-lg hover:border-secondary/30 transition-shadow text-left cursor-pointer group"
                    title={`Open ${stat.label} →`}
                  >
                    <div className={`w-9 h-9 rounded-lg ${stat.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <p className="text-2xl font-bold text-primary">{stat.value}</p>
                    <p className="text-[10px] text-on-surface-variant mt-0.5 group-hover:text-secondary font-semibold transition-colors">{stat.label} →</p>
                  </motion.button>
                );
              })}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
              <div className="bg-white border border-primary/5 rounded-xl p-5 shadow-xs">
                <h3 className="font-serif font-bold text-primary text-sm mb-2 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-secondary" /> Landing Page
                </h3>
                <p className="text-xs text-on-surface-variant mb-3">
                  Edit site content, announcements, and hero section text.
                </p>
                <button
                  onClick={() => setActiveTab("content")}
                  className="text-xs text-secondary font-semibold hover:text-primary cursor-pointer flex items-center gap-1"
                >
                  Manage Content →
                </button>
              </div>
              <div className="bg-white border border-primary/5 rounded-xl p-5 shadow-xs">
                <h3 className="font-serif font-bold text-primary text-sm mb-2 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-secondary" /> Teacher Portal
                </h3>
                <p className="text-xs text-on-surface-variant mb-3">
                  Manage teacher accounts, monitor sessions, and oversee class data.
                </p>
                <button
                  onClick={() => setActiveTab("users")}
                  className="text-xs text-secondary font-semibold hover:text-primary cursor-pointer flex items-center gap-1"
                >
                  Manage Teachers →
                </button>
              </div>
              <div className="bg-white border border-primary/5 rounded-xl p-5 shadow-xs">
                <h3 className="font-serif font-bold text-primary text-sm mb-2 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-secondary" /> Student Portal
                </h3>
                <p className="text-xs text-on-surface-variant mb-3">
                  Seed student data, manage results, and oversee student access.
                </p>
                <button
                  onClick={() => setActiveTab("tools")}
                  className="text-xs text-secondary font-semibold hover:text-primary cursor-pointer flex items-center gap-1"
                >
                  Data Tools →
                </button>
              </div>
            </div>

            {/* Classes Overview */}
            <div className="bg-white border border-primary/5 rounded-xl overflow-hidden shadow-xs">
              <div className="px-5 py-4 border-b border-primary/5">
                <h3 className="font-serif font-bold text-primary text-sm">Classes Overview</h3>
              </div>
              <div className="divide-y divide-primary/5">
                {classes.map((cls) => (
                  <div key={cls.id} className="flex items-center justify-between px-5 py-3 hover:bg-surface-container-low transition-colors">
                    <div>
                      <span className="text-sm font-semibold text-primary">{cls.name}</span>
                      <span className="text-sm text-on-surface-variant/60 mr-2" dir="rtl"> · {cls.name_arabic}</span>
                    </div>
                    <span className="text-[10px] text-on-surface-variant">Order: {cls.display_order}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ======= USERS TAB ======= */}
        {activeTab === "users" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-xl font-bold text-primary">Manage Users{users.length > 0 && ` (${users.length})`}</h2>
              <div className="flex items-center gap-2">
                <button onClick={refreshCurrentTab}
                  className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-primary px-3 py-2 rounded-lg hover:bg-surface-container transition-colors cursor-pointer">
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
                <button
                  onClick={() => { setEditingUser(null); setNewUser({ username: "", password: "staff123", surname: "", first_name: "", middle_name: "", role: "teacher", is_admin: false, phone: "", email: "", address: "" }); usernameEdited.current = false; setShowAddModal(true); }}
                  className="flex items-center gap-1.5 text-xs bg-primary text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-primary-container transition-colors cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  Add Staff
                </button>
                <button
                  onClick={() => setShowBatchStaffModal(true)}
                  className="flex items-center gap-1.5 text-xs bg-white border border-primary/20 text-primary px-4 py-2.5 rounded-lg font-semibold hover:bg-surface-container transition-colors cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  Batch Add
                </button>
              </div>
            </div>

            <div className="bg-white border border-primary/5 rounded-xl overflow-hidden shadow-xs">
              <div className="divide-y divide-primary/5">
                {users.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => openEditUser(u)}
                    className="flex items-center justify-between px-5 py-4 hover:bg-surface-container-low transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div>
                        <p className="text-sm font-semibold text-primary group-hover:text-secondary transition-colors flex items-center gap-1.5 flex-wrap">
                          {u.full_name}
                          {(u.role === "admin" || Boolean(u.is_admin)) && (
                            <span className="text-[9px] font-bold uppercase tracking-wider bg-secondary-fixed/20 text-secondary border border-secondary/20 px-2 py-0.5 rounded-full">Admin</span>
                          )}
                          {(classNamesByTeacher[u.id] || []).map((cn) => (
                            <span key={cn} className="text-[9px] font-bold uppercase tracking-wide bg-secondary/10 text-secondary border border-secondary/25 px-1.5 py-0.5 rounded-full whitespace-nowrap" title={`Assigned class: ${cn}`}>{cn}</span>
                          ))}
                        </p>
                        <p className="text-[10px] text-on-surface-variant/60">
                          @{u.username} · {u.role}
                          {u.phone ? ` · ${u.phone}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-secondary font-semibold opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline">Click to view / edit bio</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditUser(u); }}
                        className="p-1.5 text-on-surface-variant/50 hover:text-secondary hover:bg-secondary/5 rounded-lg transition-colors cursor-pointer"
                        title="Edit staff details"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {u.id !== user.id && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteUser(u.id, u.username); }}
                          className="p-1.5 text-on-surface-variant/50 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ======= STUDENTS TAB ======= */}
        {activeTab === "students" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-serif text-xl font-bold text-primary">Manage Students</h2>
                <p className="text-xs text-on-surface-variant mt-1">{allStudents.length} student{allStudents.length !== 1 ? 's' : ''} across {classes.length} class{classes.length !== 1 ? 'es' : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={refreshCurrentTab}
                  className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-primary px-3 py-2 rounded-lg hover:bg-surface-container transition-colors cursor-pointer">
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
                <button
                  onClick={() => { setEditingStudent(null); setStudentForm({ surname: "", first_name: "", middle_name: "", gender: "", date_of_birth: "", address: "", parent_name: "", parent_phone: "", passport_photo: "", student_password: "student123", class_id: classes[0]?.id || 0 }); setShowStudentModal(true); }}
                  className="flex items-center gap-1.5 text-xs bg-primary text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-primary-container transition-colors cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  Register Student
                </button>
              </div>
            </div>

            {/* Total summary card */}
            {allStudents.length > 0 && (
              <div className="bg-gradient-to-r from-primary to-primary-container rounded-xl p-5 mb-6 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{allStudents.length}</p>
                    <p className="text-xs text-white/80">Total Students Enrolled</p>
                  </div>
                  <div className="ml-auto flex gap-3">
                    {classes.map((cls) => {
                      const count = allStudents.filter((s: any) => s.class_id === cls.id).length;
                      return (
                        <div key={cls.id} className="text-center bg-white/10 rounded-lg px-3 py-1.5">
                          <p className="text-sm font-bold">{count}</p>
                          <p className="text-[9px] text-white/70 whitespace-nowrap">{cls.name}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Students grouped by class */}
            {allStudents.length === 0 ? (
              <div className="bg-white border border-primary/5 rounded-xl overflow-hidden shadow-xs">
                <div className="text-center py-16">
                  <GraduationCap className="w-12 h-12 text-on-surface-variant/20 mx-auto mb-3" />
                  <p className="text-sm text-on-surface-variant">No students registered yet</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {classes.map((cls) => {
                  const classStudents = allStudents
                    .filter((s: any) => s.class_id === cls.id)
                    .sort((a: any, b: any) => (a.full_name || '').localeCompare(b.full_name || ''));
                  if (classStudents.length === 0) return null;
                  return (
                    <div key={cls.id} className="bg-white border border-primary/5 rounded-xl overflow-hidden shadow-xs">
                      <div className="flex items-center justify-between px-5 py-3 bg-surface-container-low border-b border-primary/5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <School className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-primary">{cls.name}</p>
                            {cls.name_arabic && <p className="text-[10px] text-on-surface-variant/60" dir="rtl">{cls.name_arabic}</p>}
                          </div>
                        </div>
                        <span className="text-xs font-bold text-secondary bg-secondary/5 border border-secondary/20 px-3 py-1 rounded-full">
                          {classStudents.length} student{classStudents.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="divide-y divide-primary/5">
                        {classStudents.map((s: any) => (
                          <div
                            key={s.id}
                            onClick={() => {
                              const parts = splitFullName(s.full_name);
                              setEditingStudent(s);
                              setStudentForm({
                                surname: s.surname || parts.surname, first_name: s.first_name || parts.first_name, middle_name: s.middle_name || parts.middle_name,
                                gender: s.gender || '',
                                date_of_birth: s.date_of_birth || '', address: s.address || '',
                                parent_name: s.parent_name || '', parent_phone: s.parent_phone || '',
                                passport_photo: s.passport_photo || '', student_password: s.student_password || 'student123',
                                class_id: s.class_id
                              });
                              setShowStudentModal(true);
                            }}
                            className="flex items-center justify-between px-5 py-3.5 hover:bg-surface-container-low transition-colors cursor-pointer group"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-primary">{(s.full_name || '?').charAt(0).toUpperCase()}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-primary truncate group-hover:text-secondary transition-colors">{s.full_name}</p>
                                <p className="text-[10px] text-on-surface-variant/60 truncate">
                                  {s.gender ? `${s.gender}` : ''}{s.parent_name ? ` · Parent: ${s.parent_name}` : ''}{s.parent_phone ? ` · ${s.parent_phone}` : ''}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] text-secondary font-semibold opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline">Click to view / edit bio</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingStudent(s); setShowStudentModal(true); }}
                                className="p-1.5 text-on-surface-variant/50 hover:text-secondary hover:bg-secondary/5 rounded-lg transition-colors cursor-pointer"
                                title="Edit student details"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteStudent(s); }}
                                className="p-1.5 text-on-surface-variant/50 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete student"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ======= CLASSES TAB ======= */}
        {activeTab === "classes" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-xl font-bold text-primary">Manage Classes</h2>
              <button onClick={refreshCurrentTab}
                className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-primary px-3 py-2 rounded-lg hover:bg-surface-container transition-colors cursor-pointer">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>
            <div className="bg-white border border-primary/5 rounded-xl overflow-hidden shadow-xs">
              <div className="divide-y divide-primary/5">
                {classes.map((cls) => (
                  <div key={cls.id} className="flex items-center justify-between px-5 py-4 hover:bg-surface-container-low transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center">
                        <School className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-primary">{cls.name}</p>
                        {cls.name_arabic && <p className="text-[10px] text-on-surface-variant/60" dir="rtl">{cls.name_arabic}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-on-surface-variant/50">Order: {cls.display_order}</span>
                      <button
                        onClick={() => {
                          setEditingClass(cls);
                          setClassForm({ name: cls.name, name_arabic: cls.name_arabic || '', display_order: cls.display_order });
                        }}
                        className="p-1.5 text-on-surface-variant/50 hover:text-secondary hover:bg-secondary/5 rounded-lg transition-colors cursor-pointer"
                        title="Edit class"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ======= ASSIGNMENTS TAB ======= */}
        {activeTab === "assignments" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-serif text-xl font-bold text-primary">Teacher-Class Assignments</h2>
                <p className="text-xs text-on-surface-variant mt-1">Assign teachers to specific classes. Teachers can only access their assigned classes.</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={refreshCurrentTab}
                  className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-primary px-3 py-2 rounded-lg hover:bg-surface-container transition-colors cursor-pointer">
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="flex items-center gap-1.5 text-xs bg-primary text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-primary-container transition-colors cursor-pointer"
                >
                  <UserCheck className="w-4 h-4" />
                  Assign Staff
                </button>
              </div>
            </div>

            {/* Assignments List */}
            <div className="bg-white border border-primary/5 rounded-xl overflow-hidden shadow-xs">
              {assignments.length === 0 ? (
                <div className="text-center py-16">
                  <BookMarked className="w-12 h-12 text-on-surface-variant/20 mx-auto mb-3" />
                  <p className="text-sm text-on-surface-variant">No assignments yet</p>
                  <p className="text-[10px] text-on-surface-variant/50 mt-1">Assign teachers to classes to get started</p>
                </div>
              ) : (
                <div className="divide-y divide-primary/5">
                  {(() => {
                    // Group assignments by teacher so each staff member appears only once,
                    // with all their class badges shown before the name.
                    const grouped = new Map<number, any[]>();
                    assignments.forEach((a: any) => {
                      if (!grouped.has(a.teacher_id)) grouped.set(a.teacher_id, []);
                      grouped.get(a.teacher_id)!.push(a);
                    });
                    return [...grouped.entries()].map(([teacherId, rows]) => (
                      <div key={teacherId} className="px-5 py-4 hover:bg-surface-container-low transition-colors">
                        <p className="text-sm font-semibold text-primary flex items-center gap-1.5 flex-wrap">
                          {rows[0].teacher_name}
                          {rows.map((a: any) => (
                            <span key={a.id} className="text-[9px] font-bold uppercase tracking-wide bg-secondary/10 text-secondary border border-secondary/25 px-1.5 py-0.5 rounded-full whitespace-nowrap" title={`Assigned class: ${a.class_name}`}>{a.class_name}</span>
                          ))}
                        </p>
                        <div className="mt-2 flex flex-col gap-1">
                          {rows.map((a: any) => (
                            <div key={`row-${a.id}`} className="flex items-center justify-between gap-3 group/row">
                              <p className="text-[10px] text-on-surface-variant/60">
                                Class: {a.class_name} {a.class_name_arabic ? `· ${a.class_name_arabic}` : ''}
                              </p>
                              <button
                                onClick={() => handleRemoveAssignment(a.id)}
                                className="p-1 text-on-surface-variant/40 hover:text-red-500 hover:bg-red-50 rounded transition-colors cursor-pointer shrink-0"
                                title={`Remove ${rows[0].teacher_name} from ${a.class_name}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="bg-white border border-primary/5 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-primary">{assignments.length}</p>
                <p className="text-[10px] text-on-surface-variant">Total Assignments</p>
              </div>
              <div className="bg-white border border-primary/5 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-primary">{new Set(assignments.map((a: any) => a.teacher_id)).size}</p>
                <p className="text-[10px] text-on-surface-variant">Assigned Teachers</p>
              </div>
              <div className="bg-white border border-primary/5 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-primary">{new Set(assignments.map((a: any) => a.class_id)).size}</p>
                <p className="text-[10px] text-on-surface-variant">Covered Classes</p>
              </div>
            </div>
          </div>
        )}

        {/* ======= SESSIONS TAB ======= */}
        {activeTab === "sessions" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-xl font-bold text-primary">Session Logs</h2>
              <button onClick={refreshCurrentTab}
                className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-primary px-3 py-2 rounded-lg hover:bg-surface-container transition-colors cursor-pointer">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>
            {sessions.length === 0 ? (
              <div className="text-center py-16">
                <Clock className="w-12 h-12 text-on-surface-variant/20 mx-auto mb-3" />
                <p className="text-sm text-on-surface-variant">No sessions recorded yet</p>
              </div>
            ) : (
              <div className="bg-white border border-primary/5 rounded-xl overflow-hidden shadow-xs">
                <div className="divide-y divide-primary/5">
                  {sessions.map((s) => (
                    <div key={s.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-surface-container-low transition-colors text-sm">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-semibold text-primary text-xs">{s.full_name}</p>
                          <p className="text-[10px] text-on-surface-variant/60">{formatDateTime(s.login_time)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-on-surface-variant">Duration: {getDuration(s.login_time, s.logout_time)}</p>
                        {s.logout_time ? (
                          <p className="text-[10px] text-on-surface-variant/50">Ended: {formatDateTime(s.logout_time)}</p>
                        ) : (
                          <p className="text-[10px] text-green-600 font-medium">Active</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======= CONTENT TAB ======= */}
        {activeTab === "content" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-serif text-xl font-bold text-primary">Site Content</h2>
                <p className="text-xs text-on-surface-variant mt-1">Edit any page — style text with fonts, colors, sizes, tables & images</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={refreshCurrentTab}
                  className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-primary px-3 py-2 rounded-lg hover:bg-surface-container transition-colors cursor-pointer">
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
                {contentDirty && (
                  <button onClick={handleSaveContent} disabled={savingContent}
                    className="flex items-center gap-1.5 text-xs bg-primary text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-primary-container transition-colors cursor-pointer disabled:opacity-50">
                    <Save className="w-4 h-4" />
                    {savingContent ? "Saving..." : "Save Changes"}
                  </button>
                )}
              </div>
            </div>

            {/* Page selector */}
            <div className="flex gap-2 mb-6 flex-wrap">
              {([
                { id: "home", label: "Home" },
                { id: "admissions", label: "Admissions" },
                { id: "curriculum", label: "Madrasah Activities" },
              ] as const).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setContentPage(p.id)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    contentPage === p.id
                      ? "bg-primary text-white shadow"
                      : "bg-white border border-primary/10 text-on-surface-variant hover:bg-surface-container"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Grouped editable fields */}
            {PAGE_GROUP_MAP[contentPage].map((group) => {
              const fields = CONTENT_FIELDS.filter((f) => f.group === group);
              if (fields.length === 0) return null;
              return (
                <div key={group} className="mb-8">
                  <h3 className="font-serif font-bold text-primary text-sm mb-3 flex items-center gap-2">
                    {group === "Text & Announcements" && <FileText className="w-4 h-4 text-secondary" />}
                    {group === "Colors & Theme" && <Palette className="w-4 h-4 text-secondary" />}
                    {group === "Typography & Styling" && <Type className="w-4 h-4 text-secondary" />}
                    {group === "Images" && <ImageIcon className="w-4 h-4 text-secondary" />}
                    {group === "Contact" && <Globe className="w-4 h-4 text-secondary" />}
                    {group === "Header & Footer" && <School className="w-4 h-4 text-secondary" />}
                    {group.includes("Page") && <LayoutTemplate className="w-4 h-4 text-secondary" />}
                    {(group === "Section Spacing" || group === "Admissions Spacing" || group === "Madrasah Spacing") && <Ruler className="w-4 h-4 text-secondary" />}
                    {group}
                  </h3>
                  <div className="bg-white border border-primary/5 rounded-xl shadow-xs overflow-hidden">
                    <div className="divide-y divide-border-light">
                      {fields.map((field) => {
                        const value = content[field.key] ?? "";
                        return (
                          <div key={field.key} className="px-5 py-4">
                            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                              {field.label}
                            </label>

                            {field.type === "text" && field.key === "font_heading" && (
                              <FontPicker
                                value={value}
                                onChange={(v) => handleContentChange(field.key, v)}
                                category="serif"
                              />
                            )}
                            {field.type === "text" && field.key === "font_body" && (
                              <FontPicker
                                value={value}
                                onChange={(v) => handleContentChange(field.key, v)}
                                category="sans-serif"
                              />
                            )}
                            {field.type === "text" && field.key === "font_arabic" && (
                              <FontPicker
                                value={value}
                                onChange={(v) => handleContentChange(field.key, v)}
                                category="arabic"
                              />
                            )}
                            {field.type === "text" && field.key !== "font_heading" && field.key !== "font_body" && field.key !== "font_arabic" && (
                              <input
                                type="text"
                                value={value}
                                onChange={(e) => handleContentChange(field.key, e.target.value)}
                                className="w-full bg-surface border border-border p-3 text-sm rounded-lg focus:outline-none focus:border-secondary transition-colors"
                              />
                            )}

                            {field.type === "textarea" && (
                              <textarea
                                value={value}
                                onChange={(e) => handleContentChange(field.key, e.target.value)}
                                rows={3}
                                className="w-full bg-surface border border-border p-3 text-sm rounded-lg focus:outline-none focus:border-secondary transition-colors"
                              />
                            )}

                            {field.type === "html" && (
                              <RichTextEditor
                                value={value}
                                onChange={(html) => handleContentChange(field.key, html)}
                                token={token}
                                minHeight={150}
                              />
                            )}

                            {field.type === "color" && (
                              <div className="flex items-center gap-3">
                                <input
                                  type="color"
                                  value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
                                  onChange={(e) => handleContentChange(field.key, e.target.value)}
                                  className="w-12 h-10 rounded-lg border border-border cursor-pointer bg-transparent"
                                  title={field.label}
                                />
                                <input
                                  type="text"
                                  value={value}
                                  onChange={(e) => handleContentChange(field.key, e.target.value)}
                                  placeholder="#0B6E4F"
                                  className="w-36 bg-surface border border-border p-3 text-sm rounded-lg font-mono focus:outline-none focus:border-secondary transition-colors"
                                />
                                <span className="text-[10px] text-on-surface-variant/60">Applies across the whole site</span>
                              </div>
                            )}

                            {field.type === "image" && (
                              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                                <div className="w-24 h-24 bg-surface rounded-xl border border-border overflow-hidden flex items-center justify-center p-1 shrink-0">
                                  {value ? (
                                    <img
                                      src={normalizeImageUrl(value)}
                                      alt={field.label}
                                      className="max-w-full max-h-full object-contain"
                                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                  ) : (
                                    <ImageIcon className="w-6 h-6 text-on-surface-variant/30" />
                                  )}
                                </div>
                                <div className="flex-1 w-full space-y-2">
                                  <label className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg text-xs font-semibold cursor-pointer hover:bg-primary-hover transition-colors">
                                    <input
                                      type="file"
                                      accept="image/png,image/jpeg,image/gif,image/webp"
                                      className="hidden"
                                      onChange={(e) => handleImageUpload(e, field.key)}
                                    />
                                    <Upload className="w-3.5 h-3.5" />
                                    Upload {field.label}
                                  </label>
                                  <input
                                    type="text"
                                    value={value}
                                    onChange={(e) => handleContentChange(field.key, e.target.value)}
                                    placeholder="https://... or /uploads/..."
                                    className="w-full bg-surface border border-border p-3 text-sm rounded-lg focus:outline-none focus:border-secondary transition-colors"
                                  />
                                </div>
                              </div>
                            )}

                            {field.type === "spacing" && (
                              <div className="flex items-center gap-3">
                                <input
                                  type="range"
                                  min="0"
                                  max="200"
                                  step="4"
                                  value={parseInt(value) || 0}
                                  onChange={(e) => handleContentChange(field.key, e.target.value)}
                                  className="flex-1 h-2 bg-surface-container rounded-lg appearance-none cursor-pointer accent-secondary"
                                  title={`${value}px`}
                                />
                                <div className="flex items-center gap-1.5 bg-surface border border-border rounded-lg overflow-hidden">
                                  <input
                                    type="number"
                                    min="0"
                                    max="500"
                                    value={value}
                                    onChange={(e) => handleContentChange(field.key, e.target.value)}
                                    className="w-20 bg-transparent border-none p-2.5 text-sm font-mono text-center focus:outline-none"
                                  />
                                  <span className="text-[10px] text-on-surface-variant pr-2">px</span>
                                </div>
                                <button
                                  onClick={() => handleContentChange(field.key, CONTENT_DEFAULTS[field.key] || "0")}
                                  className="text-[10px] text-on-surface-variant/50 hover:text-secondary underline cursor-pointer whitespace-nowrap"
                                  title="Reset to default"
                                >
                                  Reset
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ======= RESULT SHEET TAB ======= */}
        {activeTab === "result-sheet" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-serif text-xl font-bold text-primary">Result Sheet Configuration</h2>
                <p className="text-xs text-on-surface-variant mt-1">Design the sheet end-to-end — layout, tables, fonts, colors and Arabic (right-to-left)</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={refreshCurrentTab}
                  className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-primary px-3 py-2 rounded-lg hover:bg-surface-container transition-colors cursor-pointer">
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
                {configDirty && (
                  <button onClick={handleSaveResultSheetConfig} disabled={savingContent}
                    className="flex items-center gap-1.5 text-xs bg-primary text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-primary-container transition-colors cursor-pointer disabled:opacity-50">
                    <Save className="w-4 h-4" />
                    {savingContent ? "Saving..." : "Save Config"}
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-6">
              {/* Template Design Section */}
              <div className="bg-white border border-primary/5 rounded-xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <h3 className="font-serif font-bold text-primary text-sm flex items-center gap-2">
                    <LayoutTemplate className="w-4 h-4 text-secondary" />
                    Result Sheet Template (Full Design)
                  </h3>
                  <button
                    onClick={() => {
                      setResultSheetConfig({ ...resultSheetConfig, result_sheet_template: RESULT_SHEET_DEFAULTS.result_sheet_template });
                      setConfigDirty(true);
                    }}
                    className="text-[10px] text-on-surface-variant hover:text-secondary underline cursor-pointer"
                  >
                    Reset to default template
                  </button>
                </div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed mb-3">
                  Build the entire sheet here — headings, tables, borders, colors, fonts and Arabic text (use the{" "}
                  <LanguagesIcon className="w-3 h-3 inline text-secondary" /> RTL button for right-to-left). Click a green
                  chip below the toolbar to insert a live data field; the saved values in the sections below fill them in.
                </p>
                <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 leading-relaxed">
                  💡 For images in the PDF, use the editor's <b>Upload</b> button (or /uploads/… URLs) — external
                  Google/Drive images will show on screen but stay blank in the exported PDF.
                </p>
                <RichTextEditor
                  value={resultSheetConfig.result_sheet_template || RESULT_SHEET_DEFAULTS.result_sheet_template}
                  onChange={(html) => {
                    setResultSheetConfig({ ...resultSheetConfig, result_sheet_template: html });
                    setConfigDirty(true);
                  }}
                  token={token}
                  placeholders={RESULT_SHEET_PLACEHOLDERS}
                  minHeight={340}
                />
              </div>

              {/* Live Preview */}
              <div className="bg-white border border-primary/5 rounded-xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-serif font-bold text-primary text-sm flex items-center gap-2">
                    <Eye className="w-4 h-4 text-secondary" />
                    Live Preview
                  </h3>
                  <span className="text-[10px] text-on-surface-variant">Sample student shown; updates as you type</span>
                </div>
                <div className="bg-surface border border-border rounded-xl p-4 overflow-auto max-h-[650px]">
                  <div className="bg-white shadow-lg rounded-sm p-5 mx-auto" style={{ maxWidth: 794 }}>
                    <div
                      className="rich-html"
                      dangerouslySetInnerHTML={{
                        __html: renderResultSheetTemplate(
                          resultSheetConfig.result_sheet_template || RESULT_SHEET_DEFAULTS.result_sheet_template,
                          resultSheetPreviewData
                        ),
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* School Info Section */}
              <div className="bg-white border border-primary/5 rounded-xl p-5 shadow-xs">
                <h3 className="font-serif font-bold text-primary text-sm mb-4">School Information</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">School Name (English)</label>
                    <input type="text" value={resultSheetConfig['school_name_en'] || 'AL-MUSTAFA ACADEMY FOR QUR\'AN MEMORIZATION & ISLAMIC STUDIES'}
                      onChange={(e) => { setResultSheetConfig({...resultSheetConfig, 'school_name_en': e.target.value}); setConfigDirty(true); }}
                      className="w-full bg-surface border border-border p-3 text-sm rounded-lg focus:outline-none focus:border-secondary" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">School Name (Arabic)</label>
                    <input type="text" dir="rtl" value={resultSheetConfig['school_name_ar'] || 'مدرسة المصطفى لتحفيظ القرآن والدراسات الإسلامية'}
                      onChange={(e) => { setResultSheetConfig({...resultSheetConfig, 'school_name_ar': e.target.value}); setConfigDirty(true); }}
                      className="w-full bg-surface border border-border p-3 text-sm rounded-lg focus:outline-none focus:border-secondary" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Location</label>
                    <input type="text" value={resultSheetConfig['school_location'] || 'ILORIN, NIGERIA'}
                      onChange={(e) => { setResultSheetConfig({...resultSheetConfig, 'school_location': e.target.value}); setConfigDirty(true); }}
                      className="w-full bg-surface border border-border p-3 text-sm rounded-lg focus:outline-none focus:border-secondary" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Contact Info</label>
                    <input type="text" value={resultSheetConfig['school_contact'] || 'Tel: 08037525855 | Address: I/C Khaleel-ur-Rahman Group of Schools, 25, Sabo-Line Road, Opposite Saw-Mill, Ilorin'}
                      onChange={(e) => { setResultSheetConfig({...resultSheetConfig, 'school_contact': e.target.value}); setConfigDirty(true); }}
                      className="w-full bg-surface border border-border p-3 text-sm rounded-lg focus:outline-none focus:border-secondary" />
                  </div>
                </div>
              </div>
              {/* Grading Scale Section */}
              <div className="bg-white border border-primary/5 rounded-xl p-5 shadow-xs">
                <h3 className="font-serif font-bold text-primary text-sm mb-4">Grading Scale</h3>
                <div className="space-y-2">
                  {[
                    { key: 'grade_a', label: 'Grade A (Excellent)', default: '70 - 100 | Excellent | ممتاز' },
                    { key: 'grade_b', label: 'Grade B (Very Good)', default: '60 - 69 | Very Good | جيد جداً' },
                    { key: 'grade_c', label: 'Grade C (Good)', default: '50 - 59 | Credit / Good | جيد' },
                    { key: 'grade_p', label: 'Grade P (Pass)', default: '40 - 49 | Pass | مقبول' },
                    { key: 'grade_f', label: 'Grade F (Fail)', default: '0 - 39 | Fail | راسب' },
                  ].map(g => (
                    <div key={g.key} className="flex items-center gap-3">
                      <label className="text-xs text-on-surface-variant w-40 shrink-0">{g.label}</label>
                      <input type="text" value={resultSheetConfig[g.key] || g.default}
                        onChange={(e) => { setResultSheetConfig({...resultSheetConfig, [g.key]: e.target.value}); setConfigDirty(true); }}
                        className="flex-1 bg-surface border border-border p-2.5 text-sm rounded-lg focus:outline-none focus:border-secondary" />
                    </div>
                  ))}
                </div>
              </div>
              {/* Footer & Remarks Section */}
              <div className="bg-white border border-primary/5 rounded-xl p-5 shadow-xs">
                <h3 className="font-serif font-bold text-primary text-sm mb-4">Footer & Remarks</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Footer Text (English)</label>
                    <input type="text" value={resultSheetConfig['footer_en'] || "AL-MUSTAFA ACADEMY \u2014 Where the Qur'an and Sunnah Shape Character and Excellence"}
                      onChange={(e) => { setResultSheetConfig({...resultSheetConfig, 'footer_en': e.target.value}); setConfigDirty(true); }}
                      className="w-full bg-surface border border-border p-3 text-sm rounded-lg focus:outline-none focus:border-secondary" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Footer Text (Arabic)</label>
                    <input type="text" dir="rtl" value={resultSheetConfig['footer_ar'] || 'أكاديمية المصطفى — جسر بين التقاليد والتميز'}
                      onChange={(e) => { setResultSheetConfig({...resultSheetConfig, 'footer_ar': e.target.value}); setConfigDirty(true); }}
                      className="w-full bg-surface border border-border p-3 text-sm rounded-lg focus:outline-none focus:border-secondary" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Result Title</label>
                    <input type="text" value={resultSheetConfig['result_title'] || 'STUDENT RESULT SHEET'}
                      onChange={(e) => { setResultSheetConfig({...resultSheetConfig, 'result_title': e.target.value}); setConfigDirty(true); }}
                      className="w-full bg-surface border border-border p-3 text-sm rounded-lg focus:outline-none focus:border-secondary" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======= TOOLS TAB ======= */}
        {activeTab === "tools" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-xl font-bold text-primary">Data & System Tools</h2>
              <button onClick={refreshCurrentTab}
                className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-primary px-3 py-2 rounded-lg hover:bg-surface-container transition-colors cursor-pointer">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Seed Students */}
              <div className="bg-white border border-primary/5 rounded-xl p-6 shadow-xs">
                <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center mb-4">
                  <Sprout className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-serif font-bold text-primary text-base mb-2">Seed Sample Students</h3>
                <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">
                  Add 30 sample students (5 per class) to quickly test the teacher and student portals.
                </p>
                <button
                  onClick={handleSeedStudents}
                  disabled={seeding}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {seeding ? "Seeding..." : <><Sprout className="w-4 h-4" /> Seed 30 Students</>}
                </button>
              </div>

              {/* Delete All Students */}
              <div className="bg-white border border-red-200 rounded-xl p-6 shadow-xs">
                <div className="w-12 h-12 rounded-lg bg-red-50 flex items-center justify-center mb-4">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="font-serif font-bold text-primary text-base mb-2">Delete All Students</h3>
                <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">
                  Remove all students and their results. This action cannot be undone.
                </p>
                <button
                  onClick={handleDeleteAllStudents}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete All Students
                </button>
              </div>

              {/* Delete All Subjects */}
              <div className="bg-white border border-red-200 rounded-xl p-6 shadow-xs">
                <div className="w-12 h-12 rounded-lg bg-red-50 flex items-center justify-center mb-4">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="font-serif font-bold text-primary text-base mb-2">Delete All Subjects</h3>
                <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">
                  Remove all subjects across all classes AND all student results. This action cannot be undone.
                </p>
                <button
                  onClick={handleDeleteAllSubjects}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete All Subjects
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======= SCRATCH CARDS TAB ======= */}
        {activeTab === "scratch-cards" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-serif text-xl font-bold text-primary">Scratch Card PINs</h2>
                <p className="text-xs text-on-surface-variant mt-1">
                  Generate single-use PINs for the student portal. Parents enter their surname + the PIN from the card.
                </p>
              </div>
              <button onClick={refreshCurrentTab}
                className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-primary px-3 py-2 rounded-lg hover:bg-surface-container transition-colors cursor-pointer">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            {/* Generate card */}
            <div className="bg-white border border-primary/5 rounded-xl p-6 shadow-xs mb-6">
              <div className="w-12 h-12 rounded-lg bg-secondary-fixed/20 flex items-center justify-center mb-4">
                <Ticket className="w-6 h-6 text-secondary" />
              </div>
              <h3 className="font-serif font-bold text-primary text-base mb-1">Generate New PINs</h3>
              <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">
                Each PIN works once. Optionally restrict a batch to one class — the card will only log in students of that class.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={pinCount}
                    onChange={(e) => setPinCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-28 bg-surface border border-primary/20 px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:border-secondary transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Restrict to class (optional)</label>
                  <select
                    value={pinClassId}
                    onChange={(e) => setPinClassId(e.target.value)}
                    className="w-56 bg-surface border border-primary/20 px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:border-secondary transition-all"
                  >
                    <option value="">Any class</option>
                    {classes.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <button onClick={handleGeneratePins} disabled={pinLoading}
                  className="flex items-center gap-1.5 bg-primary hover:bg-primary-container text-white px-5 py-2.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer">
                  {pinLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {pinLoading ? "Generating..." : "Generate PINs"}
                </button>
              </div>
              {pins.filter((p) => p.active).length === 0 && pins.length > 0 && (
                <p className="text-[10px] text-amber-600 mt-3">All generated PINs have been used or deactivated.</p>
              )}
            </div>

            {/* PIN list */}
            <div className="bg-white border border-primary/5 rounded-xl shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-primary/5 flex items-center justify-between">
                <h3 className="font-serif font-bold text-primary text-sm">All PINs ({pins.length})</h3>
                <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Active: {pins.filter((p) => p.active).length}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Used: {pins.filter((p) => !p.active).length}</span>
                </div>
              </div>
              {pins.length === 0 ? (
                <div className="text-center py-12">
                  <KeyRound className="w-10 h-10 text-on-surface-variant/20 mx-auto mb-2" />
                  <p className="text-sm text-on-surface-variant">No PINs generated yet</p>
                </div>
              ) : (
                <div className="divide-y divide-primary/5 max-h-[28rem] overflow-y-auto">
                  {pins.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-surface-container-low transition-colors">
                      <div className="flex items-center gap-4">
                        <span className={`font-mono font-bold tracking-wider px-2.5 py-1 rounded-lg text-xs ${p.active ? "bg-green-50 text-green-700 border border-green-200" : "bg-surface-container text-on-surface-variant/50 line-through border border-primary/5"}`}>
                          {p.pin}
                        </span>
                        <span className="text-[10px] text-on-surface-variant/60">{p.class_name || "Any class"}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {p.active ? (
                          <button onClick={() => handleDeactivatePin(p.id)}
                            className="text-[10px] text-red-600 hover:text-red-700 border border-red-200 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer">
                            Deactivate
                          </button>
                        ) : (
                          <span className="text-[10px] text-on-surface-variant/50">Used</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======= BROADCAST TAB ======= */}
        {activeTab === "broadcast" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-serif text-xl font-bold text-primary">Notification Broadcast</h2>
                <p className="text-xs text-on-surface-variant mt-1">
                  Send an announcement to parents by SMS (Termii) or to staff by email. Messages cost per recipient.
                </p>
              </div>
              <button onClick={refreshCurrentTab}
                className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-primary px-3 py-2 rounded-lg hover:bg-surface-container transition-colors cursor-pointer">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            <div className="bg-white border border-primary/5 rounded-xl p-6 shadow-xs max-w-2xl">
              <div className="w-12 h-12 rounded-lg bg-secondary-fixed/20 flex items-center justify-center mb-4">
                <Megaphone className="w-6 h-6 text-secondary" />
              </div>

              <div className="mb-4">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Channel</label>
                <div className="flex gap-2">
                  {([
                    { id: "sms", label: "SMS to Parents", desc: "Termii · parent phone numbers" },
                    { id: "email", label: "Email to Staff", desc: "SMTP · staff email addresses" },
                  ] as const).map((ch) => (
                    <button key={ch.id} onClick={() => setBroadcastChannel(ch.id)}
                      className={`flex-1 text-left px-4 py-3 rounded-lg border text-xs transition-all cursor-pointer ${
                        broadcastChannel === ch.id ? "border-secondary bg-secondary-fixed/10 text-primary" : "border-primary/10 bg-surface text-on-surface-variant hover:border-primary/30"
                      }`}>
                      <p className="font-bold">{ch.label}</p>
                      <p className="text-[10px] mt-0.5 opacity-70">{ch.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {broadcastChannel === "sms" && (
                <div className="mb-4">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Restrict to class (optional)</label>
                  <select
                    value={broadcastClassId}
                    onChange={(e) => setBroadcastClassId(e.target.value)}
                    className="w-full bg-surface border border-primary/20 px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:border-secondary transition-all"
                  >
                    <option value="">All classes (every parent with a phone number)</option>
                    {classes.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {broadcastChannel === "email" && (
                <div className="mb-4">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Subject</label>
                  <input
                    type="text"
                    value={broadcastSubject}
                    onChange={(e) => setBroadcastSubject(e.target.value)}
                    className="w-full bg-surface border border-primary/20 px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:border-secondary transition-all"
                  />
                </div>
              )}

              <div className="mb-4">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Message</label>
                <textarea
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  rows={5}
                  placeholder={broadcastChannel === "sms" ? "e.g. Assalamu Alaikum parents, the 1st Term Examination runs 17–25 October. Ensure your ward is present. — Al Mustafa Academy" : "Type the announcement..."}
                  className="w-full bg-surface border border-primary/20 px-3 py-3 text-sm rounded-lg focus:outline-none focus:border-secondary transition-all resize-y"
                />
                {broadcastChannel === "sms" && (
                  <p className="text-[10px] text-on-surface-variant/60 mt-1">
                    SMS is charged per recipient (~{Math.ceil(broadcastMessage.length / 160)} SMS credit{broadcastMessage.length > 160 ? "s" : ""} per phone for this message).
                  </p>
                )}
              </div>

              <button onClick={handleSendBroadcast} disabled={broadcastLoading}
                className="flex items-center gap-1.5 bg-primary hover:bg-primary-container text-white px-5 py-2.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer">
                {broadcastLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {broadcastLoading ? "Sending..." : "Send Broadcast"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Assign Teacher Modal */}
      <AnimatePresence>
        {showAssignModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAssignModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs cursor-pointer"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl border border-primary/10 max-w-md w-full p-6 shadow-2xl relative z-10"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-lg font-bold text-primary">Assign Staff to Classes</h3>
                <button onClick={() => setShowAssignModal(false)} className="p-1 hover:bg-surface-container rounded-lg cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Select Staff Member</label>
                  <select
                    value={assignForm.teacher_id}
                    onChange={(e) => setAssignForm({ ...assignForm, teacher_id: parseInt(e.target.value), class_ids: [] })}
                    className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary"
                  >
                    <option value={0}>-- Choose a staff member --</option>
                    {allTeachers.map((t: User) => {
                      const assigned = classNamesByTeacher[t.id] || [];
                      const badge = t.role === "admin" || t.is_admin ? " · Admin" : "";
                      return (
                        <option key={t.id} value={t.id}>
                          {t.full_name} ({t.username}){badge} — {assigned.length > 0 ? assigned.join(', ') : 'No classes yet'}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                    Select Classes {assignForm.class_ids.length > 0 ? `(${assignForm.class_ids.length} selected)` : ''} — tick one or more
                  </label>
                  <div className="border border-primary/20 rounded-lg divide-y divide-primary/5 max-h-64 overflow-y-auto">
                    {classes.map((c: Class) => {
                      const isAssigned = !!assignForm.teacher_id && (classNamesByTeacher[assignForm.teacher_id] || []).includes(c.name);
                      const checked = assignForm.class_ids.includes(c.id) || isAssigned;
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer text-sm ${isAssigned ? "opacity-50 cursor-not-allowed" : "hover:bg-surface-container transition-colors"}`}
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-secondary cursor-pointer"
                            checked={checked}
                            disabled={isAssigned}
                            onChange={(e) =>
                              setAssignForm((prev) => ({
                                ...prev,
                                class_ids: e.target.checked
                                  ? [...prev.class_ids, c.id]
                                  : prev.class_ids.filter((id) => id !== c.id),
                              }))
                            }
                          />
                          <span className="font-semibold text-primary flex-1">{c.name}</span>
                          {c.name_arabic && <span className="text-[10px] text-on-surface-variant/60" dir="rtl">{c.name_arabic}</span>}
                          {isAssigned && <span className="text-[9px] font-bold text-secondary bg-secondary/5 border border-secondary/20 px-1.5 py-0.5 rounded-full whitespace-nowrap">Assigned ✓</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={() => setShowAssignModal(false)}
                  className="flex-1 border border-primary/20 text-on-surface-variant py-2.5 rounded-lg text-xs font-semibold cursor-pointer hover:bg-surface-container">Cancel</button>
                <button onClick={handleAssignTeacher}
                  disabled={!assignForm.teacher_id || assignForm.class_ids.length === 0}
                  className="flex-1 bg-primary text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-primary-container disabled:opacity-50 flex items-center justify-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5" /> Assign{assignForm.class_ids.length > 0 ? ` (${assignForm.class_ids.length})` : ''}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Batch Add Staff Modal */}
      <AnimatePresence>
        {showBatchStaffModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBatchStaffModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs cursor-pointer"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl border border-primary/10 max-w-lg w-full p-6 shadow-2xl relative z-10"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-lg font-bold text-primary">Batch Add Staff</h3>
                <button onClick={() => setShowBatchStaffModal(false)} className="p-1 hover:bg-surface-container rounded-lg cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mb-3">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">One staff name per line</label>
                <textarea
                  value={batchStaffText}
                  onChange={(e) => setBatchStaffText(e.target.value)}
                  rows={10}
                  placeholder={`Ibrahim Mustapha\nFatima Omar\nAli Hassan`}
                  className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary transition-colors font-mono text-xs"
                  autoFocus
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-4">
                <p className="text-[10px] text-blue-700 leading-relaxed">
                  Just type each staff member's <b>full name</b> on its own line. Username is auto-generated from the name (e.g. <b>staff_ibrahim</b>) and the default password is <b>staff123</b>. Role defaults to <b>teacher</b>.
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowBatchStaffModal(false)}
                  className="flex-1 border border-primary/20 text-on-surface-variant py-2.5 rounded-lg text-xs font-semibold cursor-pointer hover:bg-surface-container">Cancel</button>
                <button onClick={handleBatchAddStaff} disabled={batchStaffLoading || !batchStaffText.trim()}
                  className="flex-1 bg-primary text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-primary-container disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {batchStaffLoading ? "Adding..." : <><Copy className="w-3.5 h-3.5" /> Add All ({batchStaffText.split("\n").filter(Boolean).length})</>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit User Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowAddModal(false); setEditingUser(null); setNewUser({ username: "", password: "staff123", surname: "", first_name: "", middle_name: "", role: "teacher", is_admin: false, phone: "", email: "", address: "" }); usernameEdited.current = false; }}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs cursor-pointer"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl border border-primary/10 max-w-md w-full p-6 shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-lg font-bold text-primary">{editingUser ? 'Edit Staff' : 'Add New Staff'}</h3>
                <button onClick={() => { setShowAddModal(false); setEditingUser(null); setNewUser({ username: "", password: "staff123", surname: "", first_name: "", middle_name: "", role: "teacher", is_admin: false, phone: "", email: "", address: "" }); usernameEdited.current = false; }} className="p-1 hover:bg-surface-container rounded-lg cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Surname *</label>
                    <input type="text" value={newUser.surname} onChange={(e) => updateNameField("surname", e.target.value)}
                      placeholder="Mustapha"
                      className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">First Name *</label>
                    <input type="text" value={newUser.first_name} onChange={(e) => updateNameField("first_name", e.target.value)}
                      placeholder="Ibrahim"
                      className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Middle Name</label>
                    <input type="text" value={newUser.middle_name} onChange={(e) => setNewUser({ ...newUser, middle_name: e.target.value })}
                      placeholder="Optional"
                      className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Username (optional)</label>
                  <input type="text" value={newUser.username} onChange={(e) => { usernameEdited.current = true; setNewUser({ ...newUser, username: e.target.value }); }}
                    placeholder={editingUser ? "Existing username" : "Auto: staff_ibrahim"}
                    className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary" />
                  {!editingUser && (
                    <p className="text-[10px] text-on-surface-variant/50 mt-1">Leave blank to auto-generate from the name (e.g. <b>staff_ibrahim</b>).</p>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
                      Password {editingUser ? '(leave blank to keep current)' : ''}
                    </label>
                    <button
                      type="button"
                      onClick={generatePassword}
                      className="text-[10px] font-semibold text-secondary hover:text-primary underline cursor-pointer"
                    >
                      Generate password
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showStaffPassword ? "text" : "password"}
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      placeholder={editingUser ? 'Leave blank to keep current' : 'Default: staff123'}
                      className="w-full bg-surface border border-primary/20 p-3 pr-10 text-sm rounded-lg focus:outline-none focus:border-secondary font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowStaffPassword(!showStaffPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 hover:text-primary cursor-pointer"
                      title={showStaffPassword ? "Hide password" : "Show password"}
                    >
                      {showStaffPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-on-surface-variant/50 mt-1.5">
                    🔒 Passwords are stored safely (hashed). If a staff member forgets theirs, set a new one here, copy it, and share it with them.
                  </p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Primary Role</label>
                  <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary">
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <label className="flex items-center gap-2.5 bg-surface border border-primary/20 rounded-lg p-3 cursor-pointer hover:border-secondary/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={newUser.is_admin}
                    onChange={(e) => setNewUser({ ...newUser, is_admin: e.target.checked })}
                    className="w-4 h-4 accent-secondary cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-primary">Grant admin privileges</span>
                  <span className="text-[10px] text-on-surface-variant/60 ml-auto">Can manage the whole system</span>
                </label>
                <p className="text-[10px] text-on-surface-variant/50 -mt-1 leading-relaxed">
                  💡 One person can be <b>both an Admin and a Teacher</b> — keep the role as <b>Teacher</b>, tick this box, then use <b>Assign Staff</b> to put them in their classes. (Choosing the Admin role already grants admin privileges.)
                </p>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Phone</label>
                  <input type="tel" value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                    placeholder="080375255855"
                    className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Email</label>
                  <input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="ibrahim@example.com"
                    className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Address</label>
                  <input type="text" value={newUser.address} onChange={(e) => setNewUser({ ...newUser, address: e.target.value })}
                    placeholder="25, Sabo-Line Road, Ilorin"
                    className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary" />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={() => { setShowAddModal(false); setEditingUser(null); setNewUser({ username: "", password: "staff123", surname: "", first_name: "", middle_name: "", role: "teacher", is_admin: false, phone: "", email: "", address: "" }); usernameEdited.current = false; }}
                  className="flex-1 border border-primary/20 text-on-surface-variant py-2.5 rounded-lg text-xs font-semibold cursor-pointer hover:bg-surface-container">Cancel</button>
                <button onClick={editingUser ? handleEditUser : handleAddUser}
                  disabled={!composeFullName(newUser)}
                  className="flex-1 bg-primary text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-primary-container disabled:opacity-50 flex items-center justify-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5" /> {editingUser ? 'Update Staff' : 'Add Staff'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Student Registration/Edit Modal */}
      <AnimatePresence>
        {showStudentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowStudentModal(false); setEditingStudent(null); }}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs cursor-pointer"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl border border-primary/10 max-w-lg w-full p-6 shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-lg font-bold text-primary">{editingStudent ? 'Edit Student Details' : 'Register New Student'}</h3>
                <button onClick={() => { setShowStudentModal(false); setEditingStudent(null); }} className="p-1 hover:bg-surface-container rounded-lg cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Surname *</label>
                    <input type="text" value={studentForm.surname} onChange={(e) => setStudentForm({ ...studentForm, surname: e.target.value })}
                      placeholder="Mustapha"
                      className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">First Name *</label>
                    <input type="text" value={studentForm.first_name} onChange={(e) => setStudentForm({ ...studentForm, first_name: e.target.value })}
                      placeholder="Ibrahim"
                      className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Middle Name</label>
                    <input type="text" value={studentForm.middle_name} onChange={(e) => setStudentForm({ ...studentForm, middle_name: e.target.value })}
                      placeholder="Optional"
                      className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Gender</label>
                    <select value={studentForm.gender} onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value })}
                      className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary">
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Date of Birth</label>
                    <input type="date" value={studentForm.date_of_birth} onChange={(e) => setStudentForm({ ...studentForm, date_of_birth: e.target.value })}
                      className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Class *</label>
                    <select value={studentForm.class_id} onChange={(e) => setStudentForm({ ...studentForm, class_id: parseInt(e.target.value) })}
                      className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary">
                      <option value={0}>-- Select Class --</option>
                      {classes.map((c: Class) => (
                        <option key={c.id} value={c.id}>{c.name} {c.name_arabic ? `(${c.name_arabic})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Address</label>
                    <input type="text" value={studentForm.address} onChange={(e) => setStudentForm({ ...studentForm, address: e.target.value })}
                      placeholder="25, Sabo-Line Road, Ilorin"
                      className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Parent / Guardian Name</label>
                    <input type="text" value={studentForm.parent_name} onChange={(e) => setStudentForm({ ...studentForm, parent_name: e.target.value })}
                      placeholder="Dr Ibrahim Mustapha"
                      className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Parent Phone</label>
                    <input type="tel" value={studentForm.parent_phone} onChange={(e) => setStudentForm({ ...studentForm, parent_phone: e.target.value })}
                      placeholder="080375255855"
                      className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Passport Photo URL</label>
                    <input type="text" value={studentForm.passport_photo} onChange={(e) => setStudentForm({ ...studentForm, passport_photo: e.target.value })}
                      placeholder="https://..."
                      className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Login Password</label>
                    <input type="text" value={studentForm.student_password} onChange={(e) => setStudentForm({ ...studentForm, student_password: e.target.value })}
                      placeholder="student123"
                      className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary" />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={() => { setShowStudentModal(false); setEditingStudent(null); }}
                  className="flex-1 border border-primary/20 text-on-surface-variant py-2.5 rounded-lg text-xs font-semibold cursor-pointer hover:bg-surface-container">Cancel</button>
                <button onClick={editingStudent ? handleEditStudent : handleAddStudent}
                  disabled={!composeFullName(studentForm) || !studentForm.class_id}
                  className="flex-1 bg-primary text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-primary-container disabled:opacity-50 flex items-center justify-center gap-1.5">
                  <Save className="w-3.5 h-3.5" /> {editingStudent ? 'Update Student' : 'Register Student'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Class Modal */}
      <AnimatePresence>
        {editingClass && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setEditingClass(null); setClassForm({ name: "", name_arabic: "", display_order: 0 }); }}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs cursor-pointer"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl border border-primary/10 max-w-md w-full p-6 shadow-2xl relative z-10"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-lg font-bold text-primary">Edit Class</h3>
                <button onClick={() => { setEditingClass(null); setClassForm({ name: "", name_arabic: "", display_order: 0 }); }} className="p-1 hover:bg-surface-container rounded-lg cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Class Name (English)</label>
                  <input type="text" value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                    className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Class Name (Arabic)</label>
                  <input type="text" dir="rtl" value={classForm.name_arabic} onChange={(e) => setClassForm({ ...classForm, name_arabic: e.target.value })}
                    className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Display Order</label>
                  <input type="number" value={classForm.display_order} onChange={(e) => setClassForm({ ...classForm, display_order: parseInt(e.target.value) || 0 })}
                    className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary" />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={() => { setEditingClass(null); setClassForm({ name: "", name_arabic: "", display_order: 0 }); }}
                  className="flex-1 border border-primary/20 text-on-surface-variant py-2.5 rounded-lg text-xs font-semibold cursor-pointer hover:bg-surface-container">Cancel</button>
                <button onClick={handleEditClass}
                  disabled={!classForm.name.trim()}
                  className="flex-1 bg-primary text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-primary-container disabled:opacity-50 flex items-center justify-center gap-1.5">
                  <Save className="w-3.5 h-3.5" /> Save
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Modal */}
      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Delete"
        cancelText="Cancel"
        danger
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ open: false, title: "", message: "", onConfirm: () => {} })}
      />
    </motion.div>
  );
}
