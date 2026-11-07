import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { ArrowLeft, Printer, Save, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import {
  MAX_TEST_SCORE,
  MAX_EXAM_SCORE,
  GRADING_SCALE,
  defaultReportYear,
  gradeFor,
} from "../../lib/reportSheetConfig";

interface SheetSubjectRow {
  key: string;
  english: string;
  arabic: string;
  test_score: number | null;
  exam_score: number | null;
  total: number | null;
  remarks: string;
}

interface SheetData {
  student: {
    id: number;
    full_name: string;
    class_id: number | null;
    class_name: string;
    class_name_arabic: string;
  };
  term: number;
  year: string;
  subjects: SheetSubjectRow[];
  meta: {
    general_remarks: string;
    promotion_to: string;
    vacation: string;
    resumption: string;
  };
  summary: {
    testTotal: number;
    examTotal: number;
    total: number;
    percentage: number;
    grade: string;
    gradeLabel: string;
    gradeArabic: string;
    position: number | null;
    classSize: number;
  };
}

interface ReportSheetProps {
  studentId: number;
  token: string;
  /** "edit" for staff (teacher/admin), "view" for the student portal. */
  mode?: "edit" | "view";
  onBack?: () => void;
  initialTerm?: number;
  initialYear?: string;
}

type DraftRow = { test: string; exam: string; remarks: string };
type DraftMeta = { general_remarks: string; promotion_to: string; vacation: string; resumption: string };

const ORDINALS = ["", "First Term", "Second Term", "Third Term"];
const INK = "#1f2937";

const SEAL = (
  <svg viewBox="0 0 100 100" className="w-[70px] h-[70px] shrink-0" aria-hidden="true">
    <circle cx="50" cy="50" r="47" fill="none" stroke={INK} strokeWidth="1.6" />
    <circle cx="50" cy="50" r="41" fill="none" stroke={INK} strokeWidth="3" strokeDasharray="2 3" />
    <path d="M50 20 L57 33 L71 33 L62 43 L66 57 L50 50 L34 57 L38 43 L29 33 L43 33 Z" fill="none" stroke={INK} strokeWidth="1.5" />
    <path d="M32 64 C40 60 46 62 50 65 C54 62 60 60 68 64 L68 78 C60 74 54 76 50 79 C46 76 40 74 32 78 Z" fill="none" stroke={INK} strokeWidth="1.5" />
    <line x1="50" y1="65" x2="50" y2="79" stroke={INK} strokeWidth="1.2" />
    <text x="50" y="90" textAnchor="middle" fontSize="6.5" fill={INK} fontFamily="Noto Sans, sans-serif" letterSpacing="0.4">EST. 1998</text>
  </svg>
);

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function ReportSheet({
  studentId,
  token,
  mode = "edit",
  onBack,
  initialTerm,
  initialYear,
}: ReportSheetProps) {
  const editable = mode === "edit";
  const [term, setTerm] = useState(initialTerm ?? 1);
  const [year, setYear] = useState(initialYear ?? defaultReportYear());
  // The session is typed freely, so the applied value trails the field by a
  // moment — otherwise every keystroke fired its own fetch.
  const [yearDraft, setYearDraft] = useState(initialYear ?? defaultReportYear());
  const [sheet, setSheet] = useState<SheetData | null>(null);
  const [rows, setRows] = useState<Record<string, DraftRow>>({});
  // Report-sheet subject configuration (allows the admin to add/remove the
  // subjects that are printed on the sheet).
  const [reportSubjects, setReportSubjects] = useState<
    { key: string; english: string; arabic: string }[]
  >([]);
  const [subjectLoadError, setSubjectLoadError] = useState<string | null>(null);
  // Stable set of subject keys the admin has chosen for this sheet (defaults
  // + any class-added). Used to render rows beyond the built-in 13.
  const [subjectKeys, setSubjectKeys] = useState<Set<string>>(new Set());
  // ref over fetchReportSubjects so that load() and the subject add/remove
  // handlers always use the LATEST sheet.student.class_id / token. load() is
  // memoized with deps [studentId, term, year, token]; the effect that drives
  // it does not re-run on token refresh, so the memoized load() would capture
  // the first-render fetchReportSubjects (sheet.student.class_id ===
  // undefined) and silently never populate reportSubjects, leaving the
  // admin subject add/remove buttons invisible.
  const fetchReportSubjectsRef = useRef(fetchReportSubjects);
  const [meta, setMeta] = useState<DraftMeta>({
    general_remarks: "",
    promotion_to: "",
    vacation: "",
    resumption: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);


  // Absolute origin so the sheet works from every portal (public, teacher,
  // student, and admin) — a relative URL can resolve against the wrong origin
  // or a SPA rewrite rule on some hosts.
  const apiHost = typeof window !== "undefined" ? window.location.origin : "https://al-mustafa-academy-chi.vercel.app";

  // Fetch this class's report-sheet subject configuration (defaults + any
  // class-added subject) so the admin can manage the subjects printed on the
  // sheet.
  const fetchReportSubjects = useCallback(async () => {
    if (!sheet?.student.class_id || !token) return;
    setSubjectLoadError(null);
    try {
      const res = await fetch(
        `${apiHost}/api/classes/${sheet.student.class_id}/report-sheet/subjects`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load report-sheet subjects");
      setReportSubjects(data.subjects || []);
      const keys = new Set<string>();
      for (const s of data.subjects || []) keys.add(s.key);
      setSubjectKeys(keys);
    } catch (err: any) {
      setSubjectLoadError(err?.message || "Failed to load report-sheet subjects");
    }
  }, [sheet?.student.class_id, token, apiHost]);


  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      // Guard against a missing studentId (e.g. a truncated student row) so we
      // never issue a malformed fetch that returns 404/empty and leaves the
      // sheet blank on the admin portal.
      if (!studentId || typeof studentId !== "number") {
        setMessage({ type: "error", text: "Student record is unavailable. Please register the student again." });
        setLoading(false);
        return;
      }
      const res = await fetch(
        `${apiHost}/api/report-sheets/${studentId}?term=${term}&year=${encodeURIComponent(year)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load report sheet");
      const next: SheetData = data.sheet;
      setSheet(next);
      if (next.year !== year) {
        setYear(next.year);
        setYearDraft(next.year);
      }
      const nextRows: Record<string, DraftRow> = {};
      for (const subject of next.subjects) {
        nextRows[subject.key] = {
          test: subject.test_score === null ? "" : String(subject.test_score),
          exam: subject.exam_score === null ? "" : String(subject.exam_score),
          remarks: subject.remarks || "",
        };
      }
      setRows(nextRows);
      setMeta({ ...next.meta });
      // Refresh the class's report-sheet subject configuration so the admin can
      // add/remove the subjects printed on this sheet.
      // Use the ref to get the latest fetchReportSubjects (avoids a stale
      // closure caused by load() being memoized with deps [studentId, term,
      // year, token]).
      void fetchReportSubjectsRef.current();
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Failed to load report sheet" });
    } finally {
      setLoading(false);
    }
  }, [studentId, term, year, token]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, term, year, token]);

  // Re-fetch the subject configuration after the sheet has loaded so the admin
  // subject manager has the correct class's subjects.
  useEffect(() => {
    if (sheet?.student?.class_id) {
      void fetchReportSubjectsRef.current();
    }
  }, [sheet]);

  const live = useMemo(() => {
    const subjects = (sheet?.subjects || []).map((subject) => {
      const draft = rows[subject.key] || { test: "", exam: "", remarks: "" };
      const test = draft.test === "" ? null : Math.max(0, Math.min(MAX_TEST_SCORE, Number(draft.test) || 0));
      const exam = draft.exam === "" ? null : Math.max(0, Math.min(MAX_EXAM_SCORE, Number(draft.exam) || 0));
      return {
        ...subject,
        test_score: test,
        exam_score: exam,
        total: test === null && exam === null ? null : (test || 0) + (exam || 0),
        remarks: draft.remarks,
      };
    });
    const testTotal = subjects.reduce((sum, s) => sum + (s.test_score ?? 0), 0);
    const examTotal = subjects.reduce((sum, s) => sum + (s.exam_score ?? 0), 0);
    const total = testTotal + examTotal;
    // Dynamic max: every printed subject is out of 100 (test 30 + exam 70) as long
    // as the admin enters a score, otherwise (null) it contributes nothing to the
    // denominator either. This keeps the percentage meaningful as subjects are
    // added or removed from the sheet.
    const maxTotal =
      subjects.reduce(
        (sum, s) => sum + (s.test_score === null && s.exam_score === null ? 0 : 100),
        0
      );
    const percentage = maxTotal > 0 ? Math.round((total / maxTotal) * 1000) / 10 : 0;
    const band = gradeFor(percentage);
    return { subjects, testTotal, examTotal, total, percentage, band };
  }, [sheet, rows]);

  const updateRow = (key: string, field: keyof DraftRow, value: string) => {
    setRows((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || { test: "", exam: "", remarks: "" }), [field]: value },
    }));
  };

  const save = async () => {
    if (!editable) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${apiHost}/api/report-sheets/${studentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          term,
          year,
          scores: live.subjects.map((s) => ({
            key: s.key,
            test_score: s.test_score,
            exam_score: s.exam_score,
            remarks: s.remarks,
          })),
          meta,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save report sheet");
      const next: SheetData = data.sheet;
      setSheet(next);
      setRows((prev) => {
        const copy: Record<string, DraftRow> = { ...prev };
        for (const subject of next.subjects) {
          copy[subject.key] = {
            test: subject.test_score === null ? "" : String(subject.test_score),
            exam: subject.exam_score === null ? "" : String(subject.exam_score),
            remarks: subject.remarks || "",
          };
        }
        return copy;
      });
      setMeta({ ...next.meta });
      setMessage({ type: "success", text: "Report sheet saved" });
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Failed to save report sheet" });
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    document.body.classList.add("printing-report-sheet");
    const cleanup = () => {
      document.body.classList.remove("printing-report-sheet");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    setTimeout(() => {
      window.print();
      setTimeout(cleanup, 1200);
    }, 60);
  };

  const position = sheet?.summary.position ?? null;
  const classSize = sheet?.summary.classSize ?? 0;

  const cellInput = (
    value: string,
    onChange: (v: string) => void,
    opts: { align?: "center" | "left"; placeholder?: string; max?: number; text?: boolean } = {}
  ) =>
    editable ? (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={opts.text ? "text" : "numeric"}
        maxLength={opts.text ? 40 : 3}
        placeholder={opts.placeholder ?? ""}
        className={`w-full bg-transparent text-[9.5px] leading-tight outline-none focus:bg-amber-50 rounded-[2px] ${
          opts.align === "left" ? "text-left px-0.5" : "text-center"
        }`}
      />
    ) : (
      <span className="block text-[9.5px] leading-tight truncate">{value}</span>
    );

  const field = (english: string, arabic: string, value: ReactNode) => (
    <div className="flex items-end gap-1.5">
      <span className="text-[9.5px] font-semibold uppercase tracking-wide whitespace-nowrap shrink-0">
        {english}:
      </span>
      <span className="flex-1 min-w-0 border-b border-[#1f2937] pb-[1px] text-[10px] font-semibold">
        {value}
      </span>
      <span className="font-arabic text-[11px] whitespace-nowrap shrink-0" dir="rtl">
        {arabic}
      </span>
    </div>
  );

  const sheetBody = (isPrint: boolean) => {
    const subjects = live.subjects;
    return (
      <div
        className="report-sheet-page bg-white text-[#1f2937] mx-auto"
        style={{ fontFamily: "'Noto Sans', 'Inter', sans-serif", color: INK }}
      >
        <div className="border-[3px] border-double border-[#1f2937] p-[3px]">
          <div className="border border-[#1f2937] px-4 py-3">
            {/* Letterhead */}
            <div className="flex items-start justify-between gap-2">
              {SEAL}
              <div className="text-center flex-1 px-1">
                <h1 className="text-[11.5px] font-extrabold uppercase leading-tight tracking-[0.3px]">
                  AL-MUSTAFA ACADEMY FOR QUR&apos;AN MEMORIZATION &amp; ISLAMIC STUDIES
                </h1>
                <p className="text-[9px] font-semibold mt-[2px]">I/C KHALEEL-UR-RAHMAN GROUP OF SCHOOLS</p>
                <p className="text-[8px] mt-[2px] tracking-[0.2px]">
                  25, SABO-LINE ROAD, OPPOSITE SAW-MILL, ILORIN. | TEL: 08037525855
                </p>
              </div>
              <div className="shrink-0 w-[70px] text-right font-arabic" dir="rtl">
                <p className="text-[11px] font-bold leading-tight">أكاديمية المصطفى</p>
                <p className="text-[9px] leading-tight">لتحفيظ القرآن</p>
                <p className="text-[9px] leading-tight">والدراسات الإسلامية</p>
              </div>
            </div>

            {/* Title badge */}
            <div className="flex justify-center my-2">
              <div className="border-2 border-[#1f2937] px-4 py-[3px] text-center">
                <p className="text-[10.5px] font-extrabold uppercase tracking-[1px]">STUDIES REPORT SHEET</p>
                <p className="font-arabic text-[11px] leading-tight" dir="rtl">
                  كشف الدرجات
                </p>
              </div>
            </div>

            {/* Bio */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-[6px] mb-2">
              {field("Name of Student", "اسم الطالب", <span className="truncate block">{sheet?.student.full_name || "—"}</span>)}
              {field("Year / Session", "السنة الدراسية",
                editable && !isPrint ? (
                  <input
                    value={yearDraft}
                    onChange={(e) => setYearDraft(e.target.value)}
                    className="w-full bg-transparent text-[10px] font-semibold outline-none focus:bg-amber-50"
                  />
                ) : (
                  <span>{year}</span>
                ))}
              {field("Class", "الصف", <span className="truncate block">{sheet?.student.class_name || "—"}</span>)}
              {field("Term", "الفترة", <span>{ORDINALS[term]}</span>)}
              {field("Section", "القسم", <span>&nbsp;</span>)}
              {field("Grade", "تقدير", <span>{live.band.grade} — {live.band.label}</span>)}
              {field("Position", "الترتيب", <span>{position ? ordinal(position) : "—"}</span>)}
              {field("No. of Students", "عدد الطلاب", <span>{classSize || "—"}</span>)}
            </div>

            {/* Marks table */}
            <table className="w-full border-collapse table-fixed">
              <thead>
                <tr className="bg-[#f3f4f6]">
                  <th className="border border-[#1f2937] w-[17%] px-1 py-[3px]">
                    <p className="text-[8.5px] font-bold uppercase leading-tight">REMARKS</p>
                    <p className="font-arabic text-[9.5px] leading-tight" dir="rtl">الملاحظة</p>
                  </th>
                  <th className="border border-[#1f2937] w-[8%] px-1 py-[3px]">
                    <p className="text-[8.5px] font-bold uppercase leading-tight">TOTAL</p>
                    <p className="text-[7.5px] leading-tight">(Max 100)</p>
                    <p className="font-arabic text-[9.5px] leading-tight" dir="rtl">درجة المحصول</p>
                  </th>
                  <th className="border border-[#1f2937] w-[9%] px-1 py-[3px]">
                    <p className="text-[8.5px] font-bold uppercase leading-tight">TEST</p>
                    <p className="text-[7.5px] leading-tight">(Max 30)</p>
                    <p className="font-arabic text-[9.5px] leading-tight" dir="rtl">درجة الإختبار</p>
                  </th>
                  <th className="border border-[#1f2937] w-[9%] px-1 py-[3px]">
                    <p className="text-[8.5px] font-bold uppercase leading-tight">EXAM</p>
                    <p className="text-[7.5px] leading-tight">(Max 70)</p>
                    <p className="font-arabic text-[9.5px] leading-tight" dir="rtl">درجة الإمتحان</p>
                  </th>
                  <th className="border border-[#1f2937] w-[34%] px-1 py-[3px]">
                    <p className="text-[8.5px] font-bold uppercase leading-tight">SUBJECT</p>
                    <p className="font-arabic text-[9.5px] leading-tight" dir="rtl">المادة الدراسية</p>
                  </th>
                  <th className="border border-[#1f2937] w-[15%] px-1 py-[3px]">
                    <p className="text-[8.5px] font-bold uppercase leading-tight">ASSIGNMENT / WORK</p>
                    <p className="font-arabic text-[9.5px] leading-tight" dir="rtl">المهمة أو العمل</p>
                  </th>
                  <th className="border border-[#1f2937] w-[8%] px-1 py-[3px]">
                    <p className="text-[8.5px] font-bold uppercase leading-tight">ON</p>
                    <p className="font-arabic text-[9.5px] leading-tight" dir="rtl">على</p>
                  </th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((subject) => (
                  <tr key={subject.key}>
                    <td className="border border-[#1f2937] px-1 py-[2px] h-[21px]">
                      {cellInput(subject.remarks, (v) => updateRow(subject.key, "remarks", v), {
                        align: "left",
                        text: true,
                      })}
                    </td>
                    <td className="border border-[#1f2937] px-1 py-[2px] text-center text-[10px] font-bold">
                      {subject.total === null ? "" : subject.total}
                    </td>
                    <td className="border border-[#1f2937] px-1 py-[2px]">
                      {cellInput(rows[subject.key]?.exam ?? "", (v) => updateRow(subject.key, "exam", v))}
                    </td>
                    <td className="border border-[#1f2937] px-1 py-[2px]">
                      {cellInput(rows[subject.key]?.test ?? "", (v) => updateRow(subject.key, "test", v))}
                    </td>
                    <td className="border border-[#1f2937] px-1.5 py-[2px]">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="block text-[8px] leading-tight uppercase font-semibold">
                          {subject.english}
                        </span>
                        <span className="block font-arabic text-[9.5px] leading-tight" dir="rtl">
                          {subject.arabic}
                        </span>
                      </div>
                    </td>
                    <td className="border border-[#1f2937] px-1.5 py-[2px]">
                      {cellInput(subject.remarks, (v) => updateRow(subject.key, "remarks", v), {
                        align: "left",
                        text: true,
                      })}
                    </td>
                    <td className="border border-[#1f2937] px-1 py-[2px] text-center">
                      {subject.key.startsWith("quran_") || subject.key === "tajwid" || subject.key === "hadith" || subject.key === "fiqh" || subject.key === "tawhid" || subject.key === "tafsir" || subject.key === "nahw" || subject.key === "balaghah" || subject.key === "mutalaah" || subject.key === "poem" || subject.key === "adab" || subject.key === "history" || subject.key === "hadith_science" ? (
                        <span className="block text-[7.5px] leading-tight">100 (default)</span>
                      ) : (
                        <input
                          value={rows[subject.key]?.test ?? ""}
                          onChange={(e) => updateRow(subject.key, "test", e.target.value)}
                          inputMode="numeric"
                          maxLength={3}
                          className="w-full bg-transparent text-[8px] leading-tight outline-none border-b border-[#1f2937] px-0.5"
                        />
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="bg-[#f3f4f6]">
                  <td className="border border-[#1f2937] px-1 py-[3px] text-center text-[8px] font-bold uppercase">
                    TOTAL
                  </td>
                  <td className="border border-[#1f2937] px-1 py-[3px] text-center">
                    <span className="block text-[10px] font-extrabold">{live.testTotal + live.examTotal}</span>
                    <span className="block text-[7.5px] leading-tight">(Max {live.subjects.length * 100})</span>
                  </td>
                  <td className="border border-[#1f2937] px-1 py-[3px] text-center">
                    <span className="block text-[10px] font-extrabold">{live.examTotal}</span>
                    <span className="block text-[7.5px] leading-tight">(Max {live.subjects.length * 30})</span>
                  </td>
                  <td className="border border-[#1f2937] px-1 py-[3px] text-center">
                    <span className="block text-[10px] font-extrabold">{live.testTotal}</span>
                    <span className="block text-[7.5px] leading-tight">(Max {live.subjects.length * 70})</span>
                  </td>
                  <td className="border border-[#1f2937] px-1.5 py-[3px]">
                    <span className="block text-[8px] font-bold uppercase leading-tight">GRAND TOTAL</span>
                    <span className="block font-arabic text-[9.5px] leading-tight" dir="rtl">المجموع الكلي</span>
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>

            {/* Grading + remarks */}
            <div className="grid grid-cols-[1.05fr_1fr] gap-3 mt-3">
              <div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[#f3f4f6]">
                      <th className="border border-[#1f2937] text-[8px] font-bold px-1 py-[2px] w-[16%]">GRADE</th>
                      <th className="border border-[#1f2937] text-[8px] font-bold px-1 py-[2px] w-[22%]">RANGE</th>
                      <th className="border border-[#1f2937] text-[8px] font-bold px-1 py-[2px] w-[34%]">INTERPRETATION</th>
                      <th className="border border-[#1f2937] text-[8px] font-bold px-1 py-[2px]">التقدير</th>
                    </tr>
                  </thead>
                  <tbody>
                    {GRADING_SCALE.map((band) => (
                      <tr key={band.grade}>
                        <td className="border border-[#1f2937] text-center text-[9px] font-bold px-1 py-[2px]">
                          {band.grade}
                        </td>
                        <td className="border border-[#1f2937] text-center text-[8.5px] px-1 py-[2px]">
                          {band.min} – {band.max}
                        </td>
                        <td className="border border-[#1f2937] text-[8.5px] px-1 py-[2px]">{band.label}</td>
                        <td className="border border-[#1f2937] text-center font-arabic text-[10px] px-1 py-[2px]" dir="rtl">
                          {band.arabic}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-[7px]">
                <div>
                  <p className="text-[9px] font-bold uppercase">
                    General Remarks: <span className="font-arabic normal-case text-[10px]" dir="rtl">الملاحظات</span>
                  </p>
                  {editable && !isPrint ? (
                    <textarea
                      value={meta.general_remarks}
                      onChange={(e) => setMeta({ ...meta, general_remarks: e.target.value })}
                      rows={2}
                      maxLength={500}
                      className="w-full border-b border-[#1f2937] text-[9.5px] leading-tight outline-none resize-none focus:bg-amber-50"
                    />
                  ) : (
                    <p className="border-b border-[#1f2937] text-[9.5px] min-h-[26px] whitespace-pre-wrap">
                      {meta.general_remarks}
                    </p>
                  )}
                </div>
                {(
                  [
                    ["Promotion to", "منقول إلى", "promotion_to"],
                    ["Vacation", "بداية العطلة", "vacation"],
                    ["Resumption", "نهاية العطلة", "resumption"],
                  ] as const
                ).map(([label, arabic, key]) => (
                  <div key={key} className="flex items-end gap-1.5">
                    <span className="text-[9px] font-semibold uppercase whitespace-nowrap shrink-0">{label}:</span>
                    <span className="flex-1 min-w-0 border-b border-[#1f2937]">
                      {editable && !isPrint ? (
                        <input
                          value={meta[key]}
                          onChange={(e) => setMeta({ ...meta, [key]: e.target.value })}
                          maxLength={120}
                          className="w-full bg-transparent text-[9.5px] font-semibold outline-none focus:bg-amber-50"
                        />
                      ) : (
                        <span className="block text-[9.5px] font-semibold truncate">{meta[key]}</span>
                      )}
                    </span>
                    <span className="font-arabic text-[10px] whitespace-nowrap shrink-0" dir="rtl">{arabic}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 mt-6">
              {[
                ["توقيع العميد", "Principal Sign"],
                ["توقيع المشرف", "Teacher's Sign"],
              ].map(([arabic, english]) => (
                <div key={english} className="text-center">
                  <div className="border-b border-[#1f2937] h-5" />
                  <p className="font-arabic text-[10px] mt-[2px]" dir="rtl">{arabic}</p>
                  <p className="text-[8px] uppercase tracking-wide">{english}</p>
                </div>
              ))}
            </div>

            <p className="text-center text-[7px] mt-2 tracking-[0.3px] text-[#4b5563]">
              Percentage: {live.percentage}% &nbsp;|&nbsp; Printed on {pad(new Date().getDate())}/{pad(new Date().getMonth() + 1)}/{new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-surface-container-low">
      <div className="bg-primary text-white px-4 sm:px-6 py-3 no-print sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {onBack && (
              <button onClick={onBack} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="font-serif text-base font-bold truncate">Studies Report Sheet</h1>
              <p className="text-white/70 text-[11px] truncate">
                {sheet?.student.full_name || "Loading…"}
                {sheet?.student.class_name ? ` · ${sheet.student.class_name}` : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={term}
              onChange={(e) => setTerm(Number(e.target.value))}
              className="text-xs bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-white cursor-pointer outline-none"
            >
              <option value={1} className="text-black">First Term</option>
              <option value={2} className="text-black">Second Term</option>
              <option value={3} className="text-black">Third Term</option>
            </select>
            <input
              value={yearDraft}
              onChange={(e) => setYearDraft(e.target.value)}
              placeholder="Session e.g. 2026/2027"
              className="text-xs bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-white placeholder-white/50 w-36 outline-none"
            />
            {editable && (
              <button
                onClick={save}
                disabled={saving || loading}
                className="flex items-center gap-1.5 text-xs bg-secondary-container text-on-secondary-container hover:bg-secondary hover:text-white px-3 py-2 rounded-lg font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
            )}
            <button
              onClick={handlePrint}
              disabled={loading || !sheet}
              className="flex items-center gap-1.5 text-xs bg-white text-primary hover:bg-white/90 px-3 py-2 rounded-lg font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>
          </div>
        </div>

        {message && (
          <div className="max-w-5xl mx-auto mt-2">
            <p
              className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded ${
                message.type === "success" ? "bg-white/15 text-white" : "bg-red-500/20 text-red-100"
              }`}
            >
              {message.type === "success" ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              {message.text}
            </p>
          </div>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-2 sm:px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : !sheet ? (
          <div className="bg-white rounded-xl p-10 text-center">
            <AlertCircle className="w-8 h-8 text-on-surface-variant/30 mx-auto mb-2" />
            <p className="text-sm text-on-surface-variant">{message?.text || "Report sheet unavailable"}</p>
          </div>
        ) : (
          <>
            <p className="sm:hidden text-[10px] text-center text-on-surface-variant mb-2">
              Scroll sideways to see the full sheet
            </p>
            <div className="overflow-x-auto pb-2">
              <div className="min-w-[700px] max-w-[760px] mx-auto shadow-lg">{sheetBody(false)}</div>
            </div>
            {subjectLoadError && (
              <p className="text-[9px] text-center text-red-100 mt-1">{subjectLoadError}</p>
            )}
            {editable && (
              <div className="bg-white rounded-xl border border-primary/10 p-3 mt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-wide">Manage subjects printed on the sheet</span>
                  <div className="flex gap-1">
                    <input
                      ref={(el) => { (el as HTMLInputElement).focus(); }}
                      placeholder="New subject name"
                      maxLength={40}
                      className="text-[9px] border border-primary/20 rounded px-1.5 py-0.5 text-white bg-secondary/15 outline-none focus:bg-secondary focus:border-secondary"
                    />
                    <button
                      onClick={() => {
                        const input = document.querySelector("input[placeholder*=\'New subject name\']") as HTMLInputElement | null;
                        const name = input?.value?.trim();
                        if (!name) return;
                        const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
                        fetch(`${apiHost}/api/classes/${sheet?.student.class_id}/report-sheet/subjects`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ key, english: name, arabic: "", position: reportSubjects.length }),
                        })
                          .then(async (res) => {
                            const data = await res.json();
                            if (!res.ok) throw new Error(data?.error || "Failed to add subject");
                            await fetchReportSubjectsRef.current();
                            setMessage({ type: "success", text: "Subject added to report sheet" });
                          })
                          .catch((err: any) => setMessage({ type: "error", text: err?.message }));
                        input.value = "";
                      }}
                      className="text-[9px] bg-secondary text-on-secondary hover:bg-secondary-hover px-2 py-0.5 rounded transition-colors cursor-pointer"
                    >+ Add subject</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {reportSubjects.map((s) => {
                    const enabled = subjectKeys.has(s.key);
                    return (
                      <button key={s.key} title="Remove from report sheet"
                        onClick={async () => {
                          if (!sheet?.student.class_id) return;
                          await fetch(`${apiHost}/api/classes/${sheet.student.class_id}/report-sheet/subjects/${s.key}`, {
                            method: "DELETE",
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          await fetchReportSubjectsRef.current();
                          setMessage({ type: "success", text: `Subject removed: ${s.english}` });
                        }}
                        className={
                          `text-[8px] px-1.5 py-0.5 rounded transition-colors cursor-pointer border ${(enabled ? "bg-white/10 border-primary/20 text-primary" : "bg-white/5 border-transparent text-on-surface-variant")}`
                        }
                      >
                        {enabled ? "- " + s.english : s.english}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {createPortal(<div className="report-sheet-print">{sheetBody(true)}</div>, document.body)}
          </>
        )}
      </div>
    </motion.div>
  );
}
