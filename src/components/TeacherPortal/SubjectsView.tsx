import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, BookOpen, Plus, Edit2, Trash2, X, BookText, User, Upload, FileText } from "lucide-react";
import { Subject, Class } from "../../types";
import ConfirmModal from "./ConfirmModal";

interface SubjectsViewProps {
  classData: Class;
  token: string;
  onBack: () => void;
}

export default function SubjectsView({ classData, token, onBack }: SubjectsViewProps) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [name, setName] = useState("");
  const [bookName, setBookName] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [saving, setSaving] = useState(false);

  // Batch import state
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchResult, setBatchResult] = useState<{ success: boolean; message: string } | null>(null);

  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({
    open: false, title: "", message: "", onConfirm: () => {},
  });

  const handleDeleteAll = async () => {
    setConfirmModal({
      open: true,
      title: "Delete All Subjects?",
      message: `This will permanently delete ALL ${subjects.length} subjects in ${classData.name} and all student results for this class. This action cannot be undone.`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/classes/${classData.id}/subjects/all`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            setSubjects([]);
          }
        } catch (err) {
          console.error("Failed to delete all subjects:", err);
        }
        setConfirmModal({ open: false, title: "", message: "", onConfirm: () => {} });
      },
    });
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    try {
      const res = await fetch(`/api/classes/${classData.id}/subjects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSubjects(data.subjects || []);
    } catch (err) {
      console.error("Failed to fetch subjects:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingSubject(null);
    setName("");
    setBookName("");
    setBookAuthor("");
    setShowModal(true);
  };

  const handleOpenEdit = (subject: Subject) => {
    setEditingSubject(subject);
    setName(subject.name);
    setBookName(subject.book_name || "");
    setBookAuthor(subject.book_author || "");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);

    try {
      if (editingSubject) {
        const res = await fetch(`/api/subjects/${editingSubject.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: name.trim(), book_name: bookName.trim(), book_author: bookAuthor.trim() }),
        });
        if (res.ok) {
          setShowModal(false);
          fetchSubjects();
        }
      } else {
        const res = await fetch(`/api/classes/${classData.id}/subjects`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: name.trim(), book_name: bookName.trim(), book_author: bookAuthor.trim() }),
        });
        if (res.ok) {
          setShowModal(false);
          fetchSubjects();
        }
      }
    } catch (err) {
      console.error("Failed to save subject:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleBatchImport = async () => {
    if (!batchText.trim()) return;
    setBatchSaving(true);
    setBatchResult(null);

    // Parse each line: Subject Name | Book Name | Author
    const lines = batchText.split("\n").filter((l) => l.trim());
    const subjectsToAdd = lines.map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      return {
        name: parts[0] || "",
        book_name: parts[1] || "",
        book_author: parts[2] || "",
      };
    });

    try {
      let addedCount = 0;
      for (const subj of subjectsToAdd) {
        if (!subj.name) continue;
        const res = await fetch(`/api/classes/${classData.id}/subjects`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(subj),
        });
        if (res.ok) addedCount++;
      }
      setBatchResult({ success: true, message: `${addedCount} subjects added successfully!` });
      setBatchText("");
      fetchSubjects();
      setTimeout(() => {
        setShowBatchModal(false);
        setBatchResult(null);
      }, 2000);
    } catch (err) {
      setBatchResult({ success: false, message: "Failed to import subjects" });
    } finally {
      setBatchSaving(false);
    }
  };

  const handleDelete = async (subject: Subject) => {
    setConfirmModal({
      open: true,
      title: `Delete "${subject.name}"?`,
      message: `This will permanently remove the subject "${subject.name}" and all related student results. This action cannot be undone.`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/subjects/${subject.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) fetchSubjects();
        } catch (err) {
          console.error("Failed to delete subject:", err);
        }
        setConfirmModal({ open: false, title: "", message: "", onConfirm: () => {} });
      },
    });
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
              <h1 className="font-serif text-lg font-bold">Subjects & Books</h1>
              <p className="text-white/70 text-xs">{classData.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBatchModal(true)}
              className="flex items-center gap-1.5 text-xs bg-secondary-container text-on-secondary-container hover:bg-secondary hover:text-white px-3 py-2 rounded-lg transition-colors cursor-pointer font-semibold"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Batch Import</span>
            </button>
            <button
              onClick={handleDeleteAll}
              className="flex items-center gap-1.5 text-xs bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-3 py-2 rounded-lg transition-colors cursor-pointer font-semibold border border-red-200"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Delete All</span>
            </button>
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 text-xs bg-secondary-container text-on-secondary-container hover:bg-secondary hover:text-white px-3 py-2 rounded-lg transition-colors cursor-pointer font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Subject</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {subjects.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-16 h-16 text-on-surface-variant/20 mx-auto mb-4" />
            <p className="text-on-surface-variant text-sm">No subjects added yet</p>
            <button
              onClick={handleOpenAdd}
              className="mt-4 text-secondary hover:text-primary text-sm font-semibold cursor-pointer"
            >
              + Add your first subject
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {subjects.map((subject, index) => (
              <motion.div
                key={subject.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white border border-primary/5 rounded-xl p-5 hover:shadow-md hover:border-secondary/20 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-secondary-fixed/20 flex items-center justify-center shrink-0">
                      <BookText className="w-5 h-5 text-secondary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-serif font-bold text-primary text-base">{subject.name}</h3>
                      {subject.book_name && (
                        <div className="mt-1.5 flex items-start gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-on-surface-variant/50 mt-0.5 shrink-0" />
                          <p className="text-xs text-on-surface-variant leading-relaxed">{subject.book_name}</p>
                        </div>
                      )}
                      {subject.book_author && (
                        <div className="flex items-start gap-1.5 mt-0.5">
                          <User className="w-3.5 h-3.5 text-on-surface-variant/50 mt-0.5 shrink-0" />
                          <p className="text-xs text-on-surface-variant/70 italic">by {subject.book_author}</p>
                        </div>
                      )}
                      {!subject.book_name && !subject.book_author && (
                        <p className="text-xs text-on-surface-variant/50 mt-1">No book information</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenEdit(subject)}
                      className="p-1.5 text-on-surface-variant/50 hover:text-secondary hover:bg-secondary/5 rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(subject)}
                      className="p-1.5 text-on-surface-variant/50 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Subject Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs cursor-pointer"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl border border-primary/10 max-w-md w-full p-6 shadow-2xl relative z-10"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-lg font-bold text-primary">
                  {editingSubject ? "Edit Subject" : "Add Subject"}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                    Subject Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Arabiyyah"
                    className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary transition-colors"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                    Book Name
                  </label>
                  <input
                    type="text"
                    value={bookName}
                    onChange={(e) => setBookName(e.target.value)}
                    placeholder="Arabiyyah"
                    className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                    Author
                  </label>
                  <input
                    type="text"
                    value={bookAuthor}
                    onChange={(e) => setBookAuthor(e.target.value)}
                    placeholder="Dr Ibrahim"
                    className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary transition-colors"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-primary/20 text-on-surface-variant py-2.5 rounded-lg text-xs font-semibold cursor-pointer hover:bg-surface-container transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !name.trim()}
                  className="flex-1 bg-primary text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-primary-container disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                >
                  {saving ? "Saving..." : editingSubject ? "Update" : "Add Subject"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Batch Import Modal */}
      <AnimatePresence>
        {showBatchModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBatchModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs cursor-pointer"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl border border-primary/10 max-w-lg w-full p-6 shadow-2xl relative z-10"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-lg font-bold text-primary">
                  Batch Import Subjects
                </h3>
                <button
                  onClick={() => setShowBatchModal(false)}
                  className="p-1 hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-on-surface-variant mb-3">
                Enter one subject per line. Format: <strong>Subject Name | Book Name | Author</strong>
              </p>
              <p className="text-[10px] text-on-surface-variant/60 mb-4">
                Example: Arabiyyah | Arabiyyah | Dr Ibrahim Mustapha
              </p>

              <textarea
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                rows={10}
                placeholder={"Arabiyyah | Arabiyyah | Dr Ibrahim Mustaphah\nQur'an Memorization | Juz Amma | Dr Ibrahim\nTajweed | Al-Jazariyyah | Dr Ibrahim\nFiqh | Fath al-Qadir | Dr Ibrahim"}
                className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary transition-colors font-mono text-xs"
              />

              {batchResult && (
                <div className={`mt-3 text-xs px-3 py-2 rounded-lg ${batchResult.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  {batchResult.message}
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setShowBatchModal(false)}
                  className="flex-1 border border-primary/20 text-on-surface-variant py-2.5 rounded-lg text-xs font-semibold cursor-pointer hover:bg-surface-container transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBatchImport}
                  disabled={batchSaving || !batchText.trim()}
                  className="flex-1 bg-primary text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-primary-container disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                >
                  {batchSaving ? "Importing..." : "Import Subjects"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Confirm Modal */}
      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Delete"
        cancelText="Cancel"
        danger
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ open: false, title: "", message: "", onConfirm: () => {} })}
      />
    </motion.div>
  );
}
