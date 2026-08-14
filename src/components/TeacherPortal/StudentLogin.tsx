import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { LogIn, School, User, Eye, EyeOff, ArrowLeft, Download, BookOpen, GraduationCap, Loader2 } from "lucide-react";
import { Result } from "../../types";
import {
  fetchResultSheetConfig,
  buildResultSheetData,
  renderSheetToPDF,
} from "../../lib/resultSheet";
import { RESULT_SHEET_DEFAULTS } from "../../lib/resultSheetConfig";
import { normalizeImageUrl } from "../../lib/siteContent";

interface StudentData {
  id: number;
  full_name: string;
  surname?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  address?: string | null;
  parent_name?: string | null;
  parent_phone?: string | null;
  passport_photo?: string | null;
  class_name: string;
  class_id: number;
}

interface StudentResult {
  id: number;
  subject_id?: number;
  subject_name: string;
  term: number;
  year?: string;
  test_score: number | null;
  exam_score: number | null;
  total_score: number | null;
  remarks: string | null;
}

interface Subject {
  id: number;
  name: string;
}

interface StudentLoginProps {
  onBack?: () => void;
}

const GRADING_SCALE = [
  { grade: "A", min: 80, max: 100, remark: "Excellent" },
  { grade: "B", min: 65, max: 79, remark: "Very Good" },
  { grade: "C", min: 50, max: 64, remark: "Credit / Good" },
  { grade: "P", min: 40, max: 49, remark: "Pass" },
  { grade: "F", min: 0, max: 39, remark: "Fail" },
];

function calcGrade(total: number): string {
  const entry = GRADING_SCALE.find((g) => total >= g.min && total <= g.max);
  return entry?.grade || "F";
}

export default function StudentLogin({ onBack }: StudentLoginProps) {
  const [surname, setSurname] = useState("");
  const [password, setPassword] = useState("student123");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [student, setStudent] = useState<StudentData | null>(null);
  const [results, setResults] = useState<StudentResult[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedTerm, setSelectedTerm] = useState(1);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!surname.trim()) {
      setError("Please enter your surname");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/student-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surname: surname.trim(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      setToken(data.token);
      setStudent(data.student);
      fetchResults(data.token);
    } catch (err) {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const [termReports, setTermReports] = useState<any[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<{ status: string; count: number }[]>([]);

  const fetchResults = async (authToken: string) => {
    try {
      const res = await fetch("/api/student/my-results", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      setResults(data.results || []);
      setSubjects(data.subjects || []);
      setTermReports(data.termReports || []);
      setAttendanceSummary(data.attendance || []);
    } catch (err) {
      console.error("Failed to fetch results:", err);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setStudent(null);
    setResults([]);
    setSubjects([]);
    setSurname("");
  };

  const getTermResults = () => results.filter((r) => r.term === selectedTerm);

  const getGrandTotal = () => {
    const termResults = getTermResults();
    return termResults.reduce((sum, r) => sum + (r.total_score || 0), 0);
  };

  const getOverallGrade = () => {
    const termResults = getTermResults();
    const total = getGrandTotal();
    const maxTotal = termResults.length * 100;
    if (maxTotal === 0) return "-";
    const avg = Math.round((total / maxTotal) * 100);
    return calcGrade(avg);
  };

  const handleDownloadPDF = async () => {
    if (!student) return;
    setExporting(true);
    try {
      const config = await fetchResultSheetConfig();
      const termResults = getTermResults();
      const resultsData: Result[] = termResults.map((r) => ({
        id: r.id,
        student_id: student.id,
        subject_id: r.subject_id || 0,
        term: selectedTerm,
        year: r.year || "",
        test_score: r.test_score,
        exam_score: r.exam_score,
        total_score: r.total_score,
        remarks: r.remarks,
        created_at: "",
        subject_name: r.subject_name,
        book_name: "",
      }));

      const data = buildResultSheetData({
        config,
        studentName: student.full_name,
        className: student.class_name,
        subjects: subjects.map((s) => ({
          id: s.id,
          class_id: student.class_id,
          name: s.name,
          book_name: "",
          book_author: "",
        })),
        results: resultsData,
        term: selectedTerm,
        academicYear: "",
      });

      await renderSheetToPDF(
        config.result_sheet_template || RESULT_SHEET_DEFAULTS.result_sheet_template,
        data,
        `${student.full_name.replace(/\s+/g, "_")}_Term${selectedTerm}_Results.pdf`
      );
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setExporting(false);
    }
  };

  // Logged in view
  if (token && student) {
    const termResults = getTermResults();
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-background">
        <div className="bg-primary text-white px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GraduationCap className="w-6 h-6 text-secondary-fixed" />
              <div>
                <h1 className="font-serif text-lg font-bold">{student.full_name}</h1>
                <p className="text-white/70 text-xs">{student.class_name}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="text-white/70 hover:text-white text-xs cursor-pointer">
              Logout
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* My Bio Data */}
          <div className="bg-white border border-primary/5 rounded-xl shadow-xs overflow-hidden mb-6">
            <div className="flex items-center justify-between px-5 py-4 border-b border-primary/5 bg-secondary-fixed/10">
              <h3 className="font-serif font-bold text-primary text-sm flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-secondary" />
                My Bio Data
              </h3>
              <span className="text-[10px] font-bold text-secondary uppercase tracking-wider bg-white border border-secondary/20 px-2.5 py-1 rounded-full">
                {student.class_name}
              </span>
            </div>
            <div className="p-5 flex flex-col sm:flex-row gap-5">
              {student.passport_photo && (
                <div className="shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-primary/10 bg-surface">
                  <img
                    src={normalizeImageUrl(student.passport_photo)}
                    alt="Student passport photo"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs flex-1">
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider mb-1">Full Name</p>
                  <p className="font-semibold text-primary">{student.full_name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider mb-1">Surname</p>
                  <p className="font-semibold text-primary">{student.surname || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider mb-1">Gender</p>
                  <p className="font-semibold text-primary">{student.gender || "—"}</p>
                </div>
                {student.date_of_birth && (
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider mb-1">Date of Birth</p>
                    <p className="font-semibold text-primary">{student.date_of_birth}</p>
                  </div>
                )}
                {student.parent_name && (
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider mb-1">Parent / Guardian</p>
                    <p className="font-semibold text-primary">{student.parent_name}</p>
                  </div>
                )}
                {student.parent_phone && (
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider mb-1">Parent Phone</p>
                    <p className="font-semibold text-primary">{student.parent_phone}</p>
                  </div>
                )}
                {student.address && (
                  <div className="col-span-2 sm:col-span-3">
                    <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider mb-1">Address</p>
                    <p className="font-semibold text-primary">{student.address}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white border border-primary/5 rounded-xl shadow-xs overflow-hidden">
            {/* School Header */}
            <div className="bg-primary/5 px-5 py-4 border-b border-primary/10 text-center">
              <h2 className="font-serif text-lg font-bold text-primary">Al-Mustafa Academy</h2>
              <p className="text-[10px] text-on-surface-variant">For Qur'an Memorization & Islamic Studies · Ilorin, Nigeria</p>
            </div>

            <div className="p-5">
              <h3 className="font-serif text-base font-bold text-primary mb-3">My Results</h3>
              <div className="flex gap-2 mb-4">
                {[1, 2, 3].map((t) => (
                  <button key={t} onClick={() => setSelectedTerm(t)}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                      selectedTerm === t ? "bg-primary text-white shadow" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                    }`}>
                    Term {t}
                  </button>
                ))}
              </div>

              {termResults.length === 0 ? (
                <div className="text-center py-10">
                  <BookOpen className="w-12 h-12 text-on-surface-variant/20 mx-auto mb-3" />
                  <p className="text-sm text-on-surface-variant">No results recorded for this term yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-primary text-white">
                        <th className="text-left py-2.5 px-3 font-semibold">Subject</th>
                        <th className="text-center py-2.5 px-2 font-semibold">Test (30)</th>
                        <th className="text-center py-2.5 px-2 font-semibold">Exam (70)</th>
                        <th className="text-center py-2.5 px-2 font-semibold">Total</th>
                        <th className="text-center py-2.5 px-2 font-semibold">Grade</th>
                        <th className="text-center py-2.5 px-2 font-semibold">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-primary/5">
                      {termResults.map((r) => (
                        <tr key={r.id} className="hover:bg-surface-container-low transition-colors">
                          <td className="py-2.5 px-3 text-primary font-medium">{r.subject_name}</td>
                          <td className="py-2.5 px-2 text-center">{r.test_score ?? "-"}</td>
                          <td className="py-2.5 px-2 text-center">{r.exam_score ?? "-"}</td>
                          <td className="py-2.5 px-2 text-center font-bold">{r.total_score ?? "-"}</td>
                          <td className={`py-2.5 px-2 text-center font-bold ${
                            r.total_score && calcGrade(r.total_score) === "A" ? "text-green-600" :
                            r.total_score && calcGrade(r.total_score) === "F" ? "text-red-600" :
                            "text-primary"
                          }`}>{r.total_score ? calcGrade(r.total_score) : "-"}</td>
                          <td className="py-2.5 px-2 text-center">{r.remarks || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-secondary-fixed/10 font-bold">
                        <td className="py-2.5 px-3 text-primary">GRAND TOTAL</td>
                        <td />
                        <td />
                        <td className="py-2.5 px-2 text-center text-primary">
                          {getGrandTotal()} / {termResults.length * 100}
                        </td>
                        <td className="py-2.5 px-2 text-center text-primary">{getOverallGrade()}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Grading Scale */}
              <div className="mt-5 bg-surface-container-low rounded-lg p-3">
                <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-2">Grading Scale</p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {GRADING_SCALE.map((g) => (
                    <div key={g.grade} className={`text-center p-1.5 rounded ${
                      g.grade === "A" ? "bg-green-50" :
                      g.grade === "F" ? "bg-red-50" :
                      "bg-white"
                    }`}>
                      <p className={`text-sm font-bold ${
                        g.grade === "A" ? "text-green-600" :
                        g.grade === "F" ? "text-red-600" :
                        "text-primary"
                      }`}>{g.grade}</p>
                      <p className="text-[8px] text-on-surface-variant">{g.min}-{g.max}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Attendance Summary */}
              {attendanceSummary.length > 0 && (
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {["present", "late", "absent"].map((st) => {
                    const item = attendanceSummary.find((a) => a.status === st);
                    return (
                      <div key={st} className={`text-center p-3 rounded-lg ${st === "present" ? "bg-green-50" : st === "late" ? "bg-amber-50" : "bg-red-50"}`}>
                        <p className={`text-lg font-bold ${st === "present" ? "text-green-600" : st === "late" ? "text-amber-600" : "text-red-600"}`}>{item?.count || 0}</p>
                        <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">{st === "present" ? "Present" : st === "late" ? "Late" : "Absent"}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Term Report — Hifdh & Behaviour */}
              {(() => {
                const report = termReports.find((r) => r.term === selectedTerm);
                if (!report || (!report.hifdh_progress && !report.behavior_remarks)) return null;
                return (
                  <div className="mt-5 bg-surface-container-low rounded-lg p-4">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-2">Term Report</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      {report.hifdh_progress && (
                        <div>
                          <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider mb-1">Qur'an Hifdh Progress</p>
                          <p className="text-on-surface whitespace-pre-line">{report.hifdh_progress}</p>
                        </div>
                      )}
                      {report.behavior_remarks && (
                        <div>
                          <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider mb-1">Behavioural Remarks</p>
                          <p className="text-on-surface whitespace-pre-line">{report.behavior_remarks}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              <button onClick={handleDownloadPDF} disabled={exporting}
                className="mt-4 flex items-center gap-1.5 text-xs bg-primary text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-primary-container transition-colors cursor-pointer ml-auto disabled:opacity-50">
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {exporting ? "Preparing…" : "Download PDF"}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Login view
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-gradient-to-br from-primary via-primary-container to-primary flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <button onClick={() => onBack?.()} className="text-white/70 hover:text-white mb-6 text-sm flex items-center gap-1.5 transition-colors cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-primary p-6 text-center">
            <GraduationCap className="w-10 h-10 text-secondary-fixed mx-auto mb-2" />
            <h1 className="font-serif text-xl font-bold text-white">Student Portal</h1>
            <p className="text-white/70 text-xs mt-1">View your termly results</p>
          </div>

          <form onSubmit={handleLogin} className="p-6 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-2.5 rounded-lg">{error}</div>
            )}

            <div>
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Surname</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
                <input type="text" value={surname} onChange={(e) => setSurname(e.target.value)}
                  placeholder="Enter your surname"
                  className="w-full bg-surface border border-primary/20 pl-10 pr-3 py-3 text-sm rounded-lg focus:outline-none focus:border-secondary transition-all" autoFocus />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="Default: student123"
                  className="w-full bg-surface border border-primary/20 pl-3 pr-10 py-3 text-sm rounded-lg focus:outline-none focus:border-secondary transition-all" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 cursor-pointer">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-primary hover:bg-primary-container text-white py-3.5 rounded-lg font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
              {loading ? "Signing in..." : <><LogIn className="w-4 h-4" /> View My Results</>}
            </button>

            <p className="text-[10px] text-on-surface-variant/60 text-center">
              Enter your surname and use password "student123"
            </p>
          </form>
        </motion.div>
      </div>
    </motion.div>
  );
}
