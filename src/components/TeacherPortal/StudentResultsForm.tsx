import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft, Save, Download, CheckCircle, AlertCircle,
  FileText, GraduationCap, Printer, Loader2
} from "lucide-react";
import { Student, Subject, Result } from "../../types";
import {
  fetchResultSheetConfig,
  buildResultSheetData,
  renderSheetToPDF,
} from "../../lib/resultSheet";
import { RESULT_SHEET_DEFAULTS } from "../../lib/resultSheetConfig";

interface StudentResultsFormProps {
  student: Student;
  className: string;
  token: string;
  onBack: () => void;
  onViewResult: (subjects: Subject[], results: Result[], term: number, academicYear: string) => void;
}

const TERMS = [
  { id: 1, label: "First Term" },
  { id: 2, label: "Second Term" },
  { id: 3, label: "Third Term" },
];

const CURRENT_YEAR = new Date().getFullYear().toString();
const ACADEMIC_YEAR = `${CURRENT_YEAR}/${(parseInt(CURRENT_YEAR) + 1).toString()}`;

const GRADING_SCALE = [
  { grade: "A", min: 70, max: 100, remark: "Excellent" },
  { grade: "B", min: 60, max: 69, remark: "Very Good" },
  { grade: "C", min: 50, max: 59, remark: "Credit / Good" },
  { grade: "P", min: 40, max: 49, remark: "Pass" },
  { grade: "F", min: 0, max: 39, remark: "Fail" },
];

function calculateGrade(total: number): string {
  const entry = GRADING_SCALE.find((g) => total >= g.min && total <= g.max);
  return entry?.grade || "F";
}

export default function StudentResultsForm({ student, className, token, onBack, onViewResult }: StudentResultsFormProps) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [savedResults, setSavedResults] = useState<Record<string, Result>>({});
  const [selectedTerm, setSelectedTerm] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [formMap, setFormMap] = useState<Record<string, { test: string; exam: string; remarks: string }>>({});

  useEffect(() => {
    fetchSubjects();
    fetchResults();
  }, [selectedTerm]);

  const fetchSubjects = async () => {
    try {
      const res = await fetch(`/api/classes/${student.class_id}/subjects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSubjects(data.subjects || []);
    } catch (err) {
      console.error("Failed to fetch subjects:", err);
    }
  };

  const fetchResults = async () => {
    try {
      const res = await fetch(`/api/students/${student.id}/results`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const resultsMap: Record<string, Result> = {};
      const formMapData: Record<string, { test: string; exam: string; remarks: string }> = {};

      const termResults = (data.results || []).filter(
        (r: Result) => r.term === selectedTerm && r.year === ACADEMIC_YEAR
      );

      for (const r of termResults) {
        resultsMap[`${r.subject_id}`] = r;
        formMapData[`${r.subject_id}`] = {
          test: r.test_score?.toString() || "",
          exam: r.exam_score?.toString() || "",
          remarks: r.remarks || "",
        };
      }

      setSavedResults(resultsMap);
      setFormMap(formMapData);
    } catch (err) {
      console.error("Failed to fetch results:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleScoreChange = (subjectId: number, field: "test" | "exam", value: string) => {
    setFormMap((prev) => ({
      ...prev,
      [`${subjectId}`]: {
        ...prev[`${subjectId}`],
        [field]: value,
        remarks: prev[`${subjectId}`]?.remarks || "",
      },
    }));
    setSuccess(false);
    setError("");
  };

  const handleRemarksChange = (subjectId: number, value: string) => {
    setFormMap((prev) => ({
      ...prev,
      [`${subjectId}`]: {
        ...prev[`${subjectId}`],
        remarks: value,
      },
    }));
    setSuccess(false);
    setError("");
  };

  const getTotal = (subjectId: number): number => {
    const data = formMap[`${subjectId}`];
    if (!data) return 0;
    const test = parseFloat(data.test) || 0;
    const exam = parseFloat(data.exam) || 0;
    return test + exam;
  };

  const getGrade = (subjectId: number): string => {
    return calculateGrade(getTotal(subjectId));
  };

  const getGrandTotal = (): number => {
    return subjects.reduce((sum, subj) => sum + getTotal(subj.id), 0);
  };

  const getMaxTotal = (): number => {
    return subjects.length * 100;
  };

  const handleViewResult = () => {
    // Build results array from form data
    const resultsData: Result[] = subjects.map((subj) => {
      const formData = formMap[`${subj.id}`] || { test: "", exam: "", remarks: "" };
      const test = formData.test ? parseFloat(formData.test) : null;
      const exam = formData.exam ? parseFloat(formData.exam) : null;
      const total = (test || 0) + (exam || 0);
      return {
        id: 0,
        student_id: student.id,
        subject_id: subj.id,
        term: selectedTerm,
        year: ACADEMIC_YEAR,
        test_score: test,
        exam_score: exam,
        total_score: total > 0 ? total : null,
        remarks: formData.remarks || null,
        created_at: new Date().toISOString(),
        subject_name: subj.name,
        book_name: subj.book_name,
      };
    });
    onViewResult(subjects, resultsData, selectedTerm, ACADEMIC_YEAR);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setError("");
    setSuccess(false);

    const resultsData = subjects.map((subj) => {
      const formData = formMap[`${subj.id}`] || { test: "", exam: "", remarks: "" };
      const test = formData.test ? parseFloat(formData.test) : null;
      const exam = formData.exam ? parseFloat(formData.exam) : null;
      return {
        student_id: student.id,
        subject_id: subj.id,
        term: selectedTerm,
        year: ACADEMIC_YEAR,
        test_score: test,
        exam_score: exam,
        remarks: formData.remarks || null,
      };
    });

    try {
      const res = await fetch("/api/results/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ results: resultsData }),
      });

      if (res.ok) {
        setSuccess(true);
        fetchResults();
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save results");
      }
    } catch (err) {
      setError("Connection error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    setExporting(true);
    setError("");
    try {
      const config = await fetchResultSheetConfig();
      const resultsData: Result[] = subjects.map((subj) => {
        const formData = formMap[`${subj.id}`] || { test: "", exam: "", remarks: "" };
        const test = formData.test ? parseFloat(formData.test) : null;
        const exam = formData.exam ? parseFloat(formData.exam) : null;
        const total = (test || 0) + (exam || 0);
        return {
          id: 0,
          student_id: student.id,
          subject_id: subj.id,
          term: selectedTerm,
          year: ACADEMIC_YEAR,
          test_score: test,
          exam_score: exam,
          total_score: total > 0 ? total : null,
          remarks: formData.remarks || null,
          created_at: new Date().toISOString(),
          subject_name: subj.name,
          book_name: subj.book_name,
        };
      });

      const data = buildResultSheetData({
        config,
        studentName: student.full_name,
        className,
        subjects,
        results: resultsData,
        term: selectedTerm,
        academicYear: ACADEMIC_YEAR,
      });

      const ok = await renderSheetToPDF(
        config.result_sheet_template || RESULT_SHEET_DEFAULTS.result_sheet_template,
        data,
        `${student.full_name.replace(/\s+/g, "_")}_Term${selectedTerm}_Results.pdf`
      );
      if (!ok) {
        setError("Could not generate the PDF. Please try the Result Sheet view and print instead.");
      }
    } catch {
      setError("Could not generate the PDF. Please try the Result Sheet view and print instead.");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

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
            <button
              onClick={onBack}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-serif text-lg font-bold">{student.full_name}</h1>
              <p className="text-white/70 text-xs">{className}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleViewResult}
              className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition-colors cursor-pointer"
            >
              <FileText className="w-4 h-4 text-secondary-fixed" />
              <span className="hidden sm:inline">Result Sheet</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={exporting}
              className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin text-secondary-fixed" /> : <Download className="w-4 h-4 text-secondary-fixed" />}
              <span className="hidden sm:inline">{exporting ? "Preparing…" : "PDF"}</span>
            </button>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs bg-secondary-container text-on-secondary-container hover:bg-secondary hover:text-white px-4 py-2 rounded-lg transition-all cursor-pointer font-semibold disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save All"}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Status Messages */}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-50 border border-green-200 text-green-700 text-xs px-4 py-3 rounded-lg mb-6 flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Results saved successfully!
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-lg mb-6 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4" />
            {error}
          </motion.div>
        )}

        {/* Student Info Card */}
        <div className="bg-white border border-primary/5 rounded-xl p-5 mb-6 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="font-serif text-lg font-bold text-primary">Al-Mustafa Academy</h2>
                <p className="text-[10px] text-on-surface-variant">For Qur'an Memorization & Islamic Studies · Ilorin, Nigeria</p>
                <p className="text-xs text-on-surface-variant mt-1">{student.full_name} · {className} · {ACADEMIC_YEAR}</p>
              </div>
            </div>
          </div>

          {/* Term Selector */}
          <div className="flex gap-2 mt-4 border-t border-primary/5 pt-4">
            {TERMS.map((term) => (
              <button
                key={term.id}
                onClick={() => setSelectedTerm(term.id)}
                className={`px-5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  selectedTerm === term.id
                    ? "bg-primary text-white shadow"
                    : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                {term.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results Form */}
        <div className="bg-white border border-primary/5 rounded-xl overflow-hidden shadow-xs">
          {/* Column Headers */}
          <div className="bg-surface-container-low px-5 py-3 border-b border-primary/5">
            <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
              <div className="col-span-3 sm:col-span-3">Subject</div>
              <div className="col-span-2 sm:col-span-2 text-center">Test (30)</div>
              <div className="col-span-2 sm:col-span-2 text-center">Exam (70)</div>
              <div className="col-span-2 sm:col-span-2 text-center">Total/100</div>
              <div className="col-span-1 sm:col-span-1 text-center">Grade</div>
              <div className="col-span-2 sm:col-span-2 text-center">Remarks</div>
            </div>
          </div>

          <div className="divide-y divide-primary/5">
            {subjects.map((subj) => {
              const formData = formMap[`${subj.id}`] || { test: "", exam: "", remarks: "" };
              const total = getTotal(subj.id);
              const grade = getGrade(subj.id);
              return (
                <div key={subj.id} className="px-5 py-2.5 hover:bg-surface-container-low transition-colors">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-3 sm:col-span-3">
                      <p className="text-xs sm:text-sm font-semibold text-primary">{subj.name}</p>
                      {subj.book_name && (
                        <p className="text-[9px] text-on-surface-variant/60 truncate">{subj.book_name}</p>
                      )}
                    </div>
                    <div className="col-span-2 sm:col-span-2">
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={formData.test}
                        onChange={(e) => handleScoreChange(subj.id, "test", e.target.value)}
                        placeholder="0-30"
                        className="w-full bg-surface border border-primary/10 px-2 py-1.5 text-xs rounded-lg focus:outline-none focus:border-secondary transition-colors text-center"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-2">
                      <input
                        type="number"
                        min="0"
                        max="70"
                        value={formData.exam}
                        onChange={(e) => handleScoreChange(subj.id, "exam", e.target.value)}
                        placeholder="0-70"
                        className="w-full bg-surface border border-primary/10 px-2 py-1.5 text-xs rounded-lg focus:outline-none focus:border-secondary transition-colors text-center"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-2 text-center">
                      <span className={`text-xs font-bold ${total > 0 ? "text-primary" : "text-on-surface-variant/40"}`}>
                        {total > 0 ? total : "-"}
                      </span>
                    </div>
                    <div className="col-span-1 sm:col-span-1 text-center">
                      <span className={`text-xs font-bold ${
                        grade === "A" ? "text-green-600" :
                        grade === "F" ? "text-red-600" :
                        "text-primary"
                      }`}>
                        {total > 0 ? grade : "-"}
                      </span>
                    </div>
                    <div className="col-span-2 sm:col-span-2">
                      <input
                        type="text"
                        value={formData.remarks}
                        onChange={(e) => handleRemarksChange(subj.id, e.target.value)}
                        placeholder="Remark"
                        className="w-full bg-surface border border-primary/10 px-2 py-1.5 text-xs rounded-lg focus:outline-none focus:border-secondary transition-colors"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total Row */}
          <div className="bg-secondary-fixed/10 border-t-2 border-secondary px-5 py-3">
            <div className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-3 sm:col-span-3">
                <p className="text-xs font-bold text-primary">GRAND TOTAL</p>
              </div>
              <div className="col-span-2 sm:col-span-2" />
              <div className="col-span-2 sm:col-span-2" />
              <div className="col-span-2 sm:col-span-2 text-center">
                <span className="text-sm font-bold text-primary">{getGrandTotal()} / {getMaxTotal()}</span>
              </div>
              <div className="col-span-1 sm:col-span-1 text-center">
                <span className="text-xs font-bold text-primary">
                  {getMaxTotal() > 0 ? calculateGrade(Math.round(getGrandTotal() / getMaxTotal() * 100)) : "-"}
                </span>
              </div>
              <div className="col-span-2 sm:col-span-2" />
            </div>
          </div>
        </div>

        {/* Grading Scale Card */}
        <div className="mt-6 bg-white border border-primary/5 rounded-xl overflow-hidden shadow-xs">
          <div className="bg-surface-container-low px-5 py-3 border-b border-primary/5">
            <h3 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" />
              Grading Scale
            </h3>
          </div>
          <div className="px-5 py-3">
            <div className="grid grid-cols-5 gap-2">
              {GRADING_SCALE.map((g) => (
                <div key={g.grade} className={`text-center p-2 rounded-lg ${
                  g.grade === "A" ? "bg-green-50" :
                  g.grade === "F" ? "bg-red-50" :
                  "bg-surface-container-low"
                }`}>
                  <p className={`text-lg font-bold ${
                    g.grade === "A" ? "text-green-600" :
                    g.grade === "F" ? "text-red-600" :
                    "text-primary"
                  }`}>{g.grade}</p>
                  <p className="text-[9px] text-on-surface-variant">{g.min}-{g.max}%</p>
                  <p className="text-[8px] text-on-surface-variant/60">{g.remark}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-6 bg-white border border-primary/5 rounded-xl p-5 shadow-xs">
          <h3 className="font-serif text-base font-bold text-primary mb-3">Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
            <div className="bg-surface-container-low rounded-lg p-3">
              <p className="text-2xl font-bold text-primary">{subjects.length}</p>
              <p className="text-[10px] text-on-surface-variant">Subjects</p>
            </div>
            <div className="bg-surface-container-low rounded-lg p-3">
              <p className="text-2xl font-bold text-primary">
                {Object.values(formMap).filter((f: { test: string; exam: string; remarks: string }) => f.test || f.exam).length}
              </p>
              <p className="text-[10px] text-on-surface-variant">Scores Entered</p>
            </div>
            <div className="bg-surface-container-low rounded-lg p-3">
              <p className="text-2xl font-bold text-primary">{getGrandTotal()}</p>
              <p className="text-[10px] text-on-surface-variant">Total Score</p>
            </div>
            <div className="bg-surface-container-low rounded-lg p-3">
              <p className="text-2xl font-bold text-primary">{getMaxTotal()}</p>
              <p className="text-[10px] text-on-surface-variant">Max Total</p>
            </div>
            <div className="bg-surface-container-low rounded-lg p-3">
              <p className="text-2xl font-bold text-primary">{selectedTerm}/3</p>
              <p className="text-[10px] text-on-surface-variant">Term</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 border border-primary/20 text-on-surface-variant py-3 rounded-lg text-xs font-semibold cursor-pointer hover:bg-surface-container transition-colors"
          >
            Back to Class
          </button>
          <button
            onClick={handleViewResult}
            className="flex-1 bg-secondary-fixed/10 text-primary border border-secondary/20 py-3 rounded-lg text-xs font-semibold cursor-pointer hover:bg-secondary-fixed/20 transition-colors flex items-center justify-center gap-1.5"
          >
            <FileText className="w-4 h-4" />
            View Result Sheet
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={exporting}
            className="flex-1 bg-primary/5 text-primary border border-primary/10 py-3 rounded-lg text-xs font-semibold cursor-pointer hover:bg-primary/10 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            {exporting ? "Preparing…" : "Download PDF"}
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="flex-1 bg-primary text-white py-3 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-primary-container disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
          >
            <Save className="w-4 h-4 text-secondary-fixed" />
            {saving ? "Saving..." : "Save All"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
