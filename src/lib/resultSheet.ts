import { Subject, Result } from "../types.js";
import { RESULT_SHEET_DEFAULTS, RESULT_SHEET_PLACEHOLDERS, TERM_LABELS, TERM_LABELS_AR } from "./resultSheetConfig.js";

/** Minimal HTML-escape for values interpolated into the sheet HTML. */
const esc = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Convert Western numerals to Arabic-Indic numerals
export const toArabicIndic = (num: number): string => {
  const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return num
    .toString()
    .split("")
    .map((digit) => {
      const parsed = parseInt(digit, 10);
      return isNaN(parsed) ? digit : arabicDigits[parsed];
    })
    .join("");
};

const GRADING_RANGES = [
  { grade: "A", min: 70, max: 100 },
  { grade: "B", min: 60, max: 69 },
  { grade: "C", min: 50, max: 59 },
  { grade: "P", min: 40, max: 49 },
  { grade: "F", min: 0, max: 39 },
];

export function calculateGrade(total: number): string {
  const entry = GRADING_RANGES.find((g) => total >= g.min && total <= g.max);
  return entry?.grade || "F";
}

export function getGradeRemark(grade: string, config: Record<string, string>): string {
  const map: Record<string, string> = {
    A: config.grade_a || RESULT_SHEET_DEFAULTS.grade_a,
    B: config.grade_b || RESULT_SHEET_DEFAULTS.grade_b,
    C: config.grade_c || RESULT_SHEET_DEFAULTS.grade_c,
    P: config.grade_p || RESULT_SHEET_DEFAULTS.grade_p,
    F: config.grade_f || RESULT_SHEET_DEFAULTS.grade_f,
  };
  const parts = (map[grade] || "").split("|").map((s) => s.trim());
  return parts[1] || grade;
}

// Arabic names used for the official subject list (matches database subjects)
const OFFICIAL_SUBJECTS = [
  { nameArabic: "تحفيظ القرآن", nameEnglish: "Qur'an Memorization" },
  { nameArabic: "التجويد", nameEnglish: "Tajwid" },
  { nameArabic: "الحديث", nameEnglish: "Hadith" },
  { nameArabic: "علوم الحديث", nameEnglish: "Science of Hadith" },
  { nameArabic: "الفقه", nameEnglish: "Jurisprudence (Fiqh)" },
  { nameArabic: "العقيدة", nameEnglish: "Theology (Aqeedah)" },
  { nameArabic: "التفسير", nameEnglish: "Exegesis (Tafsir)" },
  { nameArabic: "النحو", nameEnglish: "Arabic Grammar (Nahw)" },
  { nameArabic: "البلاغة", nameEnglish: "Rhetoric (Balaghah)" },
  { nameArabic: "القراءة العربية", nameEnglish: "Arabic Passage Reading" },
  { nameArabic: "النظم", nameEnglish: "Poem (Nazm)" },
  { nameArabic: "الآداب الإسلامية", nameEnglish: "Islamic Moral / Ethics" },
  { nameArabic: "التاريخ الإسلامي", nameEnglish: "Islamic History" },
];

function findArabicName(subjectName: string): string {
  const match = OFFICIAL_SUBJECTS.find(
    (o) =>
      subjectName.toLowerCase().includes(o.nameEnglish.toLowerCase()) ||
      subjectName.toLowerCase().includes(o.nameArabic)
  );
  return match?.nameArabic || "";
}

export interface ResultSheetDataInput {
  config: Record<string, string>;
  studentName: string;
  className: string;
  classNameArabic?: string;
  subjects: Subject[];
  results: Result[];
  term: number;
  academicYear: string;
}

/**
 * Builds the scores table with:
 * - Subjects on the RIGHT side (Arabic layout)
 * - Remarks at the end (rightmost column)
 * - NO grade column
 * - Bilingual headers (English + Arabic)
 * - For term 3: cumulative scores from terms 1, 2, and 3
 */
export function buildResultsTableHTML(config: Record<string, string>, subjects: Subject[], results: Result[], term: number): string {
  const resultsMap: Record<number, Result> = {};
  results.forEach((r) => {
    resultsMap[r.subject_id] = r;
  });

  const isCumulative = term === 3;

  const rows = subjects
    .map((subj) => {
      const result = resultsMap[subj.id];
      const test = result?.test_score ?? null;
      const exam = result?.exam_score ?? null;
      const total = (test ?? 0) + (exam ?? 0);
      const remark = result?.remarks?.trim() || "";
      const arabic = findArabicName(subj.name);
      
      // RTL order: Subject AR (rightmost) → Subject EN → Total → Exam → Test → Remarks (leftmost)
      return `<tr>
        <td style="border:1px solid #c9c4b8;padding:6px 8px;text-align:right;font-weight:600;">${arabic ? esc(arabic) : ""}</td>
        <td style="border:1px solid #c9c4b8;padding:6px 8px;text-align:right;font-weight:600;">${esc(subj.name)}</td>
        <td style="border:1px solid #c9c4b8;padding:6px 8px;text-align:center;font-weight:700;">${total > 0 ? `${total} (${toArabicIndic(total)})` : "-"}</td>
        <td style="border:1px solid #c9c4b8;padding:6px 8px;text-align:center;">${exam !== null ? `${exam} (${toArabicIndic(exam)})` : "-"}</td>
        <td style="border:1px solid #c9c4b8;padding:6px 8px;text-align:center;">${test !== null ? `${test} (${toArabicIndic(test)})` : "-"}</td>
        <td style="border:1px solid #c9c4b8;padding:6px 8px;text-align:center;">${esc(remark)}</td>
      </tr>`;
    })
    .join("");

  const grandTotal = subjects.reduce((sum, s) => {
    const r = resultsMap[s.id];
    return sum + ((r?.test_score ?? 0) + (r?.exam_score ?? 0));
  }, 0);
  const maxTotal = subjects.length * 100;
  // RTL table: columns read right-to-left
  return `<table style="width:100%;border-collapse:collapse;font-size:12px;" dir="rtl">
    <thead>
      <tr style="background:#0B6E4F;color:#fff;">
        <th style="padding:7px 8px;border:1px solid #0B6E4F;width:15%;">المادة<br/><span style="font-size:9px;">Subject (AR)</span></th>
        <th style="padding:7px 8px;border:1px solid #0B6E4F;width:20%;">Subject (EN)<br/><span style="font-size:9px;">المادة</span></th>
        <th style="padding:7px 8px;border:1px solid #0B6E4F;width:14%;">Total (100)<br/><span style="font-size:9px;">المجموع</span></th>
        <th style="padding:7px 8px;border:1px solid #0B6E4F;width:12%;">Exam (70)<br/><span style="font-size:9px;">امتحان</span></th>
        <th style="padding:7px 8px;border:1px solid #0B6E4F;width:12%;">Test (30)<br/><span style="font-size:9px;">اختبار</span></th>
        <th style="padding:7px 8px;border:1px solid #0B6E4F;width:18%;">Remarks<br/><span style="font-size:9px;">ملاحظات</span></th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr style="background:#f5e6b8;font-weight:700;">
        <td colspan="2" style="border:1px solid #c9c4b8;padding:7px 8px;text-align:right;">GRAND TOTAL / المجموع الكلي</td>
        <td style="border:1px solid #c9c4b8;padding:7px 8px;text-align:center;">${grandTotal} / ${maxTotal} <span style="font-weight:400;font-size:10px;">(${toArabicIndic(grandTotal)} / ${toArabicIndic(maxTotal)})</span></td>
        <td style="border:1px solid #c9c4b8;padding:7px 8px;text-align:center;"></td>
        <td style="border:1px solid #c9c4b8;padding:7px 8px;text-align:center;"></td>
        <td style="border:1px solid #c9c4b8;padding:7px 8px;text-align:center;"></td>
      </tr>
    </tbody>
  </table>`;
}

/** Builds the grading scale table as styled HTML (from config text). */
export function buildGradingScaleHTML(config: Record<string, string>): string {
  const grades = [
    { key: "grade_a", grade: "A" },
    { key: "grade_b", grade: "B" },
    { key: "grade_c", grade: "C" },
    { key: "grade_p", grade: "P" },
    { key: "grade_f", grade: "F" },
  ];
  const rows = grades
    .map((g) => {
      const parts = (config[g.key] || RESULT_SHEET_DEFAULTS[g.key]).split("|").map((s) => s.trim());
      const range = parts[0] || "-";
      const en = parts[1] || "-";
      const ar = parts[2] || "";
      return `<tr>
        <td style="border:1px solid #c9c4b8;padding:5px 8px;text-align:center;font-weight:700;">${g.grade}</td>
        <td style="border:1px solid #c9c4b8;padding:5px 8px;text-align:center;">${range}</td>
        <td style="border:1px solid #c9c4b8;padding:5px 8px;text-align:center;">${en}${ar ? ` (${ar})` : ""}</td>
      </tr>`;
    })
    .join("");
  return `<table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:12px;" dir="rtl">
    <thead>
      <tr style="background:#D4AF37;color:#1C1C1C;">
        <th style="padding:5px 8px;border:1px solid #D4AF37;">التقدير / Grade</th>
        <th style="padding:5px 8px;border:1px solid #D4AF37;">النطاق / Score Range</th>
        <th style="padding:5px 8px;border:1px solid #D4AF37;">المعنى / Interpretation</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/**
 * Builds every placeholder token value for a given student/term.
 * For term 3 (cumulative): averages across terms 1, 2, and 3.
 */
export function buildResultSheetData(input: ResultSheetDataInput): Record<string, string> {
  const { config, studentName, className, classNameArabic, subjects, results, term, academicYear } = input;
  const currentDate = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
  const termLabel = TERM_LABELS[term - 1] || `Term ${term}`;
  const termLabelAr = TERM_LABELS_AR[term - 1] || "";

  // For term 3, compute cumulative average across terms 1, 2, and 3
  let scopedResults: Result[];
  
  if (term === 3) {
    // Cumulative: average of all three terms for each subject
    const allTermResults = results.filter((r) => r.term >= 1 && r.term <= 3 && (!academicYear || r.year === academicYear));
    
    // Group by subject
    const subjectResults: Record<number, { testTotal: number; examTotal: number; count: number; remarks: string }> = {};
    
    for (const r of allTermResults) {
      if (!subjectResults[r.subject_id]) {
        subjectResults[r.subject_id] = { testTotal: 0, examTotal: 0, count: 0, remarks: "" };
      }
      subjectResults[r.subject_id].testTotal += r.test_score ?? 0;
      subjectResults[r.subject_id].examTotal += r.exam_score ?? 0;
      subjectResults[r.subject_id].count++;
      if (r.remarks) subjectResults[r.subject_id].remarks = r.remarks;
    }
    
    // Create averaged results for term 3 display
    scopedResults = subjects.map((subj) => {
      const agg = subjectResults[subj.id];
      if (!agg || agg.count === 0) {
        return {
          id: 0,
          student_id: 0,
          subject_id: subj.id,
          term: 3,
          year: academicYear,
          test_score: null,
          exam_score: null,
          total_score: null,
          remarks: null,
          created_at: "",
        };
      }
      const avgTest = Math.round((agg.testTotal / agg.count) * 10) / 10;
      const avgExam = Math.round((agg.examTotal / agg.count) * 10) / 10;
      return {
        id: 0,
        student_id: 0,
        subject_id: subj.id,
        term: 3,
        year: academicYear,
        test_score: avgTest,
        exam_score: avgExam,
        total_score: Math.round(avgTest + avgExam),
        remarks: agg.remarks || null,
        created_at: "",
      };
    });
  } else {
    // Normal term: scope to requested term
    scopedResults = results.filter((r) => r.term === term && (!academicYear || r.year === academicYear));
  }
  
  const resultsMap: Record<number, Result> = {};
  scopedResults.forEach((r) => {
    resultsMap[r.subject_id] = r;
  });
  const grandTotal = subjects.reduce((sum, s) => {
    const r = resultsMap[s.id];
    return sum + ((r?.test_score ?? 0) + (r?.exam_score ?? 0));
  }, 0);
  const maxTotal = subjects.length * 100;
  const overallGrade = maxTotal > 0 && grandTotal > 0 ? calculateGrade(Math.round((grandTotal / maxTotal) * 100)) : "-";

  return {
    school_name_en: config.school_name_en || RESULT_SHEET_DEFAULTS.school_name_en,
    school_name_ar: config.school_name_ar || RESULT_SHEET_DEFAULTS.school_name_ar,
    school_location: config.school_location || RESULT_SHEET_DEFAULTS.school_location,
    school_contact: config.school_contact || RESULT_SHEET_DEFAULTS.school_contact,
    result_title: config.result_title || RESULT_SHEET_DEFAULTS.result_title,
    footer_en: config.footer_en || RESULT_SHEET_DEFAULTS.footer_en,
    footer_ar: config.footer_ar || RESULT_SHEET_DEFAULTS.footer_ar,
    student_name: studentName,
    class_name: className,
    class_name_arabic: classNameArabic || "",
    term_label: term === 3 ? `${termLabel} (Cumulative / تراكمي)` : `${termLabel} (${term}/3)`,
    term_label_ar: term === 3 ? `${termLabelAr} (تراكمي)` : termLabelAr,
    date: currentDate,
    academic_year: academicYear,
    results_table: buildResultsTableHTML(config, subjects, scopedResults, term),
    grading_scale: buildGradingScaleHTML(config),
    grand_total: grandTotal.toString(),
    max_total: maxTotal.toString(),
    overall_grade: overallGrade,
  };
}

/** Replaces {{tokens}} in the admin-authored template. */
export function renderResultSheetTemplate(template: string, data: Record<string, string>): string {
  let html = template;
  for (const p of RESULT_SHEET_PLACEHOLDERS) {
    html = html.split(p.token).join(data[p.token] ?? "");
  }
  return html;
}

/** Fetches the current result-sheet config (public read endpoint), merged with defaults. */
export async function fetchResultSheetConfig(): Promise<Record<string, string>> {
  try {
    const res = await fetch("/api/result-sheet-config");
    if (!res.ok) return { ...RESULT_SHEET_DEFAULTS };
    const data = await res.json();
    return { ...RESULT_SHEET_DEFAULTS, ...(data.config || {}) };
  } catch {
    return { ...RESULT_SHEET_DEFAULTS };
  }
}

/** Renders the sheet (off-screen) and exports a multi-page PDF via html2canvas. */
export async function renderSheetToPDF(template: string, data: Record<string, string>, filename: string): Promise<boolean> {
  let host: HTMLDivElement | null = null;
  try {
    const html = renderResultSheetTemplate(template, data);
    host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-12000px;top:0;width:794px;background:#fff;z-index:-1;";
    host.innerHTML = html;
    document.body.appendChild(host);

    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(host, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const { jsPDF } = await import("jspdf");
    const imgData = canvas.toDataURL("image/jpeg", 0.94);
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pageW) / canvas.width;

    let heightLeft = imgH;
    let position = 0;
    pdf.addImage(imgData, "JPEG", 0, position, pageW, imgH);
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position -= pageH;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, pageW, imgH);
      heightLeft -= pageH;
    }
    pdf.save(filename);
    return true;
  } catch (err) {
    console.error("PDF render failed:", err);
    return false;
  } finally {
    if (host) document.body.removeChild(host);
  }
}
