import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ImagePlus, Upload, Link2, X, Check, Loader2 } from "lucide-react";
import { normalizeImageUrl } from "../lib/siteContent";
import { useEditMode, useActiveEditTool } from "../lib/editMode";

interface EditableImageProps {
  /** The site-content key this image controls (e.g. "hero_image_url"). */
  contentKey: string;
  /** Current image URL (used for the popover preview). */
  src: string;
  /** Alt text for the preview image. */
  alt: string;
  /** Human-friendly label shown in the editor header. */
  label?: string;
  /** Classes for the wrapper element — include positioning (e.g. "absolute inset-0"). */
  className?: string;
  /** The actual <img> (or motion.img) to render. */
  children: ReactNode;
}

/**
 * Wraps any landing-page image and lets an ADMIN change it right on the page:
 * hover → "Change" → upload a file or paste an image URL → saves to site content.
 * Visitors (and logged-in staff who aren't admins) see the plain image only.
 */
export default function EditableImage({ contentKey, src, alt, label, className = "", children }: EditableImageProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const editModeOn = useEditMode();
  // While the Style Editor or Content Inspector is open, hide the Change button
  // so it never swallows the clicks those tools need.
  const activeTool = useActiveEditTool();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<"upload" | "save" | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Only admins get the edit affordance (the server APIs enforce auth too).
  useEffect(() => {
    const check = () => {
      const token = localStorage.getItem("token");
      const raw = localStorage.getItem("user");
      if (!token || !raw) return setIsAdmin(false);
      try {
        const u = JSON.parse(raw);
        setIsAdmin(Boolean(u && (u.is_admin || u.role === "admin")));
      } catch {
        setIsAdmin(false);
      }
    };
    check();
    window.addEventListener("storage", check);
    return () => window.removeEventListener("storage", check);
  }, []);

  const persist = async (newUrl: string) => {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("You need to be signed in as admin");
    const res = await fetch("/api/admin/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ updates: { [contentKey]: newUrl } }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Could not save the image");
    }
    // Tell the live site to refresh this image immediately.
    window.dispatchEvent(new CustomEvent("content-saved"));
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    setBusy("upload");
    setError("");
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("You need to be signed in as admin");
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setUrl(data.url);
      await persist(data.url);
      setOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  };

  const handleSaveUrl = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setBusy("save");
    setError("");
    try {
      await persist(trimmed);
      setOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save the image");
    } finally {
      setBusy(null);
    }
  };

  const openEditor = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setUrl(src);
    setError("");
    setOpen(true);
  };

  // Escape closes the editor popover
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <span className={`block group ${className}`}>
      {children}

      {/* Change-image button — admins only + Edit Mode must be ON. Hover to reveal (always visible on touch screens). */}
      {isAdmin && editModeOn && !activeTool && (
        <button
          onClick={openEditor}
          aria-label={`Change ${label || "image"}`}
          title={`Change ${label || "image"}`}
          className="absolute top-2 right-2 z-30 flex items-center gap-1.5 bg-black/65 hover:bg-primary text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg backdrop-blur-sm border border-white/25 shadow-lg opacity-0 group-hover:opacity-100 max-md:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
        >
          <ImagePlus className="w-3.5 h-3.5" />
          Change
        </button>
      )}

      {/* Image editor popover — admins only */}
      {isAdmin && editModeOn && !activeTool && (
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[10005] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.92, y: 14 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.92, y: 14 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={`Change ${label || "image"}`}
                className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
              >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 bg-primary text-white">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
                    <ImagePlus className="w-4 h-4 text-secondary-fixed" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold font-serif leading-tight">Change Image</h3>
                    <p className="text-[10px] text-white/70">{label || contentKey}</p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 hover:bg-white/15 rounded-lg transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Current image preview */}
                <div className="flex items-center gap-3 bg-surface-container-low rounded-xl p-3">
                  <img
                    src={normalizeImageUrl(src)}
                    alt={alt}
                    className="w-16 h-16 rounded-lg object-cover border border-primary/10 bg-white"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Current image</p>
                    <p className="text-[11px] text-primary truncate font-medium">{src}</p>
                  </div>
                </div>

                {/* Upload new image */}
                <div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      handleUpload(f);
                    }}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={busy !== null}
                    className="w-full border-2 border-dashed border-secondary/40 hover:border-secondary bg-secondary/5 hover:bg-secondary/10 rounded-xl py-5 flex flex-col items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {busy === "upload" ? (
                      <Loader2 className="w-5 h-5 text-secondary animate-spin" />
                    ) : (
                      <Upload className="w-5 h-5 text-secondary" />
                    )}
                    <span className="text-xs font-semibold text-primary">
                      {busy === "upload" ? "Uploading…" : "Click to upload a new image"}
                    </span>
                    <span className="text-[10px] text-on-surface-variant">PNG, JPG, WebP · up to 5MB</span>
                  </button>
                </div>

                {/* Or paste a URL */}
                <div className="flex items-center gap-3 text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">
                  <span className="flex-1 h-px bg-primary/10" />
                  or paste an image link
                  <span className="flex-1 h-px bg-primary/10" />
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
                    <input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://… or /uploads/…"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-primary/20 text-sm focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 bg-white"
                    />
                  </div>
                  <button
                    onClick={handleSaveUrl}
                    disabled={busy !== null || !url.trim()}
                    className="px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-container transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    {busy === "save" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Save
                  </button>
                </div>

                {error && (
                  <p className="text-xs text-red-600 font-medium bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
                )}
              </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </span>
  );
}
