import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, Trash2, X } from "lucide-react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-black/50 backdrop-blur-xs cursor-pointer"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-white rounded-2xl border border-red-100 max-w-md w-full p-6 shadow-2xl relative z-10"
          >
            {/* Close button */}
            <button
              onClick={onCancel}
              className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>

            {/* Icon */}
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
              danger ? "bg-red-50" : "bg-amber-50"
            }`}>
              {danger ? (
                <Trash2 className="w-7 h-7 text-red-500" />
              ) : (
                <AlertTriangle className="w-7 h-7 text-amber-500" />
              )}
            </div>

            {/* Title */}
            <h3 className="font-serif text-lg font-bold text-gray-900 mb-2 pr-8">
              {title}
            </h3>

            {/* Message */}
            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              {message}
            </p>

            {/* Warning banner for danger actions */}
            {danger && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-6 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs text-red-600 font-medium">
                  This action cannot be undone. All data will be permanently deleted.
                </p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold cursor-pointer hover:bg-gray-50 transition-colors"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-all flex items-center justify-center gap-2 ${
                  danger
                    ? "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-200"
                    : "bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-200"
                }`}
              >
                {danger && <Trash2 className="w-4 h-4" />}
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
