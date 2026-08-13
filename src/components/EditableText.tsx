import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { PenLine, X, Check, Loader2, AlignLeft } from "lucide-react";
import { useEditMode, useActiveEditTool } from "../lib/editMode";
import RichTextEditor from "./TeacherPortal/RichTextEditor";

interface EditableTextProps {
  /** The site-content key this text controls (e.g. "hero_title"). */
  contentKey: string;
  /** Current site-content value (used to initialise the editor). */
  value: string;
  /** Fallback text used when the value is empty. */
  fallback?: string;
  /** Human-friendly label shown in the editor header. */
  label?: string;
  /** Use a plain textarea instead of the rich WYSIWYG toolbar. */
  plain?: boolean;
  /** Set for Arabic fields so the editor starts right-to-left. */
  rtl?: boolean;
  /** Classes for the wrapper element — default `contents` keeps page layout intact. */
  className?: string;
  /** The actual text element (h1/p/span…) to render. */
  children: ReactNode;
}

/**
 * Wraps any landing-page text element and lets an ADMIN change it right on the
 * page: hover → "Edit" → WYSIWYG editor (or plain text) → saves to site content.
 * Visitors (and logged-in staff who aren't admins) see the plain text only.
 */
export default function EditableText({
  contentKey,
  value,
  fallback = "",
  label,
  plain = false,
  rtl = false,
  className = "contents",
  children,
}: EditableTextProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const editModeOn = useEditMode();
  // While the Style Editor or Content Inspector is open, hide our Edit button
  // so it never swallows the clicks those tools need.
  const activeTool = useActiveEditTool();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [btnPos, setBtnPos] = useState<{ top: number; right: number } | null>(null);
  const [hovered, setHovered] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);

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

  // Touch devices get the Edit button always visible (no hover).
  useEffect(() => {
    const mq = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = () => setIsTouch(mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else (mq as any).addListener?.(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else (mq as any).removeListener?.(update);
    };
  }, []);

  // Position the floating "Edit" button at the top-right of the wrapped element.
  // The wrapper uses `display: contents`, so we measure the actual child instead.
  const rafRef = useRef<number | null>(null);
  const measureNow = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = wrapperRef.current?.firstElementChild as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setBtnPos({ top: r.top + 6, right: window.innerWidth - r.right + 6 });
    });
  };
  // Throttled variant for scroll/resize — at most one layout read per frame.
  const measure = () => {
    if (rafRef.current !== null) return;
    measureNow();
  };

  const handleEnter = () => {
    measureNow(); // fresh position before the button appears (fixes animated/transformed elements)
    setHovered(true);
  };
  const handleLeave = () => setHovered(false);

  useEffect(() => {
    if (!isAdmin || !editModeOn) return;
    measureNow();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isAdmin, editModeOn]);

  const persist = async (newVal: string) => {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("You need to be signed in as admin");
    const res = await fetch("/api/admin/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ updates: { [contentKey]: newVal } }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Could not save the content");
    }
    // Tell the live site to refresh this content immediately.
    window.dispatchEvent(new CustomEvent("content-saved"));
  };

  const handleSave = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    setError("");
    try {
      await persist(draft.trim());
      setOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save the content");
    } finally {
      setBusy(false);
    }
  };

  const openEditor = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDraft(value && value.trim() ? value : fallback);
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

  const token = isAdmin ? localStorage.getItem("token") || undefined : undefined;

  const portalTarget = typeof document !== "undefined" ? document.body : null;

  return (
    <span
      ref={wrapperRef}
      data-content-key={contentKey}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
      className={`group ${className}`}
    >
      {children}

      {/* Edit-button + popover — portaled to <body> so they never nest inside
          parent <button>s (CTA / nav links) and can't be hijacked by the other editors. */}
      {portalTarget && isAdmin && editModeOn && !activeTool && (
        createPortal(
          <>
            {/* Floating Edit button — hover to reveal. */}
            {btnPos && (hovered || isTouch) && (
              <button
                type="button"
                data-inspector
                data-spacing-guide
                onClick={openEditor}
                aria-label={`Edit ${label || contentKey}`}
                title={`Edit ${label || contentKey}`}
                style={{ top: btnPos.top, right: btnPos.right }}
                className="fixed z-[10001] flex items-center gap-1.5 bg-black/65 hover:bg-primary text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg backdrop-blur-sm border border-white/25 shadow-lg transition-all cursor-pointer hover:scale-105"
              >
                <PenLine className="w-3.5 h-3.5" />
                Edit
              </button>
            )}

            {/* Editor popover */}
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
                    aria-label={`Edit ${label || contentKey}`}
                    className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 bg-primary text-white">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
                          <PenLine className="w-4 h-4 text-secondary-fixed" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold font-serif leading-tight">Edit Content</h3>
                          <p className="text-[10px] text-white/70">{label || contentKey}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="p-1.5 hover:bg-white/15 rounded-lg transition-colors cursor-pointer"
                        aria-label="Close"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                      {plain ? (
                        <textarea
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          dir={rtl ? "rtl" : "ltr"}
                          rows={4}
                          className="w-full border border-primary/20 rounded-xl p-3 text-sm focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 bg-white resize-y"
                        />
                      ) : (
                        <RichTextEditor value={draft} onChange={setDraft} token={token} minHeight={220} />
                      )}

                      {error && (
                        <p className="text-xs text-red-600 font-medium bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
                      )}

                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setOpen(false)}
                          disabled={busy}
                          className="px-4 py-2.5 rounded-xl border border-primary/20 text-primary text-xs font-bold hover:bg-surface-container transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={busy || !draft.trim()}
                          className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-container transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                        >
                          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          Save
                        </button>
                      </div>
                      <p className="flex items-center gap-1.5 text-[10px] text-on-surface-variant/70">
                        <AlignLeft className="w-3 h-3" />
                        Changes appear instantly on the site — no deploy needed.
                      </p>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </>,
          portalTarget
        )
      )}
    </span>
  );
}
