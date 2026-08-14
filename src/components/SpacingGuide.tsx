import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Ruler, X, Maximize2, Minus, RotateCcw, ArrowUpDown, Type, Palette, Frame, MousePointerClick, Save, Trash2, CheckCircle2, AlertCircle, Loader2, Move, PenLine } from "lucide-react";
import { getCssPath, captureInlineStyles, mergeCustomStyles, clearInlineStyles, applyCustomStyles } from "../lib/customStyles";
import { claimEditTool, releaseEditTool, useActiveEditTool } from "../lib/editMode";
import { CONTENT_FIELDS, useSiteContent } from "../lib/siteContent";
import RichTextEditor from "./TeacherPortal/RichTextEditor";

interface ElementStyles {
  marginTop: number; marginRight: number; marginBottom: number; marginLeft: number;
  paddingTop: number; paddingRight: number; paddingBottom: number; paddingLeft: number;
  borderTop: number; borderRight: number; borderBottom: number; borderLeft: number;
  color: string; backgroundColor: string; borderColor: string;
  fontSize: string; fontWeight: string; fontFamily: string;
  width: string; height: string;
  borderStyle: string; borderRadius: string;
  top: number; left: number; contentWidth: number; contentHeight: number;
  tagName: string; className: string;
}
interface SpacingValues { top: number; right: number; bottom: number; left: number; }

function parsePx(v: string): number { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function rgbToHex(rgb: string): string {
  if (rgb.startsWith("#")) return rgb;
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return "#000000";
  return `#${((1 << 24) + (parseInt(m[1]) << 16) + (parseInt(m[2]) << 8) + parseInt(m[3])).toString(16).slice(1)}`;
}
function hexToRgb(hex: string): string {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!r) return "rgb(0, 0, 0)";
  return `rgb(${parseInt(r[1], 16)}, ${parseInt(r[2], 16)}, ${parseInt(r[3], 16)})`;
}

export default function SpacingGuide() {
  const [active, setActive] = useState(false);
  const [moveMode, setMoveMode] = useState(false); // drag-to-reposition mode
  // The Style Editor claims the editing spotlight while open — the floating
  // Edit/Change buttons and the Content Inspector step aside automatically.
  const activeTool = useActiveEditTool();
  useEffect(() => {
    if (active) claimEditTool("spacing");
    else releaseEditTool("spacing");
  }, [active]);
  // Another tool (Content Inspector) took the spotlight → close ourselves.
  useEffect(() => {
    if (active && activeTool && activeTool !== "spacing") setActive(false);
  }, [active, activeTool]);
  const [locked, setLocked] = useState(false); // Is an element locked for editing?
  const [hoveredEl, setHoveredEl] = useState<ElementStyles | null>(null); // Hover preview
  const [selectedEl, setSelectedEl] = useState<ElementStyles | null>(null); // Locked/selected element
  const [showMargin, setShowMargin] = useState(true);
  const [showPadding, setShowPadding] = useState(true);
  const [showBorder, setShowBorder] = useState(true);
  const [editMode, setEditMode] = useState<"view" | "edit">("edit");
  const [activeTab, setActiveTab] = useState<"spacing" | "style" | "text">("spacing");
  const [linkSides, setLinkSides] = useState({ margin: false, padding: false });

  const [original, setOriginal] = useState<ElementStyles | null>(null);
  const [marginValues, setMarginValues] = useState<SpacingValues>({ top: 0, right: 0, bottom: 0, left: 0 });
  const [paddingValues, setPaddingValues] = useState<SpacingValues>({ top: 0, right: 0, bottom: 0, left: 0 });
  const [textColor, setTextColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [borderColorVal, setBorderColorVal] = useState("#000000");
  const [fontSize, setFontSize] = useState("16");
  const [fontWeight, setFontWeight] = useState("400");
  const [fontFamily, setFontFamily] = useState("");
  const [elWidth, setElWidth] = useState("auto");
  const [elHeight, setElHeight] = useState("auto");
  const [borderWidth, setBorderWidth] = useState<SpacingValues>({ top: 0, right: 0, bottom: 0, left: 0 });
  const [borderRadiusVal, setBorderRadiusVal] = useState("0");

  // ---- Text content editing ----
  const [contentKey, setContentKey] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState("");
  const [textIsPlain, setTextIsPlain] = useState(false);
  const [textBusy, setTextBusy] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);
  const [textSaved, setTextSaved] = useState(false);

  // Live site-content store (ref so the lock handler always reads the freshest value)
  const contentRef = useRef<Record<string, string>>({});
  const siteContent = useSiteContent();
  useEffect(() => { contentRef.current = siteContent; }, [siteContent]);

  const targetRef = useRef<HTMLElement | null>(null);
  const lastHoverRef = useRef<HTMLElement | null>(null);
  const isEditingRef = useRef(false);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [cssPath, setCssPath] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<"auth" | "failed" | null>(null);
  const [hasSaved, setHasSaved] = useState(false);

  // Which element to display in overlay
  const displayEl = locked ? selectedEl : hoveredEl;

  const buildModel = useCallback((target: HTMLElement): ElementStyles => {
    const c = window.getComputedStyle(target);
    const r = target.getBoundingClientRect();
    return {
      contentWidth: r.width, contentHeight: r.height,
      paddingTop: parsePx(c.paddingTop), paddingRight: parsePx(c.paddingRight), paddingBottom: parsePx(c.paddingBottom), paddingLeft: parsePx(c.paddingLeft),
      marginTop: parsePx(c.marginTop), marginRight: parsePx(c.marginRight), marginBottom: parsePx(c.marginBottom), marginLeft: parsePx(c.marginLeft),
      borderTop: parsePx(c.borderTopWidth), borderRight: parsePx(c.borderRightWidth), borderBottom: parsePx(c.borderBottomWidth), borderLeft: parsePx(c.borderLeftWidth),
      color: c.color, backgroundColor: c.backgroundColor === "rgba(0, 0, 0, 0)" ? "transparent" : c.backgroundColor, borderColor: c.borderTopColor,
      fontSize: c.fontSize, fontWeight: c.fontWeight, fontFamily: c.fontFamily,
      width: c.width, height: c.height, borderStyle: c.borderTopStyle, borderRadius: c.borderRadius,
      top: r.top + window.scrollY, left: r.left + window.scrollX,
      tagName: target.tagName.toLowerCase(), className: target.className?.toString().slice(0, 80) || "",
    };
  }, []);

  // Populate editing fields from a model
  const populateFields = useCallback((model: ElementStyles) => {
    setMarginValues({ top: model.marginTop, right: model.marginRight, bottom: model.marginBottom, left: model.marginLeft });
    setPaddingValues({ top: model.paddingTop, right: model.paddingRight, bottom: model.paddingBottom, left: model.paddingLeft });
    setBorderWidth({ top: model.borderTop, right: model.borderRight, bottom: model.borderBottom, left: model.borderLeft });
    setTextColor(rgbToHex(model.color));
    setBgColor(model.backgroundColor === "transparent" ? "#ffffff" : rgbToHex(model.backgroundColor));
    setBorderColorVal(rgbToHex(model.borderColor));
    setFontSize(parseFloat(model.fontSize).toString());
    setFontWeight(model.fontWeight || "400");
    setFontFamily(model.fontFamily || "");
    setElWidth(model.width);
    setElHeight(model.height);
    setBorderRadiusVal(parsePx(model.borderRadius).toString());
  }, []);

  // Handle hover - only updates preview, does NOT change locked element
  const handleHover = useCallback((e: MouseEvent) => {
    if (!active || locked) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-spacing-guide]") || target === document.body || target === document.documentElement) return;
    if (target === lastHoverRef.current) return;
    lastHoverRef.current = target;
    const model = buildModel(target);
    setHoveredEl(model);
  }, [active, locked, buildModel]);

  // Handle click - locks onto the clicked element
  const handleClick = useCallback((e: MouseEvent) => {
    if (!active) return;
    // Suppress the click that fires right after a drag ends, so a dragged
    // element doesn't get accidentally re-selected mid-move.
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    const target = e.target as HTMLElement;
    // Ignore clicks on our own panel
    if (target.closest("[data-spacing-guide]")) return;
    if (target === document.body || target === document.documentElement) return;

    e.preventDefault();
    e.stopPropagation();

    const model = buildModel(target);
    targetRef.current = target;
    setSelectedEl(model);
    setOriginal(model);
    populateFields(model);
    setLocked(true);
    setCssPath(getCssPath(target));
    setSaveState("idle");
    setHasSaved(false);

    // Detect the site-content field this element is bound to (via its EditableText wrapper)
    const wrap = target.closest("[data-content-key]") as HTMLElement | null;
    const key = wrap ? wrap.getAttribute("data-content-key") : null;
    setContentKey(key);
    setTextSaved(false);
    setTextError(null);
    if (key) {
      const field = CONTENT_FIELDS.find((f) => f.key === key);
      const plain = !field || field.type === "text" || field.type === "textarea";
      setTextIsPlain(plain);
      const child = (wrap.firstElementChild as HTMLElement | null) || target;
      // Seed from the STORED content value — reading the DOM can capture decorative
      // wrapper markup (e.g. the hero's shimmer span) and bake it into the site.
      const stored = (contentRef.current[key] || "").trim();
      setTextDraft(stored || (plain ? (child.textContent || "") : (child.innerHTML || "")));
    }
  }, [active, buildModel, populateFields]);

  // Handle Escape - unlocks
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape" && active) {
      if (locked) {
        setLocked(false);
        setMoveMode(false);
        setContentKey(null);
        setSelectedEl(null);
        targetRef.current = null;
      } else {
        setActive(false);
        setMoveMode(false);
        setContentKey(null);
      }
    }
  }, [active, locked]);

  // ---- Drag-to-reposition (Move mode) ----
  const parseTransform = (t: string) => {
    const m = t.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
    return m ? { tx: parseFloat(m[1]) || 0, ty: parseFloat(m[2]) || 0 } : { tx: 0, ty: 0 };
  };

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (!active || !locked || !moveMode) return;
    const el = targetRef.current;
    if (!el) return;
    const target = e.target as HTMLElement;
    if (target !== el && !el.contains(target)) return;
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const { tx, ty } = parseTransform(el.style.transform || "");
    dragStartRef.current = { x: e.clientX, y: e.clientY, tx, ty };
    draggingRef.current = true;
    movedRef.current = false;
  }, [active, locked, moveMode]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingRef.current || !dragStartRef.current) return;
    const el = targetRef.current;
    if (!el) return;
    const s = dragStartRef.current;
    const dx = e.clientX - s.x + s.tx;
    const dy = e.clientY - s.y + s.ty;
    if (Math.abs(e.clientX - s.x) + Math.abs(e.clientY - s.y) > 4) movedRef.current = true;
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    // Inline of markEdited() — drop any green "saved" state after a drag
    setSaveState((st) => (st === "saved" ? "idle" : st));
    setSaveError(null);
  }, []);

  const handleMouseUp = useCallback(() => {
    if (draggingRef.current && targetRef.current && movedRef.current) {
      // Keep the overlay in sync with the new position
      const model = buildModel(targetRef.current);
      setSelectedEl(model);
      setOriginal(model);
    }
    draggingRef.current = false;
    movedRef.current = false;
    dragStartRef.current = null;
  }, [buildModel]);

  // Drag listeners — only while locked in Move mode
  useEffect(() => {
    if (!active || !locked || !moveMode) return;
    document.addEventListener("mousedown", handleMouseDown, true);
    document.addEventListener("mousemove", handleMouseMove, true);
    document.addEventListener("mouseup", handleMouseUp, true);
    document.body.style.cursor = "move";
    return () => {
      document.removeEventListener("mousedown", handleMouseDown, true);
      document.removeEventListener("mousemove", handleMouseMove, true);
      document.removeEventListener("mouseup", handleMouseUp, true);
      document.body.style.cursor = "";
    };
  }, [active, locked, moveMode, handleMouseDown, handleMouseMove, handleMouseUp]);

  // Event listeners
  useEffect(() => {
    if (!active) {
      setHoveredEl(null);
      setLocked(false);
      setSelectedEl(null);
      targetRef.current = null;
      lastHoverRef.current = null;
      return;
    }
    document.addEventListener("mouseover", handleHover, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.cursor = "crosshair";
    return () => {
      document.removeEventListener("mouseover", handleHover, true);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.cursor = "";
    };
  }, [active, handleHover, handleClick, handleKeyDown]);

  // Apply functions
  const applyStyle = useCallback((prop: string, val: string) => {
    const el = targetRef.current;
    if (!el) return;
    (el.style as any)[prop] = val;
  }, []);

  const applyMargin = useCallback((v: SpacingValues) => { const el = targetRef.current; if (!el) return; el.style.marginTop = `${v.top}px`; el.style.marginRight = `${v.right}px`; el.style.marginBottom = `${v.bottom}px`; el.style.marginLeft = `${v.left}px`; }, []);
  const applyPadding = useCallback((v: SpacingValues) => { const el = targetRef.current; if (!el) return; el.style.paddingTop = `${v.top}px`; el.style.paddingRight = `${v.right}px`; el.style.paddingBottom = `${v.bottom}px`; el.style.paddingLeft = `${v.left}px`; }, []);
  const applyBorderWidth = useCallback((v: SpacingValues) => { const el = targetRef.current; if (!el) return; el.style.borderTopWidth = `${v.top}px`; el.style.borderRightWidth = `${v.right}px`; el.style.borderBottomWidth = `${v.bottom}px`; el.style.borderLeftWidth = `${v.left}px`; if (v.top + v.right + v.bottom + v.left > 0) { if (!el.style.borderTopStyle) el.style.borderTopStyle = "solid"; if (!el.style.borderRightStyle) el.style.borderRightStyle = "solid"; if (!el.style.borderBottomStyle) el.style.borderBottomStyle = "solid"; if (!el.style.borderLeftStyle) el.style.borderLeftStyle = "solid"; } }, []);

  // If the user keeps editing after saving, drop the green "saved" state
  const markEdited = useCallback(() => {
    setSaveState((s) => (s === "saved" ? "idle" : s));
    setSaveError(null);
  }, []);

  // Input handlers
  const hMargin = useCallback((side: keyof SpacingValues, val: number) => { isEditingRef.current = true; markEdited(); const c = Math.max(0, Math.min(500, val)); setMarginValues(p => { const nv = linkSides.margin ? { top: c, right: c, bottom: c, left: c } : { ...p, [side]: c }; applyMargin(nv); return nv; }); setTimeout(() => { isEditingRef.current = false; }, 100); }, [linkSides.margin, applyMargin]);
  const hPadding = useCallback((side: keyof SpacingValues, val: number) => { isEditingRef.current = true; markEdited(); const c = Math.max(0, Math.min(500, val)); setPaddingValues(p => { const nv = linkSides.padding ? { top: c, right: c, bottom: c, left: c } : { ...p, [side]: c }; applyPadding(nv); return nv; }); setTimeout(() => { isEditingRef.current = false; }, 100); }, [linkSides.padding, applyPadding]);
  const hBorder = useCallback((side: keyof SpacingValues, val: number) => { isEditingRef.current = true; markEdited(); const c = Math.max(0, Math.min(50, val)); setBorderWidth(p => { const nv = { ...p, [side]: c }; applyBorderWidth(nv); return nv; }); setTimeout(() => { isEditingRef.current = false; }, 100); }, [applyBorderWidth]);

  const hColor = useCallback((prop: string, setter: (v: string) => void, converter: (v: string) => string) => (hex: string) => { isEditingRef.current = true; markEdited(); setter(hex); applyStyle(prop, converter(hex)); setTimeout(() => { isEditingRef.current = false; }, 100); }, [applyStyle, markEdited]);
  const hTextColor = hColor("color", setTextColor, hexToRgb);
  const hBgColor = hColor("backgroundColor", setBgColor, (v) => v);
  const hBorderColor = useCallback((hex: string) => { isEditingRef.current = true; markEdited(); setBorderColorVal(hex); const el = targetRef.current; if (el) { el.style.borderTopColor = hex; el.style.borderRightColor = hex; el.style.borderBottomColor = hex; el.style.borderLeftColor = hex; } setTimeout(() => { isEditingRef.current = false; }, 100); }, []);

  const hFontSize = useCallback((v: string) => { isEditingRef.current = true; markEdited(); setFontSize(v); if (targetRef.current && v) targetRef.current.style.fontSize = `${v}px`; setTimeout(() => { isEditingRef.current = false; }, 100); }, [markEdited]);
  const hFontWeight = useCallback((v: string) => { isEditingRef.current = true; markEdited(); setFontWeight(v); if (targetRef.current && v) targetRef.current.style.fontWeight = v; setTimeout(() => { isEditingRef.current = false; }, 100); }, [markEdited]);
  const hFontFamily = useCallback((v: string) => { isEditingRef.current = true; markEdited(); setFontFamily(v); if (targetRef.current && v) targetRef.current.style.fontFamily = v; setTimeout(() => { isEditingRef.current = false; }, 100); }, [markEdited]);
  const hWidth = useCallback((v: string) => { isEditingRef.current = true; markEdited(); setElWidth(v); if (targetRef.current) targetRef.current.style.width = v.includes("px") || v.includes("%") || v === "auto" ? v : `${v}px`; setTimeout(() => { isEditingRef.current = false; }, 100); }, [markEdited]);
  const hHeight = useCallback((v: string) => { isEditingRef.current = true; markEdited(); setElHeight(v); if (targetRef.current) targetRef.current.style.height = v.includes("px") || v.includes("%") || v === "auto" ? v : `${v}px`; setTimeout(() => { isEditingRef.current = false; }, 100); }, [markEdited]);
  const hRadius = useCallback((v: string) => { isEditingRef.current = true; markEdited(); setBorderRadiusVal(v); if (targetRef.current) targetRef.current.style.borderRadius = `${v}px`; setTimeout(() => { isEditingRef.current = false; }, 100); }, [markEdited]);

  const handleReset = useCallback(() => {
    if (!original || !targetRef.current) return;
    const el = targetRef.current;
    el.style.marginTop = ""; el.style.marginRight = ""; el.style.marginBottom = ""; el.style.marginLeft = "";
    el.style.paddingTop = ""; el.style.paddingRight = ""; el.style.paddingBottom = ""; el.style.paddingLeft = "";
    el.style.borderTopWidth = ""; el.style.borderRightWidth = ""; el.style.borderBottomWidth = ""; el.style.borderLeftWidth = "";
    el.style.borderRadius = ""; el.style.color = ""; el.style.backgroundColor = "";
    el.style.borderTopColor = ""; el.style.borderRightColor = ""; el.style.borderBottomColor = ""; el.style.borderLeftColor = "";
    el.style.fontSize = ""; el.style.fontWeight = ""; el.style.fontFamily = "";
    el.style.width = ""; el.style.height = "";
    el.style.transform = "";
    populateFields(original);
  }, [original, populateFields]);

  const handleUnlock = useCallback(() => { setLocked(false); setMoveMode(false); setContentKey(null); setSelectedEl(null); targetRef.current = null; }, []);

  // ---- Save text content to the site ----
  const handleTextSave = useCallback(async () => {
    if (!contentKey || !targetRef.current) return;
    const token = localStorage.getItem("token");
    if (!token) {
      setTextError("Login as admin to save text");
      return;
    }
    setTextBusy(true);
    setTextError(null);
    try {
      const res = await fetch("/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ updates: { [contentKey]: textDraft.trim() } }),
      });
      if (res.ok) {
        setTextSaved(true);
        setTextError(null);
        window.dispatchEvent(new CustomEvent("content-saved"));
      } else if (res.status === 401) {
        setTextError("Login as admin to save text");
      } else {
        const data = await res.json().catch(() => ({}));
        setTextError(data.error || "Save failed — try again");
      }
    } catch {
      setTextError("Save failed — try again");
    } finally {
      setTextBusy(false);
    }
  }, [contentKey, textDraft]);

  // ---- Persist edited styles (survive refresh, apply across the whole site) ----
  const getAuthToken = () => localStorage.getItem("token");

  const loadSavedCustomStyles = async (): Promise<string | undefined> => {
    try {
      // cache: "no-store" — always read the freshest saved styles, never the HTTP cache
      const res = await fetch("/api/content", { cache: "no-store" });
      const data = await res.json();
      return data?.content?.custom_styles;
    } catch { return undefined; }
  };

  const handleSave = useCallback(async () => {
    const el = targetRef.current;
    if (!el) return;
    const token = getAuthToken();
    if (!token) {
      setSaveState("error");
      setSaveError("auth");
      return;
    }
    setSaveState("saving");
    setSaveError(null);
    try {
      const current = await loadSavedCustomStyles();
      const path = cssPath || getCssPath(el);
      const styles = captureInlineStyles(el);
      const nextJson = mergeCustomStyles(current, path, styles);
      const res = await fetch("/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ updates: { custom_styles: nextJson } }),
      });
      if (res.ok) {
        setSaveState("saved");
        setHasSaved(true);
        window.dispatchEvent(new CustomEvent("content-saved"));
      } else if (res.status === 401) {
        setSaveState("error");
        setSaveError("auth");
      } else {
        setSaveState("error");
        setSaveError("failed");
      }
    } catch {
      setSaveState("error");
      setSaveError("failed");
    }
  }, [cssPath]);

  const handleRemoveSaved = useCallback(async () => {
    const el = targetRef.current;
    if (!el) return;
    const token = getAuthToken();
    if (!token) {
      setSaveState("error");
      setSaveError("auth");
      return;
    }
    setSaveState("saving");
    try {
      const current = await loadSavedCustomStyles();
      const path = cssPath || getCssPath(el);
      const nextJson = mergeCustomStyles(current, path, null);
      const res = await fetch("/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ updates: { custom_styles: nextJson } }),
      });
      if (res.ok) {
        // Reset the live preview so the removed styling disappears immediately
        clearInlineStyles(el);
        applyCustomStyles(nextJson);
        setSaveState("idle");
        setSaveError(null);
        setHasSaved(false);
        window.dispatchEvent(new CustomEvent("content-saved"));
      } else if (res.status === 401) {
        setSaveState("error");
        setSaveError("auth");
      } else {
        setSaveState("error");
        setSaveError("failed");
      }
    } catch {
      setSaveState("error");
      setSaveError("failed");
    }
  }, [cssPath]);

  // When locking an element, check whether it already has saved styles
  useEffect(() => {
    if (!locked || !cssPath) return;
    let active = true;
    loadSavedCustomStyles().then((json) => {
      if (!active || !json) return;
      try {
        const map = JSON.parse(json);
        if (map && typeof map === "object" && map[cssPath]) {
          setHasSaved(true);
          setSaveState("saved");
        }
      } catch {}
    });
    return () => { active = false; };
  }, [locked, cssPath]);

  const getOverlay = (m: ElementStyles) => {
    const tw = m.contentWidth + m.paddingLeft + m.paddingRight + m.borderLeft + m.borderRight;
    const th = m.contentHeight + m.paddingTop + m.paddingBottom + m.borderTop + m.borderBottom;
    return {
      margin: { top: m.top - m.marginTop, left: m.left - m.marginLeft, width: tw + m.marginLeft + m.marginRight, height: th + m.marginTop + m.marginBottom },
      border: { top: m.top - m.borderTop, left: m.left - m.borderLeft, width: m.contentWidth + m.paddingLeft + m.paddingRight + m.borderLeft + m.borderRight, height: m.contentHeight + m.paddingTop + m.paddingBottom + m.borderTop + m.borderBottom },
      padding: { top: m.top, left: m.left, width: m.contentWidth + m.paddingLeft + m.paddingRight, height: m.contentHeight + m.paddingTop + m.paddingBottom },
      content: { top: m.top + m.paddingTop + m.borderTop, left: m.left + m.paddingLeft + m.borderLeft, width: m.contentWidth, height: m.contentHeight },
      margins: { top: m.marginTop, right: m.marginRight, bottom: m.marginBottom, left: m.marginLeft },
      paddings: { top: m.paddingTop, right: m.paddingRight, bottom: m.paddingBottom, left: m.paddingLeft },
      borders: { top: m.borderTop, right: m.borderRight, bottom: m.borderBottom, left: m.borderLeft },
    };
  };

  const SpacingInput = ({ label, side, value, color, onChange }: { label: string; side: keyof SpacingValues; value: number; color: "orange" | "green" | "yellow"; onChange: (side: keyof SpacingValues, value: number) => void }) => (
    <div className="flex items-center gap-1.5">
      <span className={`text-[9px] w-6 text-right ${color === "orange" ? "text-orange-400/70" : color === "green" ? "text-green-400/70" : "text-yellow-400/70"}`}>{label}</span>
      <input type="number" min={0} max={500} value={value} onChange={(e) => onChange(side, parseInt(e.target.value) || 0)}
        onFocus={() => { isEditingRef.current = true; }} onBlur={() => { setTimeout(() => { isEditingRef.current = false; }, 50); }}
        className={`w-12 text-[10px] font-mono px-1 py-0.5 rounded border bg-white/5 text-white text-center focus:outline-none ${color === "orange" ? "border-orange-400/30 focus:border-orange-400/60" : color === "green" ? "border-green-400/30 focus:border-green-400/60" : "border-yellow-400/30 focus:border-yellow-400/60"}`} />
      <span className="text-[8px] text-white/30">px</span>
    </div>
  );

  const ColorInput = ({ label, value, onChange, icon }: { label: string; value: string; onChange: (v: string) => void; icon: any }) => (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-white/50 w-5 flex justify-center">{icon}</span>
      <span className="text-[9px] text-white/50 w-14">{label}</span>
      <div className="relative flex items-center gap-1.5">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} onFocus={() => { isEditingRef.current = true; }} onBlur={() => { setTimeout(() => { isEditingRef.current = false; }, 50); }} className="w-6 h-6 rounded border border-white/20 cursor-pointer bg-transparent p-0" />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} onFocus={() => { isEditingRef.current = true; }} onBlur={() => { setTimeout(() => { isEditingRef.current = false; }, 50); }} className="w-[72px] text-[9px] font-mono px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-white focus:outline-none focus:border-white/30" />
      </div>
    </div>
  );

  const SimpleInput = ({ label, value, onChange, icon, suffix = "px" }: { label: string; value: string; onChange: (v: string) => void; icon: any; suffix?: string }) => (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-white/50 w-5 flex justify-center">{icon}</span>
      <span className="text-[9px] text-white/50 w-14">{label}</span>
      <div className="flex items-center gap-1 flex-1">
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} onFocus={() => { isEditingRef.current = true; }} onBlur={() => { setTimeout(() => { isEditingRef.current = false; }, 50); }} className="flex-1 text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-white focus:outline-none focus:border-blue-400/50" />
        <span className="text-[8px] text-white/30">{suffix}</span>
      </div>
    </div>
  );

  const SelectInput = ({ label, value, onChange, options, icon, placeholder }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; icon: any; placeholder?: string }) => {
    const selected = options.some((o) => o.value === value) ? value : "";
    return (
      <div className="flex items-center gap-2">
        <span className="text-[9px] text-white/50 w-5 flex justify-center">{icon}</span>
        <span className="text-[9px] text-white/50 w-14">{label}</span>
        <select
          value={selected}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => { isEditingRef.current = true; }}
          onBlur={() => { setTimeout(() => { isEditingRef.current = false; }, 50); }}
          className="flex-1 text-[10px] px-1.5 py-0.5 rounded border border-white/10 bg-gray-800 text-white focus:outline-none focus:border-blue-400/50 cursor-pointer"
        >
          <option value="" disabled>{placeholder || "— select —"}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    );
  };

  // Preset font options for the Style Editor
  const FONT_WEIGHT_OPTIONS = [
    { value: "300", label: "Light (300)" },
    { value: "400", label: "Regular (400)" },
    { value: "500", label: "Medium (500)" },
    { value: "600", label: "Semi-bold (600)" },
    { value: "700", label: "Bold (700)" },
    { value: "800", label: "Extra-bold (800)" },
    { value: "900", label: "Black (900)" },
  ];
  const FONT_FAMILY_OPTIONS = [
    { value: "Playfair Display, Georgia, serif", label: "Playfair Display" },
    { value: "Georgia, serif", label: "Georgia" },
    { value: "Inter, system-ui, sans-serif", label: "Inter" },
    { value: "Arial, Helvetica, sans-serif", label: "Arial" },
    { value: "Times New Roman, Times, serif", label: "Times New Roman" },
    { value: "Trebuchet MS, sans-serif", label: "Trebuchet MS" },
    { value: "Tahoma, Geneva, sans-serif", label: "Tahoma" },
    { value: "Verdana, Geneva, sans-serif", label: "Verdana" },
    { value: "Courier New, monospace", label: "Courier New" },
    { value: "Traditional Arabic, Arial, sans-serif", label: "Traditional Arabic" },
  ];
  const currentFamilyOption = fontFamily.trim()
    ? [{ value: fontFamily, label: fontFamily.split(",")[0].replace(/['"]/g, "") }]
    : [];
  const currentWeightOption = FONT_WEIGHT_OPTIONS.some((o) => o.value === fontWeight)
    ? []
    : [{ value: fontWeight, label: `Weight ${fontWeight}` }];

  return (
    <>
      {/* Toggle Button */}
      <button data-spacing-guide onClick={() => setActive(!active)}
        className={`fixed top-33 right-6 z-[9999] w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 cursor-pointer ${active ? "bg-blue-500 text-white scale-110 shadow-blue-500/30 ring-2 ring-blue-400/40" : "bg-white text-blue-600 hover:bg-blue-50 hover:scale-105 border border-blue-200 hover:shadow-xl"}`}
        title={active ? "Exit Style Editor" : "Open Style Editor"}>
        <Ruler className="w-4.5 h-4.5" />
      </button>

      {/* Controls Panel */}
      <AnimatePresence>
        {active && (
          <motion.div data-spacing-guide ref={panelRef} initial={{ opacity: 0, y: -10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="fixed top-48 right-6 z-[9999] bg-gray-900 text-white rounded-xl shadow-2xl border border-white/10 overflow-hidden w-64 max-h-[80vh] flex flex-col">

            {/* Header */}
            <div className="px-3 py-2 bg-white/5 border-b border-white/10 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Style Editor</span>
              <div className="flex items-center gap-1">
                {locked && (
                  <>
                    <button
                      onClick={() => setMoveMode((m) => !m)}
                      className={`px-2 py-0.5 rounded text-[9px] font-medium border cursor-pointer flex items-center gap-0.5 ${moveMode ? "bg-green-500/20 text-green-400 border-green-400/40" : "bg-white/5 text-white/60 border-white/15 hover:text-white"}`}
                      title={moveMode ? "Turn off drag & move" : "Drag the element to reposition it"}
                    >
                      <Move className="w-2.5 h-2.5" /> Move
                    </button>
                    <button onClick={handleUnlock} className="px-2 py-0.5 rounded text-[9px] font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-400/30 cursor-pointer" title="Unlock element (Esc)">
                      🔓 Unlock
                    </button>
                  </>
                )}
                <button onClick={() => { setActive(false); setLocked(false); setMoveMode(false); setSelectedEl(null); }} className="p-1 rounded hover:bg-white/10 transition-colors cursor-pointer"><X className="w-3 h-3 text-white/50 hover:text-white" /></button>
              </div>
            </div>

            {/* Status Bar */}
            <div className={`px-3 py-1.5 border-b border-white/10 text-[9px] text-center font-medium ${locked ? (moveMode ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400") : "bg-blue-500/10 text-blue-400"}`}>
              {locked ? (
                moveMode ? (
                  <>✥ <span className="font-mono">&lt;{selectedEl?.tagName}&gt;</span> — drag to reposition, then Save</>
                ) : (
                  <>🔒 Locked: <span className="font-mono">&lt;{selectedEl?.tagName}&gt;</span> — editing this element</>
                )
              ) : (
                <>👆 Click any element to select & lock it</>
              )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/10 shrink-0">
              <button onClick={() => setActiveTab("spacing")} className={`flex-1 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${activeTab === "spacing" ? "text-blue-400 border-b-2 border-blue-400 bg-white/5" : "text-white/40 hover:text-white/60"}`}>Spacing</button>
              <button onClick={() => setActiveTab("style")} className={`flex-1 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${activeTab === "style" ? "text-purple-400 border-b-2 border-purple-400 bg-white/5" : "text-white/40 hover:text-white/60"}`}>Style</button>
              <button onClick={() => setActiveTab("text")} className={`flex-1 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${activeTab === "text" ? "text-pink-400 border-b-2 border-pink-400 bg-white/5" : "text-white/40 hover:text-white/60"}`}>Text</button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>
              {/* Overlay Toggles */}
              <div className="px-3 py-2 border-b border-white/10 space-y-1.5">
                {[
                  { label: "Margin", checked: showMargin, onChange: setShowMargin, color: "orange" },
                  { label: "Padding", checked: showPadding, onChange: setShowPadding, color: "green" },
                  { label: "Border", checked: showBorder, onChange: setShowBorder, color: "yellow" },
                ].map((item) => (
                  <label key={item.label} className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" checked={item.checked} onChange={(e) => item.onChange(e.target.checked)} className="w-3.5 h-3.5 rounded border-white/20 bg-white/10 cursor-pointer" style={{ accentColor: item.color === "orange" ? "#fb923c" : item.color === "green" ? "#4ade80" : "#facc15" }} />
                    <span className={`w-3 h-3 rounded-sm bg-${item.color}-400/60 border border-${item.color}-400/80`} />
                    <span className="text-[10px] text-white/60 group-hover:text-white/80">{item.label}</span>
                  </label>
                ))}
              </div>

              {/* TEXT TAB — edit the actual words of a content element */}
              {locked && selectedEl && activeTab === "text" && (
                <div className="px-3 py-3 space-y-2.5">
                  {contentKey ? (
                    <>
                      <div className="flex items-center gap-1.5">
                        <PenLine className="w-3 h-3 text-pink-400 shrink-0" />
                        <span className="text-[9px] font-bold uppercase tracking-wider text-pink-400">Edit Text</span>
                        {textSaved && <span className="ml-auto text-[9px] text-green-400 flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" /> Saved</span>}
                      </div>
                      <p className="text-[9px] text-white/40 font-mono truncate" title={contentKey}>{contentKey}</p>

                      {textIsPlain ? (
                        <textarea
                          value={textDraft}
                          onChange={(e) => { setTextDraft(e.target.value); setTextSaved(false); }}
                          rows={4}
                          className="w-full text-[10px] px-2 py-1.5 rounded border border-white/10 bg-white/5 text-white focus:outline-none focus:border-pink-400/50 resize-y"
                        />
                      ) : (
                        <RichTextEditor value={textDraft} onChange={(v) => { setTextDraft(v); setTextSaved(false); }} token={localStorage.getItem("token") || undefined} minHeight={140} />
                      )}

                      {textError && (
                        <p className="text-[9px] text-red-400/90 flex items-center gap-1">
                          <AlertCircle className="w-2.5 h-2.5" /> {textError}
                        </p>
                      )}

                      <button
                        onClick={handleTextSave}
                        disabled={textBusy}
                        className="w-full py-1.5 rounded-lg border text-[10px] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 bg-pink-500/15 border-pink-400/40 text-pink-300 hover:bg-pink-500/25"
                      >
                        {textBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        {textBusy ? "Saving..." : "Save text to site"}
                      </button>
                      <p className="text-[8px] text-white/30 text-center leading-relaxed">
                        Changes update the site instantly for all visitors
                      </p>
                    </>
                  ) : (
                    <div className="text-center py-3 space-y-1.5">
                      <PenLine className="w-4 h-4 text-pink-400/50 mx-auto" />
                      <p className="text-[10px] text-white/40">This element isn't a text field</p>
                      <p className="text-[9px] text-white/25">Text editing works on content headings &amp; paragraphs (hover them for the pencil too)</p>
                    </div>
                  )}
                </div>
              )}

              {/* SPACING TAB */}
              {locked && selectedEl && activeTab === "spacing" && (
                <div className="px-3 py-3 space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-orange-400">Margin</span>
                      <button onClick={() => setLinkSides(p => ({ ...p, margin: !p.margin }))} className={`p-0.5 rounded transition-colors cursor-pointer ${linkSides.margin ? "text-orange-400 bg-orange-400/10" : "text-white/30 hover:text-white/50"}`}><ArrowUpDown className="w-3 h-3" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                      <SpacingInput label="Top" side="top" value={marginValues.top} color="orange" onChange={hMargin} />
                      <SpacingInput label="Right" side="right" value={marginValues.right} color="orange" onChange={hMargin} />
                      <SpacingInput label="Bottom" side="bottom" value={marginValues.bottom} color="orange" onChange={hMargin} />
                      <SpacingInput label="Left" side="left" value={marginValues.left} color="orange" onChange={hMargin} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-green-400">Padding</span>
                      <button onClick={() => setLinkSides(p => ({ ...p, padding: !p.padding }))} className={`p-0.5 rounded transition-colors cursor-pointer ${linkSides.padding ? "text-green-400 bg-green-400/10" : "text-white/30 hover:text-white/50"}`}><ArrowUpDown className="w-3 h-3" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                      <SpacingInput label="Top" side="top" value={paddingValues.top} color="green" onChange={hPadding} />
                      <SpacingInput label="Right" side="right" value={paddingValues.right} color="green" onChange={hPadding} />
                      <SpacingInput label="Bottom" side="bottom" value={paddingValues.bottom} color="green" onChange={hPadding} />
                      <SpacingInput label="Left" side="left" value={paddingValues.left} color="green" onChange={hPadding} />
                    </div>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-yellow-400 block mb-1.5">Border Width</span>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                      <SpacingInput label="Top" side="top" value={borderWidth.top} color="yellow" onChange={hBorder} />
                      <SpacingInput label="Right" side="right" value={borderWidth.right} color="yellow" onChange={hBorder} />
                      <SpacingInput label="Bottom" side="bottom" value={borderWidth.bottom} color="yellow" onChange={hBorder} />
                      <SpacingInput label="Left" side="left" value={borderWidth.left} color="yellow" onChange={hBorder} />
                    </div>
                  </div>
                  <SimpleInput label="Radius" value={borderRadiusVal} onChange={hRadius} icon={<span className="text-yellow-400">○</span>} suffix="px" />
                </div>
              )}

              {/* STYLE TAB */}
              {locked && selectedEl && activeTab === "style" && (
                <div className="px-3 py-3 space-y-3">
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-pink-400 block mb-2">Colors</span>
                    <div className="space-y-2">
                      <ColorInput label="Text" value={textColor} onChange={hTextColor} icon={<Type className="w-3 h-3 text-pink-400" />} />
                      <ColorInput label="BG" value={bgColor} onChange={hBgColor} icon={<Palette className="w-3 h-3 text-purple-400" />} />
                      <ColorInput label="Border" value={borderColorVal} onChange={hBorderColor} icon={<Frame className="w-3 h-3 text-yellow-400" />} />
                    </div>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-blue-400 block mb-2">Typography</span>
                    <div className="space-y-2">
                      <SimpleInput label="Size" value={fontSize} onChange={hFontSize} icon={<Type className="w-3 h-3 text-blue-400" />} suffix="px" />
                      <SelectInput
                        label="Weight"
                        value={fontWeight}
                        onChange={hFontWeight}
                        options={[...currentWeightOption, ...FONT_WEIGHT_OPTIONS]}
                        icon={<span className="text-blue-400 text-[10px] font-bold">⚖</span>}
                        placeholder="Choose weight"
                      />
                      <SelectInput
                        label="Family"
                        value={fontFamily}
                        onChange={hFontFamily}
                        options={[...currentFamilyOption, ...FONT_FAMILY_OPTIONS]}
                        icon={<span className="text-blue-400 text-[10px] font-bold">Aa</span>}
                        placeholder="Choose font"
                      />
                    </div>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-400 block mb-2">Dimensions</span>
                    <div className="space-y-2">
                      <SimpleInput label="Width" value={elWidth} onChange={hWidth} icon={<Maximize2 className="w-3 h-3 text-cyan-400" />} suffix="" />
                      <SimpleInput label="Height" value={elHeight} onChange={hHeight} icon={<Maximize2 className="w-3 h-3 text-cyan-400 rotate-90" />} suffix="" />
                    </div>
                  </div>
                </div>
              )}

              {/* Persist to site */}
              {locked && selectedEl && (
                <div className="px-3 py-2 border-t border-white/10 space-y-1.5">
                  <button
                    onClick={handleSave}
                    disabled={saveState === "saving"}
                    className={`w-full py-1.5 rounded-lg border text-[10px] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                      saveState === "saved"
                        ? "bg-green-500/15 border-green-400/40 text-green-400"
                        : "bg-blue-500/15 border-blue-400/40 text-blue-300 hover:bg-blue-500/25"
                    }`}
                  >
                    {saveState === "saving" ? <Loader2 className="w-3 h-3 animate-spin" /> : saveState === "saved" ? <CheckCircle2 className="w-3 h-3" /> : <Save className="w-3 h-3" />}
                    {saveState === "saving" ? "Saving..." : saveState === "saved" ? (hasSaved ? "Saved — applied site-wide" : "Saved!") : "Save to site"}
                  </button>
                  {saveState === "error" && saveError === "auth" && (
                    <p className="text-[9px] text-red-400/90 text-center flex items-center justify-center gap-1">
                      <AlertCircle className="w-2.5 h-2.5" /> Login as admin to save changes
                    </p>
                  )}
                  {saveState === "error" && saveError === "failed" && (
                    <p className="text-[9px] text-red-400/90 text-center flex items-center justify-center gap-1">
                      <AlertCircle className="w-2.5 h-2.5" /> Save failed — try again
                    </p>
                  )}
                  {hasSaved && (
                    <button onClick={handleRemoveSaved} disabled={saveState === "saving"} className="w-full py-1.5 rounded-lg bg-white/5 hover:bg-red-500/15 border border-white/10 text-[10px] text-white/50 hover:text-red-400 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50">
                      <Trash2 className="w-3 h-3" /> Remove saved style
                    </button>
                  )}
                  <p className="text-[8px] text-white/30 text-center leading-relaxed">
                    Saved styles survive refresh &amp; apply to the whole site (footer included)
                  </p>
                </div>
              )}

              {/* Reset */}
              {locked && selectedEl && (
                <div className="px-3 py-2 border-t border-white/10">
                  <button onClick={handleReset} className="w-full py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-white/50 hover:text-white/80 transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                    <RotateCcw className="w-3 h-3" /> Reset Live Preview
                  </button>
                </div>
              )}

              {/* Hint when not locked */}
              {!locked && (
                <div className="px-3 py-4 text-center space-y-1">
                  <MousePointerClick className="w-5 h-5 text-blue-400/50 mx-auto mb-2" />
                  <p className="text-[10px] text-white/40">Click any element on the page</p>
                  <p className="text-[9px] text-white/25">to select and edit its spacing &amp; style</p>
                  <p className="text-[9px] text-white/30 mt-2">✥ Tip: lock an element, press <b>Move</b>, then drag it anywhere</p>
                  <p className="text-[9px] text-white/20 mt-1">Press <kbd className="px-1 py-0.5 bg-white/10 rounded text-white/40">Esc</kbd> to unlock</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay */}
      {active && displayEl && (
        <div data-spacing-guide className="fixed inset-0 z-[9998] pointer-events-none">
          {(() => {
            const s = getOverlay(displayEl);
            return (
              <>
                {showMargin && (
                  <div className="absolute" style={{ top: s.margin.top, left: s.margin.left, width: s.margin.width, height: s.margin.height, backgroundColor: "rgba(251, 146, 60, 0.25)", border: "1px dashed rgba(251, 146, 60, 0.6)" }}>
                    {s.margins.top > 0 && <div className="absolute text-[9px] font-mono text-orange-300 bg-orange-900/80 px-1.5 py-0.5 rounded" style={{ top: 2, left: "50%", transform: "translateX(-50%)" }}>m-top: {s.margins.top}px</div>}
                    {s.margins.bottom > 0 && <div className="absolute text-[9px] font-mono text-orange-300 bg-orange-900/80 px-1.5 py-0.5 rounded" style={{ bottom: 2, left: "50%", transform: "translateX(-50%)" }}>m-bottom: {s.margins.bottom}px</div>}
                    {s.margins.left > 0 && <div className="absolute text-[9px] font-mono text-orange-300 bg-orange-900/80 px-1.5 py-0.5 rounded" style={{ left: 2, top: "50%", transform: "translateY(-50%)" }}>m-left: {s.margins.left}px</div>}
                    {s.margins.right > 0 && <div className="absolute text-[9px] font-mono text-orange-300 bg-orange-900/80 px-1.5 py-0.5 rounded" style={{ right: 2, top: "50%", transform: "translateY(-50%)" }}>m-right: {s.margins.right}px</div>}
                  </div>
                )}
                {showBorder && s.borders.top + s.borders.right + s.borders.bottom + s.borders.left > 0 && (
                  <div className="absolute" style={{ top: s.border.top, left: s.border.left, width: s.border.width, height: s.border.height, backgroundColor: "rgba(250, 204, 21, 0.2)", border: "1px solid rgba(250, 204, 21, 0.5)" }} />
                )}
                {showPadding && (
                  <div className="absolute" style={{ top: s.padding.top, left: s.padding.left, width: s.padding.width, height: s.padding.height, backgroundColor: "rgba(74, 222, 128, 0.25)", border: "1px solid rgba(74, 222, 128, 0.5)" }}>
                    {s.paddings.top > 0 && <div className="absolute text-[9px] font-mono text-green-300 bg-green-900/80 px-1.5 py-0.5 rounded" style={{ top: 2, left: "50%", transform: "translateX(-50%)" }}>p-top: {s.paddings.top}px</div>}
                    {s.paddings.bottom > 0 && <div className="absolute text-[9px] font-mono text-green-300 bg-green-900/80 px-1.5 py-0.5 rounded" style={{ bottom: 2, left: "50%", transform: "translateX(-50%)" }}>p-bottom: {s.paddings.bottom}px</div>}
                    {s.paddings.left > 0 && <div className="absolute text-[9px] font-mono text-green-300 bg-green-900/80 px-1.5 py-0.5 rounded" style={{ left: 2, top: "50%", transform: "translateY(-50%)" }}>p-left: {s.paddings.left}px</div>}
                    {s.paddings.right > 0 && <div className="absolute text-[9px] font-mono text-green-300 bg-green-900/80 px-1.5 py-0.5 rounded" style={{ right: 2, top: "50%", transform: "translateY(-50%)" }}>p-right: {s.paddings.right}px</div>}
                  </div>
                )}
                <div className="absolute" style={{ top: s.content.top, left: s.content.left, width: s.content.width, height: s.content.height, border: `2px solid ${locked ? "rgba(250, 204, 21, 0.8)" : "rgba(96, 165, 250, 0.6)"}` }}>
                  <div className="absolute text-[9px] font-mono bg-blue-900/80 px-1.5 py-0.5 rounded whitespace-nowrap" style={{ bottom: -20, left: "50%", transform: "translateX(-50%)", color: locked ? "#facc15" : "#93c5fd" }}>
                    {Math.round(s.content.width)} × {Math.round(s.content.height)}
                  </div>
                </div>
                {/* Tooltip */}
                <div data-spacing-guide className="fixed z-[10000] bg-gray-900 text-white rounded-lg shadow-xl border px-3 py-2 pointer-events-none"
                  style={{ top: Math.max(10, displayEl.top - 50 - window.scrollY), left: displayEl.left - window.scrollX, borderColor: locked ? "rgba(250, 204, 21, 0.3)" : "rgba(255,255,255,0.1)" }}>
                  <div className="flex items-center gap-2">
                    {locked ? <span className="text-[10px]">🔒</span> : <MousePointerClick className="w-3 h-3 text-blue-400" />}
                    <span className={`text-[10px] font-mono ${locked ? "text-yellow-400" : "text-blue-400"}`}>&lt;{displayEl.tagName}&gt;</span>
                    <Minus className="w-2 h-2 text-white/20" />
                    <span className="text-[10px] text-white/50">{Math.round(s.content.width)}×{Math.round(s.content.height)}</span>
                    {!locked && <span className="text-[8px] text-white/30 ml-1">click to lock</span>}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </>
  );
}
