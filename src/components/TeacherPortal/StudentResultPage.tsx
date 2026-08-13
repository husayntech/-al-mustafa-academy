import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Printer, Download, Loader2 } from "lucide-react";
import { Student, Subject, Result } from "../../types";
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
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetchResultSheetConfig().then((cfg) => {
      if (!active) return;
      setConfig(cfg);
      setLoadingConfig(false);
    });
    return () => {
      active = false;
    };
  }, []);

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
      </div>
    </motion.div>
  );
}
