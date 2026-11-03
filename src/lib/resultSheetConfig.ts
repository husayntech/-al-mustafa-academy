/**
 * Pure data for the configurable Result Sheet — no client libraries imported,
 * so this can be safely imported from the server too.
 */

export const RESULT_SHEET_DEFAULTS: Record<string, string> = {
  school_name_en: "AL-MUSTAFA ACADEMY FOR QUR'AN MEMORIZATION & ISLAMIC STUDIES",
  school_name_ar: "مدرسة المصطفى لتحفيظ القرآن والدراسات الإسلامية",
  school_location: "ILORIN, NIGERIA",
  school_contact:
    "Tel: 080375255855 | I/C Khaleel-ur-Rahman Group of Schools, 25, Sabo-Line Road, Opposite Saw-Mill, Ilorin",
  result_title: "STUDENT RESULT SHEET / نتائج الطالب",
  footer_en: "Al-Mustafa Academy for Qur'an Memorization & Islamic Studies, Ilorin, Nigeria | Tel: 080375255855",
  footer_ar: "أكاديمية المصطفى — جسر بين التقاليد والتميز",
  grade_a: "70 - 100 | Excellent | ممتاز",
  grade_b: "60 - 69 | Very Good | جيد جداً",
  grade_c: "50 - 59 | Credit / Good | جيد",
  grade_p: "40 - 49 | Pass | مقبول",
  grade_f: "0 - 39 | Fail | راسب",
  result_sheet_template: `<div dir="rtl" style="font-family:Noto Sans, Arial, sans-serif;color:#1C1C1C;font-size:12px;line-height:1.45;">
  <!-- SCHOOL HEADER -->
  <header style="border-bottom:3px double #1f2937;text-align:center;padding-bottom:12px;margin-bottom:10px;">
    <div style="font-size:16px;font-weight:800;color:#0B6E4F;font-family:Amiri, 'Traditional Arabic', Arial, sans-serif;">{{school_name_ar}}</div>
    <div dir="ltr" style="font-size:14px;font-weight:800;color:#0B6E4F;margin-top:3px;letter-spacing:1px;">{{school_name_en}}</div>
    <div dir="ltr" style="font-size:10px;color:#5C5C5C;margin-top:3px;">{{school_location}}</div>
    <div dir="ltr" style="font-size:9px;color:#8A8A8A;margin-top:2px;">{{school_contact}}</div>
  </header>

  <!-- RESULT TITLE BANNER -->
  <div style="background:linear-gradient(135deg,#0B6E4F,#085c41);color:#fff;text-align:center;font-weight:800;letter-spacing:3px;padding:6px 0;border-radius:6px;font-size:12px;">{{result_title}}</div>

  <!-- STUDENT INFO -->
  <div dir="ltr" style="display:flex;justify-content:space-between;gap:10px;margin:14px 0;padding:10px 12px;background:#F7F5F0;border:1px solid #E4E2DA;border-radius:8px;">
    <div style="flex:1;"><span style="color:#5C5C5C;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;">Name / الاسم</span><br/><b style="font-size:12px;color:#1C1C1C;">{{student_name}}</b></div>
    <div style="flex:1;"><span style="color:#5C5C5C;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;">Class / الصف</span><br/><b style="font-size:12px;color:#1C1C1C;">{{class_name}}</b></div>
    <div style="flex:1;"><span style="color:#5C5C5C;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;">Term / الفصل</span><br/><b style="font-size:12px;color:#1C1C1C;">{{term_label}}</b></div>
    <div style="flex:1;"><span style="color:#5C5C5C;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;">Academic Year / السنة الدراسية</span><br/><b style="font-size:12px;color:#1C1C1C;">{{academic_year}}</b></div>
    <div style="flex:1;"><span style="color:#5C5C5C;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;">Date / التاريخ</span><br/><b style="font-size:12px;color:#1C1C1C;">{{date}}</b></div>
  </div>

  <!-- RESULTS TABLE -->
  {{results_table}}

  <!-- GENERAL REMARKS -->
  <div style="margin-top:16px;padding:10px 12px;background:#F7F5F0;border:1px solid #E4E2DA;border-radius:8px;">
    <div style="font-size:11px;font-weight:700;color:#0B6E4F;margin-bottom:6px;">General Remarks / ملاحظات عامة</div>
    <div style="border-bottom:1px solid #c9c4b8;height:28px;margin-bottom:10px;"></div>
    <div dir="ltr" style="display:flex;justify-content:space-between;gap:16px;">
      <div style="font-size:10px;color:#5C5C5C;"><b>Position / المركز:</b> _______________
      </div>
      <div style="font-size:10px;color:#5C5C5C;"><b>No. of Students / عدد الطلاب:</b> _______________
      </div>
    </div>
  </div>

  <!-- SIGNATURES -->
  <div dir="ltr" style="display:flex;justify-content:space-between;gap:16px;margin-top:22px;padding:0 8px;">
    <div style="flex:1;text-align:center;"><div style="border-top:2px solid #1C1C1C;width:140px;margin:38px auto 5px;"></div><div style="font-size:10px;font-weight:700;color:#1C1C1C;">Teacher's Signature</div><div style="font-size:9px;color:#5C5C5C;">توقيع المعلم</div></div>
    <div style="flex:1;text-align:center;"><div style="border-top:2px solid #1C1C1C;width:140px;margin:38px auto 5px;"></div><div style="font-size:10px;font-weight:700;color:#1C1C1C;">Class Teacher's Signature</div><div style="font-size:9px;color:#5C5C5C;">توقيع معلم الصف</div></div>
    <div style="flex:1;text-align:center;"><div style="border-top:2px solid #1C1C1C;width:140px;margin:38px auto 5px;"></div><div style="font-size:10px;font-weight:700;color:#1C1C1C;">Principal's Signature</div><div style="font-size:9px;color:#5C5C5C;">توقيع المدير</div></div>
  </div>

  <!-- FOOTER -->
  <div style="text-align:center;margin-top:16px;padding-top:8px;border-top:1px solid #E4E2DA;">
    <div dir="ltr" style="font-size:8px;color:#8A8A8A;">{{footer_en}}</div>
    <div style="font-size:8px;color:#8A8A8A;margin-top:1px;">{{footer_ar}}</div>
  </div>
</div>`,
};

/** Tokens admins can drop into the template; values are computed per student. */
export const RESULT_SHEET_PLACEHOLDERS: { token: string; label: string }[] = [
  { token: "{{school_name_ar}}", label: "School name (AR)" },
  { token: "{{school_name_en}}", label: "School name (EN)" },
  { token: "{{school_location}}", label: "Location" },
  { token: "{{school_contact}}", label: "Contact" },
  { token: "{{result_title}}", label: "Sheet title" },
  { token: "{{student_name}}", label: "Student name" },
  { token: "{{class_name}}", label: "Class" },
  { token: "{{class_name_arabic}}", label: "Class (AR)" },
  { token: "{{term_label}}", label: "Term" },
  { token: "{{term_label_ar}}", label: "Term (AR)" },
  { token: "{{date}}", label: "Date" },
  { token: "{{academic_year}}", label: "Academic year" },
  { token: "{{results_table}}", label: "Scores table" },
  { token: "{{grading_scale}}", label: "Grading scale" },
  { token: "{{grand_total}}", label: "Grand total" },
  { token: "{{max_total}}", label: "Max total" },
  { token: "{{overall_grade}}", label: "Overall grade" },
  { token: "{{footer_en}}", label: "Footer (EN)" },
  { token: "{{footer_ar}}", label: "Footer (AR)" },
];

export const TERM_LABELS = ["First Term", "Second Term", "Third Term"];
export const TERM_LABELS_AR = ["الفصل الأول", "الفصل الثاني", "الفصل الثالث"];
