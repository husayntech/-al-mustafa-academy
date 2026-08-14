import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Printer, Download, Loader2 } from "lucide-react";
import { Student, Subject, Result, TermReport } from "../../types";
import {
  fetchResultSheetConfig,
  buildResultSheetData,
  renderResultSheetTemplate,
  renderSheetToPDF,
} from "../../lib/resultSheet";
import { RESULT_SHEET_DEFAULTS } from "../../lib/resultSheetConfig";

interface StudentResultPageProps {
  student: Student;
  className: string;
  classNameArabic?: string;
  subjects: Subject[];
  results: Result[];
  term: number;
  academicYear: string;
  onBack: () => void;
}

export default function StudentResultPage({
  student,
  className,
  classNameArabic,
  subjects,
  results,
  term,
  academicYear,
  onBack,
}: StudentResultPageProps) {
  const [config, setConfig] = useState<Record<string, string>>(RESULT_SHEET_DEFAULTS);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [termReport, setTermReport] = useState<TermReport | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetchResultSheetConfig().then((cfg) => {
      if (!active) return;
      setConfig(cfg);
      setLoadingConfig(false);
    });
    fetch(`/api/students/${student.id}/term-report?term=${term}&year=${encodeURIComponent(academicYear)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.report) setTermReport(data.report);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Subjects with any CA breakdown recorded
  const caRows = results.filter((r) => r.ca1_score != null || r.ca2_score != null || r.ca3_score != null);
  const hasCa = caRows.length > 0;
  const caTotal = (r: Result) =>
    ((r.ca1_score as number) || 0) + ((r.ca2_score as number) || 0) + ((r.ca3_score as number) || 0);

  const data = buildResultSheetData({
    config,
    studentName: student.full_name,
    className,
    classNameArabic,
    subjects,
    results,
    term,
    academicYear,
  });

  const sheetHtml = renderResultSheetTemplate(
    config.result_sheet_template || RESULT_SHEET_DEFAULTS.result_sheet_template,
    data
  );

  const handleDownloadPDF = async () => {
    setExporting(true);
    try {
      await renderSheetToPDF(
        config.result_sheet_template || RESULT_SHEET_DEFAULTS.result_sheet_template,
        data,
        `${student.full_name.replace(/\s+/g, "_")}_Term${term}_Result.pdf`
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-background">
      {/* Header (hidden when printing) */}
      <div className="no-print bg-primary text-white px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-serif text-lg font-bold">Student Result Sheet</h1>
              <p className="text-white/70 text-xs">
                {student.full_name} · {className} · Term {term}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              disabled={exporting || loadingConfig}
              className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin text-secondary-fixed" /> : <Download className="w-4 h-4 text-secondary-fixed" />}
              <span className="hidden sm:inline">{exporting ? "Preparing…" : "Download PDF"}</span>
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 text-xs bg-secondary-container text-on-secondary-container hover:bg-secondary hover:text-white px-3 py-2 rounded-lg transition-colors cursor-pointer font-semibold"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print</span>
            </button>
          </div>
        </div>
      </div>

      {/* Result Sheet Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {loadingConfig ? (
          <div className="bg-white rounded-xl shadow-lg p-16 text-center">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-xs text-on-surface-variant">Loading result sheet design…</p>
          </div>
        ) : (
          <div
            ref={sheetRef}
            className="print-sheet bg-white rounded-xl shadow-lg overflow-hidden"
            dangerouslySetInnerHTML={{ __html: sheetHtml }}
          />
        )}

        {/* Term Report — CA breakdown, Hifdh progress & behaviour remarks */}
        {(hasCa || termReport?.hifdh_progress || termReport?.behavior_remarks) && (
          <div className="print-sheet bg-white rounded-xl shadow-lg overflow-hidden mt-8">
            <div className="bg-primary text-white px-6 py-3.5">
              <h2 className="font-serif text-base font-bold">Term Report</h2>
              <p className="text-white/70 text-xs">Continuous Assessment · Qur'an Hifdh · Behaviour — Term {term}</p>
            </div>
            <div className="p-6">
              {hasCa && (
                <div className="mb-6">
                  <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">Continuous Assessment Breakdown (each component /10)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-surface-container-low">
                          <th className="border border-primary/10 px-3 py-2 text-left font-bold text-primary">Subject</th>
                          <th className="border border-primary/10 px-3 py-2 text-center font-bold text-primary">CA1</th>
                          <th className="border border-primary/10 px-3 py-2 text-center font-bold text-primary">CA2</th>
                          <th className="border border-primary/10 px-3 py-2 text-center font-bold text-primary">CA3</th>
                          <th className="border border-primary/10 px-3 py-2 text-center font-bold text-primary">CA Total /30</th>
                        </tr>
                      </thead>
                      <tbody>
                        {caRows.map((r) => (
                          <tr key={r.subject_id}>
                            <td className="border border-primary/10 px-3 py-2 font-semibold text-primary">{r.subject_name || r.subject_id}</td>
                            <td className="border border-primary/10 px-3 py-2 text-center">{r.ca1_score ?? "-"}</td>
                            <td className="border border-primary/10 px-3 py-2 text-center">{r.ca2_score ?? "-"}</td>
                            <td className="border border-primary/10 px-3 py-2 text-center">{r.ca3_score ?? "-"}</td>
                            <td className="border border-primary/10 px-3 py-2 text-center font-bold text-primary">{caTotal(r)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(termReport?.hifdh_progress || "") && (
                  <div>
                    <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Qur'an Hifdh Progress</h3>
                    <p className="text-sm text-on-surface leading-relaxed whitespace-pre-line">{termReport?.hifdh_progress}</p>
                  </div>
                )}
                {(termReport?.behavior_remarks || "") && (
                  <div>
                    <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Behavioural Remarks</h3>
                    <p className="text-sm text-on-surface leading-relaxed whitespace-pre-line">{termReport?.behavior_remarks}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
