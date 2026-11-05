// Shared definition of the official "STUDIES REPORT SHEET".
// Used by the React sheet (src/components/TeacherPortal/ReportSheet.tsx) and by
// the API in server.ts, so subject keys, score caps and grading can never drift.

export interface ReportSubject {
  key: string;
  english: string;
  arabic: string;
}

// The 13 subjects printed on every sheet, in printed order.
export const REPORT_SUBJECTS: ReportSubject[] = [
  { key: "quran", english: "QUR'AN MEMORIZATION", arabic: "حفظ القرآن" },
  { key: "tajwid", english: "TAJWID", arabic: "التجويد" },
  { key: "hadith", english: "HADITH", arabic: "الحديث" },
  { key: "hadith_science", english: "SCIENCE OF HADITH", arabic: "علوم الحديث" },
  { key: "fiqh", english: "JURISPRUDENCE", arabic: "الفقه" },
  { key: "tawhid", english: "THEOLOGY", arabic: "التوحيد" },
  { key: "tafsir", english: "EXEGESIS", arabic: "التفسير" },
  { key: "nahw", english: "ARABIC GRAMMAR", arabic: "النحو والقواعد" },
  { key: "balaghah", english: "RHETORIC", arabic: "البلاغة" },
  { key: "mutalaah", english: "ARABIC PASSAGE READING", arabic: "المطالعة \\ القراءة" },
  { key: "poem", english: "POEM", arabic: "المنظومة \\ النصوص" },
  { key: "adab", english: "ISLAMIC MORAL / ETHICS", arabic: "الأدب الإسلامي" },
  { key: "history", english: "ISLAMIC HISTORY", arabic: "التاريخ" },
];

export const MAX_TEST_SCORE = 30;
export const MAX_EXAM_SCORE = 70;
export const MAX_SUBJECT_TOTAL = MAX_TEST_SCORE + MAX_EXAM_SCORE; // 100

export const MAX_SHEET_TOTAL = REPORT_SUBJECTS.length * MAX_SUBJECT_TOTAL; // 1300
export const MAX_SHEET_EXAM = REPORT_SUBJECTS.length * MAX_EXAM_SCORE; // 910
export const MAX_SHEET_TEST = REPORT_SUBJECTS.length * MAX_TEST_SCORE; // 390

export const REPORT_TERMS = [1, 2, 3] as const;

export interface GradeBand {
  min: number;
  max: number;
  grade: string;
  label: string;
  arabic: string;
}

// Grading reference printed in the lower-left table of the sheet.
export const GRADING_SCALE: GradeBand[] = [
  { min: 80, max: 100, grade: "A", label: "Excellent", arabic: "ممتاز" },
  { min: 65, max: 79, grade: "B", label: "Very Good", arabic: "جيد جداً" },
  { min: 50, max: 64, grade: "C", label: "Credit / Good", arabic: "جيد" },
  { min: 40, max: 49, grade: "P", label: "Pass", arabic: "مقبول" },
  { min: 0, max: 39, grade: "F", label: "Fail", arabic: "راسب" },
];

/** Letter grade + interpretation for a percentage (0-100). */
export function gradeFor(percentage: number): GradeBand {
  const p = Number.isFinite(percentage) ? percentage : 0;
  return GRADING_SCALE.find((band) => p >= band.min) || GRADING_SCALE[GRADING_SCALE.length - 1];
}

/** Clamp a typed mark to 0..max; blank stays blank. */
export function clampScore(value: unknown, max: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(max, Math.round(n)));
}

/** Default academic session, e.g. "2026/2027" between September and August. */
export function defaultReportYear(now = new Date()): string {
  const y = now.getFullYear();
  return now.getMonth() >= 8 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

export interface SheetScoreRow {
  subject_key: string;
  test_score: number | null;
  exam_score: number | null;
  remarks: string | null;
}

export interface SheetSummary {
  testTotal: number;
  examTotal: number;
  total: number;
  percentage: number;
  grade: string;
  gradeLabel: string;
  gradeArabic: string;
  position: number | null;
  classSize: number;
}
