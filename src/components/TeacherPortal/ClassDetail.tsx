import { useState, useEffect, useRef, ReactNode, CSSProperties } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft, UserPlus, Edit2, Trash2, FileText, BookOpen,
  Plus, X, Search, Users, Copy, CheckCircle, AlertCircle,
  BookText, Save, Move, CalendarCheck, Printer
} from "lucide-react";
import { Class, Student, Subject } from "../../types";
import { useSiteContent } from "../../lib/siteContent";
import ReportSheet from "./ReportSheet";

// Letterhead details printed on the attendance sheet
const SCHOOL_LETTERHEAD = {
  school_name_en: "AL-MUSTAFA ACADEMY FOR QUR'AN MEMORIZATION & ISLAMIC STUDIES",
  school_name_ar: "مدرسة المصطفى لتحفيظ القرآن والدراسات الإسلامية",
  school_location: "ILORIN, NIGERIA",
  school_contact:
    "Tel: 08037525855 | Address: I/C Khaleel-ur-Rahman Group of Schools, 25, Sabo-Line Road, Opposite Saw-Mill, Ilorin",
};

// --- Printable attendance sheet helpers ---
const cellStyle: CSSProperties = {
  border: "1px solid #000",
  padding: "6px 8px",
  color: "#000",
  background: "#fff",
  verticalAlign: "middle",
  overflowWrap: "anywhere",
};

// "2026-10-28" -> "28 October 2026" (local, no timezone shifting of the day)
function formatSheetDate(iso: string) {
  const [y, m, d] = (iso || "").split("-").map(Number);
  if (!y || !m || !d) return iso || "";
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function formatSheetDay(iso: string) {
  const [y, m, d] = (iso || "").split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "long" });
}

interface ClassDetailProps {
  classData: Class;
  token: string;
  userRole?: string;
  onBack: () => void;
  onSubjects: () => void;
  onEditStudent?: (student: Student) => void;
}

export default function ClassDetail({ classData, token, userRole, onBack, onSubjects, onEditStudent }: ClassDetailProps) {
  const isAdmin = userRole === 'admin';
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [allClasses, setAllClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState<Student | null>(null);
  const [moveTargetClass, setMoveTargetClass] = useState<number>(0);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentName, setStudentName] = useState("");
  const [studentBiodata, setStudentBiodata] = useState({
    surname: "", first_name: "", middle_name: "", gender: "",
    date_of_birth: "", address: "", parent_name: "", parent_phone: "",
    passport_photo: "", student_password: ""
  });
  const [batchNames, setBatchNames] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showSubjectsPanel, setShowSubjectsPanel] = useState(false);
  const [editSubject, setEditSubject] = useState<Subject | null>(null);
  const [subjectForm, setSubjectForm] = useState({ name: "", book_name: "", book_author: "" });
  const [savingSubject, setSavingSubject] = useState(false);
  const [reportStudent, setReportStudent] = useState<Student | null>(null);

  // Attendance state
  const [showAttendance, setShowAttendance] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split("T")[0]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({});
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const siteContent = useSiteContent();
  const attendanceSheetRef = useRef<HTMLDivElement>(null);

  const printAttendanceSheet = () => {
    if (!showAttendance) setShowAttendance(true);
    // The sheet lives outside #root (portal), so hiding #root prints it alone.
    document.body.classList.add("printing-attendance");
    const cleanup = () => {
      document.body.classList.remove("printing-attendance");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    // Give the sheet a frame to lay out before the print dialog snapshots it.
    setTimeout(() => {
      window.print();
      setTimeout(cleanup, 1000);
    }, 120);
  };

  useEffect(() => {
    fetchStudents();
    fetchSubjects();
    fetchAllClasses();
  }, []);

  const fetchStudents = async () => {
    try {
      const res = await fetch(`/api/classes/${classData.id}/students`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setStudents(data.students || []);
    } catch (err) {
      console.error("Failed to fetch students:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjects = async () => {
    try {
      const res = await fetch(`/api/classes/${classData.id}/subjects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSubjects(data.subjects || []);
    } catch (err) {
      console.error("Failed to fetch subjects:", err);
    }
  };

  const fetchAllClasses = async () => {
    try {
      const res = await fetch("/api/classes", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAllClasses((data.classes || []).filter((c: Class) => c.id !== classData.id));
    } catch (err) {
      console.error("Failed to fetch classes:", err);
    }
  };

  const handleAddStudent = async () => {
    if (!studentName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ class_id: classData.id, full_name: studentName.trim() }),
      });
      if (res.ok) {
        setShowAddModal(false);
        setStudentName("");
        setMessage({ type: "success", text: `"${studentName.trim()}" added!` });
        fetchStudents();
      }
    } catch { /* ignore */ }
    setSaving(false);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleBatchAdd = async () => {
    const names = batchNames.split("\n").map((n) => n.trim()).filter(Boolean);
    if (names.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/students/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ class_id: classData.id, names }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowBatchModal(false);
        setBatchNames("");
        setMessage({ type: "success", text: data.message });
        fetchStudents();
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch { /* ignore */ }
    setSaving(false);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleEditStudent = async () => {
    if (!editingStudent) return;
    // Build composed name from parts or fallback to studentName
    const composedName = [studentBiodata.first_name, studentBiodata.middle_name, studentBiodata.surname]
      .map(p => (p || '').trim()).filter(Boolean).join(' ').trim() || studentName.trim();
    if (!composedName) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/students/${editingStudent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          full_name: composedName,
          surname: studentBiodata.surname || null,
          first_name: studentBiodata.first_name || null,
          middle_name: studentBiodata.middle_name || null,
          gender: studentBiodata.gender || null,
          date_of_birth: studentBiodata.date_of_birth || null,
          address: studentBiodata.address || null,
          parent_name: studentBiodata.parent_name || null,
          parent_phone: studentBiodata.parent_phone || null,
          passport_photo: studentBiodata.passport_photo || null,
          student_password: studentBiodata.student_password || 'student123',
          class_id: classData.id
        }),
      });
      if (res.ok) {
        setEditingStudent(null);
        setStudentName("");
        setStudentBiodata({ surname: "", first_name: "", middle_name: "", gender: "", date_of_birth: "", address: "", parent_name: "", parent_phone: "", passport_photo: "", student_password: "" });
        fetchStudents();
        setMessage({ type: "success", text: `"${composedName}" updated!` });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleDeleteStudent = async (student: Student) => {
    if (!confirm(`Delete "${student.full_name}"?`)) return;
    try {
      const res = await fetch(`/api/students/${student.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) fetchStudents();
    } catch { /* ignore */ }
  };

  const handleEditSubject = async () => {
    if (!subjectForm.name.trim() || !editSubject) return;
    setSavingSubject(true);
    try {
      const res = await fetch(`/api/subjects/${editSubject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(subjectForm),
      });
      if (res.ok) {
        setEditSubject(null);
        setSubjectForm({ name: "", book_name: "", book_author: "" });
        setMessage({ type: "success", text: "Subject updated!" });
        fetchSubjects();
      }
    } catch { /* ignore */ }
    setSavingSubject(false);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDeleteSubject = async (subject: Subject) => {
    if (!confirm(`Delete subject "${subject.name}"?`)) return;
    try {
      const res = await fetch(`/api/subjects/${subject.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setMessage({ type: "success", text: `"${subject.name}" deleted` });
        fetchSubjects();
      }
    } catch { /* ignore */ }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleMoveStudent = async () => {
    if (!showMoveModal || !moveTargetClass) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/students/${showMoveModal.id}/class`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ class_id: moveTargetClass }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: `"${showMoveModal.full_name}" moved successfully` });
        setShowMoveModal(null);
        setMoveTargetClass(0);
        fetchStudents();
      }
    } catch { /* ignore */ }
    setSaving(false);
    setTimeout(() => setMessage(null), 3000);
  };

  const fetchAttendance = async (date: string) => {
    setAttendanceLoading(true);
    try {
      const res = await fetch(`/api/classes/${classData.id}/attendance?date=${date}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const map: Record<string, string> = {};
      for (const rec of data.records || []) map[`${rec.student_id}`] = rec.status;
      setAttendanceMap(map);
    } catch (err) {
      console.error("Failed to fetch attendance:", err);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const saveAttendance = async () => {
    setAttendanceSaving(true);
    try {
      const entries = students.map((s) => ({
        studentId: s.id,
        status: attendanceMap[`${s.id}`] || "present",
      }));
      const res = await fetch(`/api/classes/${classData.id}/attendance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ date: attendanceDate, entries }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: `Attendance saved for ${attendanceDate}` });
      } else {
        setMessage({ type: "error", text: "Failed to save attendance" });
      }
    } catch (err) {
      console.error("Attendance save error:", err);
      setMessage({ type: "error", text: "Failed to save attendance" });
    }
    setAttendanceSaving(false);
    setTimeout(() => setMessage(null), 3000);
  };

  const toggleAttendance = () => {
    const next = !showAttendance;
    setShowAttendance(next);
    if (next) fetchAttendance(attendanceDate);
  };

  const filteredStudents = students.filter((s) =>
    s.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Totals printed under the attendance register (same default the save uses)
  const counts = { present: 0, late: 0, absent: 0 };
  for (const s of students) {
    const st = (attendanceMap[`${s.id}`] || "present") as keyof typeof counts;
    if (counts[st] !== undefined) counts[st]++;
  }

  // Safe render: skip if the selected student row lost its id, so the report
  // sheet never blanks out on the admin portal.
  if (!reportStudent || reportStudent.id === undefined || reportStudent.id === null) {
    return null;
  }
  return (
    <ReportSheet
      studentId={reportStudent.id}
      token={token}
      mode="edit"
      initialTerm={1}
      onBack={() => setReportStudent(null)}
    />
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-serif text-lg font-bold">{classData.name}</h1>
              {classData.name_arabic && <p className="text-white/70 text-xs" dir="rtl">{classData.name_arabic}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleAttendance}
              className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition-colors cursor-pointer">
              <CalendarCheck className="w-4 h-4 text-secondary-fixed" />
              <span className="hidden sm:inline">{showAttendance ? "Hide Attendance" : "Attendance"}</span>
            </button>
            <button onClick={() => setShowSubjectsPanel(!showSubjectsPanel)}
              className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition-colors cursor-pointer">
              <BookOpen className="w-4 h-4 text-secondary-fixed" />
              <span className="hidden sm:inline">{showSubjectsPanel ? "Hide Subjects" : "Subjects"}</span>
            </button>
            {isAdmin && (
              <>
                <button onClick={() => setShowBatchModal(true)}
                  className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition-colors cursor-pointer">
                  <Copy className="w-4 h-4 text-secondary-fixed" />
                  <span className="hidden sm:inline">Batch</span>
                </button>
                <button onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-1.5 text-xs bg-secondary-container text-on-secondary-container hover:bg-secondary hover:text-white px-3 py-2 rounded-lg transition-colors cursor-pointer font-semibold">
                  <UserPlus className="w-4 h-4" />
                  <span className="hidden sm:inline">Add</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Status Message */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`px-6 py-2.5 text-xs font-medium flex items-center gap-2 ${
              message.type === "success" ? "bg-green-50 text-green-700 border-b border-green-200" : "bg-red-50 text-red-700 border-b border-red-200"
            }`}
          >
            {message.type === "success" ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inline Subjects Panel */}
      <AnimatePresence>
        {showSubjectsPanel && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-primary/5 bg-surface-container-low overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-serif font-bold text-primary text-sm flex items-center gap-2">
                  <BookText className="w-4 h-4" />
                  Subjects & Books
                </h3>
                <button onClick={onSubjects} className="text-xs text-secondary hover:text-primary font-semibold cursor-pointer">Manage All →</button>
              </div>
              {subjects.length === 0 ? (
                <p className="text-xs text-on-surface-variant/60">No subjects added yet</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {subjects.map((subj) => (
                    <div key={subj.id} className="bg-white border border-primary/5 rounded-lg p-3 flex items-center justify-between group hover:border-secondary/20 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-primary truncate">{subj.name}</p>
                        {subj.book_name && <p className="text-[10px] text-on-surface-variant/60 truncate">{subj.book_name}</p>}
                      </div>
                      <div className="flex items-center gap-1 ml-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditSubject(subj); setSubjectForm({ name: subj.name, book_name: subj.book_name || "", book_author: subj.book_author || "" }); }}
                          className="p-1 text-on-surface-variant/50 hover:text-secondary transition-colors cursor-pointer">
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleDeleteSubject(subj)}
                          className="p-1 text-on-surface-variant/50 hover:text-red-500 transition-colors cursor-pointer">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inline Attendance Panel */}
      <AnimatePresence>
        {showAttendance && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-primary/5 bg-surface-container-low overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="font-serif font-bold text-primary text-sm flex items-center gap-2">
                  <CalendarCheck className="w-4 h-4 text-secondary" />
                  Attendance
                </h3>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={attendanceDate}
                    max={new Date().toISOString().split("T")[0]}
                    onChange={(e) => {
                      setAttendanceDate(e.target.value);
                      if (e.target.value) fetchAttendance(e.target.value);
                    }}
                    className="bg-white border border-primary/10 px-3 py-1.5 text-xs rounded-lg focus:outline-none focus:border-secondary transition-colors"
                  />
                  <button
                    onClick={() => {
                      const map: Record<string, string> = {};
                      students.forEach((s) => { map[`${s.id}`] = "present"; });
                      setAttendanceMap(map);
                    }}
                    className="text-xs text-secondary hover:text-primary font-semibold cursor-pointer px-2 py-1.5"
                  >
                    Mark all present
                  </button>
                  <button
                    onClick={printAttendanceSheet}
                    disabled={students.length === 0}
                    className="flex items-center gap-1.5 text-xs border border-primary/15 text-primary hover:bg-primary hover:text-white px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50 font-semibold"
                    title="Print the attendance sheet"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print Sheet
                  </button>
                  <button
                    onClick={saveAttendance}
                    disabled={attendanceSaving}
                    className="flex items-center gap-1.5 text-xs bg-primary text-white hover:bg-primary-hover px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50 font-semibold"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {attendanceSaving ? "Saving..." : "Save Attendance"}
                  </button>
                </div>
              </div>

              {attendanceLoading ? (
                <p className="text-xs text-on-surface-variant py-6 text-center">Loading roster…</p>
              ) : students.length === 0 ? (
                <p className="text-xs text-on-surface-variant/60 py-4">No students in this class yet</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {students.map((s) => {
                    const status = attendanceMap[`${s.id}`] || "present";
                    return (
                      <div key={s.id} className="bg-white border border-primary/5 rounded-lg p-3 flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-primary truncate min-w-0 flex-1">{s.full_name}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          {(["present", "late", "absent"] as const).map((st) => (
                            <button
                              key={st}
                              onClick={() => setAttendanceMap((prev) => ({ ...prev, [`${s.id}`]: st }))}
                              className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wide rounded-md transition-colors cursor-pointer ${
                                status === st
                                  ? st === "present"
                                    ? "bg-green-100 text-green-700"
                                    : st === "late"
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-red-100 text-red-700"
                                  : "bg-surface text-on-surface-variant/50 hover:bg-surface-container-high"
                              }`}
                              title={st}
                            >
                              {st === "present" ? "P" : st === "late" ? "L" : "A"}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Printable attendance sheet — lives outside #root so printing shows only this
          paper-style document (black text on white, full letterhead, no app chrome). */}
      {showAttendance &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={attendanceSheetRef}
            className="attendance-print-sheet"
            style={{ color: "#000", background: "#fff", fontFamily: "Arial, Helvetica, sans-serif" }}
          >
            {/* Letterhead */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px", borderBottom: "3px double #000", paddingBottom: "12px" }}>
              {siteContent.logo_url ? (
                <img
                  src={siteContent.logo_url}
                  alt="School logo"
                  style={{ width: "64px", height: "64px", objectFit: "contain", flexShrink: 0 }}
                />
              ) : null}
              <div style={{ flex: 1, textAlign: "center", minWidth: 0 }}>
                <div style={{ fontSize: "18px", fontWeight: 800, lineHeight: 1.3 }}>
                  {SCHOOL_LETTERHEAD.school_name_en}
                </div>
                <div style={{ fontSize: "15px", fontWeight: 700, marginTop: "2px" }}>
                  {SCHOOL_LETTERHEAD.school_name_ar}
                </div>
                <div style={{ fontSize: "11px", marginTop: "4px" }}>
                  {SCHOOL_LETTERHEAD.school_location}
                  {" · "}
                  {SCHOOL_LETTERHEAD.school_contact}
                </div>
              </div>
              <div style={{ width: "64px", flexShrink: 0 }} aria-hidden="true" />
            </div>

            {/* Title */}
            <div
              style={{
                margin: "14px 0 12px",
                border: "1px solid #000",
                textAlign: "center",
                padding: "8px 10px",
                fontSize: "15px",
                fontWeight: 800,
                letterSpacing: "3px",
              }}
            >
              ATTENDANCE SHEET
              <div style={{ fontSize: "13px", letterSpacing: "normal", fontWeight: 700, marginTop: "2px" }}>
                سجل الحضور
              </div>
            </div>

            {/* Sheet meta */}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11.5px", marginBottom: "14px", tableLayout: "fixed" }}>
              <tbody>
                <tr>
                  {[
                    ["Class", classData.name],
                    ["Date", formatSheetDate(attendanceDate)],
                    ["Day", formatSheetDay(attendanceDate)],
                    ["Total Students", String(students.length)],
                  ].map(([label, value]) => (
                    <td key={label} style={{ border: "1px solid #000", padding: "6px 8px", verticalAlign: "top", wordWrap: "break-word" }}>
                      <span style={{ fontWeight: 700 }}>{label}: </span>
                      {value}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>

            {/* Register */}
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "11.5px",
                tableLayout: "fixed",
                wordWrap: "break-word",
              }}
            >
              <thead>
                <tr>
                  {[
                    ["S/N", "7%"],
                    ["Student's Name", "33%"],
                    ["Class", "15%"],
                    ["Date", "18%"],
                    ["Status", "12%"],
                    ["Signature", "15%"],
                  ].map(([label, width]) => (
                    <th
                      key={label}
                      style={{
                        border: "1px solid #000",
                        padding: "7px 6px",
                        width,
                        textAlign: "center",
                        fontWeight: 700,
                        fontSize: "11px",
                        textTransform: "uppercase",
                        background: "#fff",
                        color: "#000",
                      }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={s.id}>
                    <td style={cellStyle}>{i + 1}</td>
                    <td style={{ ...cellStyle, fontWeight: 600 }}>{s.full_name}</td>
                    <td style={cellStyle}>{classData.name}</td>
                    <td style={cellStyle}>{attendanceDate}</td>
                    <td style={{ ...cellStyle, textAlign: "center", textTransform: "capitalize" }}>
                      {attendanceMap[`${s.id}`] || "present"}
                    </td>
                    <td style={{ ...cellStyle, height: "30px" }} />
                  </tr>
                ))}
                {students.length === 0 && (
                  <tr>
                    <td style={{ ...cellStyle, textAlign: "center", padding: "18px" }} colSpan={6}>
                      No students in this class yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Summary */}
            <div style={{ fontSize: "11.5px", marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "18px" }}>
              <span>
                <strong>Total Present:</strong> {counts.present}
              </span>
              <span>
                <strong>Total Late:</strong> {counts.late}
              </span>
              <span>
                <strong>Total Absent:</strong> {counts.absent}
              </span>
              <span>
                <strong>Class Teacher:</strong> ____________________
              </span>
            </div>

            {/* Signatures */}
            <div style={{ display: "flex", gap: "40px", marginTop: "44px" }}>
              {["Class Teacher's Signature / Date", "Head of Academy's Signature / Date"].map((label) => (
                <div key={label} style={{ flex: 1, textAlign: "center", fontSize: "11px" }}>
                  <div style={{ borderTop: "1.5px solid #000", paddingTop: "6px" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>,
          document.body
        )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search students..."
              className="w-full bg-white border border-primary/10 pl-10 pr-3 py-2.5 text-sm rounded-lg focus:outline-none focus:border-secondary transition-colors" />
          </div>
          <p className="text-sm text-on-surface-variant shrink-0">{filteredStudents.length} student{filteredStudents.length !== 1 ? "s" : ""}</p>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-16 h-16 text-on-surface-variant/20 mx-auto mb-4" />
            <p className="text-on-surface-variant text-sm">{searchTerm ? "No students found" : "No students in this class yet"}</p>
            {!searchTerm && isAdmin && (
              <div className="mt-4 flex gap-3 justify-center">
                <button onClick={() => setShowAddModal(true)} className="text-secondary hover:text-primary text-sm font-semibold cursor-pointer">+ Add one student</button>
                <span className="text-on-surface-variant/40">|</span>
                <button onClick={() => setShowBatchModal(true)} className="text-secondary hover:text-primary text-sm font-semibold cursor-pointer">+ Add multiple</button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-primary/5 overflow-hidden shadow-xs">
            <div className="divide-y divide-primary/5">
              {filteredStudents.map((student, index) => (
                <motion.div key={student.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}
                  className="flex items-center justify-between px-5 py-4 hover:bg-surface-container-low transition-colors group">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-full bg-primary/5 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">{student.full_name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-primary truncate">{student.full_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => setReportStudent(student)}
                      title="Studies report sheet"
                      className="flex items-center gap-1 text-[11px] font-semibold text-secondary hover:text-primary hover:bg-secondary/10 px-2 py-1.5 rounded-lg transition-colors cursor-pointer">
                      <FileText className="w-4 h-4" />
                      <span className="hidden md:inline">Report Sheet</span>
                    </button>
                    <button onClick={() => {
                        if (onEditStudent) { onEditStudent(student); return; }
                        setEditingStudent(student);
                        setStudentName(student.full_name);
                        setStudentBiodata({
                          surname: (student as any).surname || "",
                          first_name: (student as any).first_name || "",
                          middle_name: (student as any).middle_name || "",
                          gender: (student as any).gender || "",
                          date_of_birth: (student as any).date_of_birth || "",
                          address: (student as any).address || "",
                          parent_name: (student as any).parent_name || "",
                          parent_phone: (student as any).parent_phone || "",
                          passport_photo: (student as any).passport_photo || "",
                          student_password: (student as any).student_password || "student123"
                        });
                      }}
                      className="p-1.5 text-on-surface-variant/50 hover:text-secondary hover:bg-secondary/5 rounded-lg transition-colors cursor-pointer">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {isAdmin && (
                      <>
                        <button onClick={() => { setShowMoveModal(student); setMoveTargetClass(0); }}
                          className="p-1.5 text-on-surface-variant/50 hover:text-secondary hover:bg-secondary/5 rounded-lg transition-colors cursor-pointer"
                          title="Move to another class">
                          <Move className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteStudent(student)}
                          className="p-1.5 text-on-surface-variant/50 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Student Modal */}
      <AnimatePresence>
        {showAddModal && (
          <Modal onClose={() => setShowAddModal(false)} title="Add Student">
            <div className="mb-4">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Student Full Name</label>
              <input type="text" value={studentName} onChange={(e) => setStudentName(e.target.value)}
                placeholder="Dr Ibrahim Mustapha"
                className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary"
                autoFocus onKeyDown={(e) => e.key === "Enter" && handleAddStudent()} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowAddModal(false)}
                className="flex-1 border border-primary/20 text-on-surface-variant py-2.5 rounded-lg text-xs font-semibold cursor-pointer hover:bg-surface-container">Cancel</button>
              <button onClick={handleAddStudent} disabled={saving || !studentName.trim()}
                className="flex-1 bg-primary text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-primary-container disabled:opacity-50 flex items-center justify-center gap-1.5">
                {saving ? "Saving..." : <><Plus className="w-3.5 h-3.5" /> Add</>}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Batch Add Modal */}
      <AnimatePresence>
        {showBatchModal && (
          <Modal onClose={() => setShowBatchModal(false)} title="Batch Add Students">
            <div className="mb-4">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Student Names (one per line)</label>
              <textarea value={batchNames} onChange={(e) => setBatchNames(e.target.value)}
                placeholder={`Ibrahim Mustapha\nAbdulrafiu Usman\nMohammed Ali`}
                rows={8}
                className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary transition-colors font-mono"
                autoFocus />
              <p className="text-[10px] text-on-surface-variant/60 mt-1.5">Enter one student name per line</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowBatchModal(false)}
                className="flex-1 border border-primary/20 text-on-surface-variant py-2.5 rounded-lg text-xs font-semibold cursor-pointer hover:bg-surface-container">Cancel</button>
              <button onClick={handleBatchAdd} disabled={saving || !batchNames.trim()}
                className="flex-1 bg-primary text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-primary-container disabled:opacity-50 flex items-center justify-center gap-1.5">
                {saving ? "Adding..." : <><Copy className="w-3.5 h-3.5" /> Add All ({batchNames.split("\n").filter(Boolean).length})</>}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Edit Student Modal (Full Biodata) */}
      <AnimatePresence>
        {editingStudent && (
          <Modal onClose={() => { setEditingStudent(null); setStudentName(""); setStudentBiodata({ surname: "", first_name: "", middle_name: "", gender: "", date_of_birth: "", address: "", parent_name: "", parent_phone: "", passport_photo: "", student_password: "" }); }} title="Student Biodata">
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Surname</label>
                  <input type="text" value={studentBiodata.surname} onChange={(e) => setStudentBiodata({ ...studentBiodata, surname: e.target.value })}
                    className="w-full bg-surface border border-primary/20 p-2.5 text-sm rounded-lg focus:outline-none focus:border-secondary" placeholder="e.g. Usman" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">First Name</label>
                  <input type="text" value={studentBiodata.first_name} onChange={(e) => setStudentBiodata({ ...studentBiodata, first_name: e.target.value })}
                    className="w-full bg-surface border border-primary/20 p-2.5 text-sm rounded-lg focus:outline-none focus:border-secondary" placeholder="e.g. Ibrahim" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Middle Name</label>
                  <input type="text" value={studentBiodata.middle_name} onChange={(e) => setStudentBiodata({ ...studentBiodata, middle_name: e.target.value })}
                    className="w-full bg-surface border border-primary/20 p-2.5 text-sm rounded-lg focus:outline-none focus:border-secondary" placeholder="Optional" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Gender</label>
                  <select value={studentBiodata.gender} onChange={(e) => setStudentBiodata({ ...studentBiodata, gender: e.target.value })}
                    className="w-full bg-surface border border-primary/20 p-2.5 text-sm rounded-lg focus:outline-none focus:border-secondary">
                    <option value="">-- Select --</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Date of Birth</label>
                  <input type="date" value={studentBiodata.date_of_birth} onChange={(e) => setStudentBiodata({ ...studentBiodata, date_of_birth: e.target.value })}
                    className="w-full bg-surface border border-primary/20 p-2.5 text-sm rounded-lg focus:outline-none focus:border-secondary" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Password</label>
                  <input type="text" value={studentBiodata.student_password} onChange={(e) => setStudentBiodata({ ...studentBiodata, student_password: e.target.value })}
                    className="w-full bg-surface border border-primary/20 p-2.5 text-sm rounded-lg focus:outline-none focus:border-secondary" placeholder="student123" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Address</label>
                <input type="text" value={studentBiodata.address} onChange={(e) => setStudentBiodata({ ...studentBiodata, address: e.target.value })}
                  className="w-full bg-surface border border-primary/20 p-2.5 text-sm rounded-lg focus:outline-none focus:border-secondary" placeholder="Home address" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Parent/Guardian Name</label>
                  <input type="text" value={studentBiodata.parent_name} onChange={(e) => setStudentBiodata({ ...studentBiodata, parent_name: e.target.value })}
                    className="w-full bg-surface border border-primary/20 p-2.5 text-sm rounded-lg focus:outline-none focus:border-secondary" placeholder="e.g. Mohammed Usman" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Parent Phone</label>
                  <input type="tel" value={studentBiodata.parent_phone} onChange={(e) => setStudentBiodata({ ...studentBiodata, parent_phone: e.target.value })}
                    className="w-full bg-surface border border-primary/20 p-2.5 text-sm rounded-lg focus:outline-none focus:border-secondary" placeholder="e.g. +234 800 000 0000" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Passport Photo URL</label>
                <input type="text" value={studentBiodata.passport_photo} onChange={(e) => setStudentBiodata({ ...studentBiodata, passport_photo: e.target.value })}
                  className="w-full bg-surface border border-primary/20 p-2.5 text-sm rounded-lg focus:outline-none focus:border-secondary" placeholder="/uploads/photo.jpg" />
              </div>
            </div>
            <div className="flex gap-2 mt-4 sticky bottom-0 bg-white pt-2">
              <button onClick={() => { setEditingStudent(null); setStudentName(""); setStudentBiodata({ surname: "", first_name: "", middle_name: "", gender: "", date_of_birth: "", address: "", parent_name: "", parent_phone: "", passport_photo: "", student_password: "" }); }}
                className="flex-1 border border-primary/20 text-on-surface-variant py-2.5 rounded-lg text-xs font-semibold cursor-pointer hover:bg-surface-container">Cancel</button>
              <button onClick={handleEditStudent} disabled={saving}
                className="flex-1 bg-primary text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-primary-container disabled:opacity-50 flex items-center justify-center gap-1.5">
                <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Biodata'}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Move Student Modal */}
      <AnimatePresence>
        {showMoveModal && (
          <Modal onClose={() => { setShowMoveModal(null); setMoveTargetClass(0); }} title={`Move: ${showMoveModal.full_name}`}>
            <div className="mb-4">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Select New Class</label>
              <select value={moveTargetClass} onChange={(e) => setMoveTargetClass(parseInt(e.target.value))}
                className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary">
                <option value={0}>-- Select Class --</option>
                {allClasses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowMoveModal(null); setMoveTargetClass(0); }}
                className="flex-1 border border-primary/20 text-on-surface-variant py-2.5 rounded-lg text-xs font-semibold cursor-pointer hover:bg-surface-container">Cancel</button>
              <button onClick={handleMoveStudent} disabled={saving || !moveTargetClass}
                className="flex-1 bg-primary text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-primary-container disabled:opacity-50 flex items-center justify-center gap-1.5">
                <Move className="w-3.5 h-3.5" /> Move
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Edit Subject Inline Modal */}
      <AnimatePresence>
        {editSubject && (
          <Modal onClose={() => { setEditSubject(null); setSubjectForm({ name: "", book_name: "", book_author: "" }); }} title="Edit Subject">
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Name</label>
                <input type="text" value={subjectForm.name} onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Book Name</label>
                <input type="text" value={subjectForm.book_name} onChange={(e) => setSubjectForm({ ...subjectForm, book_name: e.target.value })}
                  className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Author</label>
                <input type="text" value={subjectForm.book_author} onChange={(e) => setSubjectForm({ ...subjectForm, book_author: e.target.value })}
                  className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setEditSubject(null); setSubjectForm({ name: "", book_name: "", book_author: "" }); }}
                className="flex-1 border border-primary/20 text-on-surface-variant py-2.5 rounded-lg text-xs font-semibold cursor-pointer hover:bg-surface-container">Cancel</button>
              <button onClick={handleEditSubject} disabled={savingSubject || !subjectForm.name.trim()}
                className="flex-1 bg-primary text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-primary-container disabled:opacity-50 flex items-center justify-center gap-1.5">
                <Save className="w-3.5 h-3.5" /> Save
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Reusable Modal Wrapper
function Modal({ children, onClose, title }: { children: ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-xs cursor-pointer" />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-xl border border-primary/10 max-w-md w-full p-6 shadow-2xl relative z-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-lg font-bold text-primary">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-surface-container rounded-lg transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}
