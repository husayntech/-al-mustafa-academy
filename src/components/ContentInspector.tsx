import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Pipette, X, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { claimEditTool, releaseEditTool, useActiveEditTool } from "../lib/editMode";

interface InspectedStyle {
  // Text properties
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  fontStyle: string;
  fontVariant: string;
  textDecoration: string;
  textTransform: string;
  lineHeight: string;
  letterSpacing: string;
  wordSpacing: string;
  textAlign: string;
  textIndent: string;
  whiteSpace: string;
  textOverflow: string;

  // Color properties
  color: string;
  colorRGB: string;
  backgroundColor: string;
  bgColorRGB: string;

  // Box model
  width: string;
  height: string;
  padding: string;
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;
  margin: string;
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;

  // Border
  border: string;
  borderTop: string;
  borderRadius: string;

  // Visual
  opacity: string;
  boxShadow: string;
  transform: string;
  filter: string;

  // Layout
  display: string;
  position: string;
  zIndex: string;
  overflow: string;
  flexDirection: string;

  // Content info
  textContent: string;
  tagName: string;
  className: string;

  // Position
  top: number;
  left: number;
}

function rgbToHex(rgb: string): string {
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return rgb;
  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

function cleanVal(v: string): string {
  if (v === "auto" || v === "normal" || v === "none" || v === "rgba(0, 0, 0, 0)") return v;
  return v;
}

export default function ContentInspector() {
  const [active, setActive] = useState(false);
  // The Content Inspector claims the editing spotlight while open — the floating
  // Edit/Change buttons and the Style Editor step aside automatically.
  const activeTool = useActiveEditTool();
  useEffect(() => {
    if (active) claimEditTool("inspector");
    else releaseEditTool("inspector");
  }, [active]);
  // Another tool (Style Editor) took the spotlight → close ourselves.
  useEffect(() => {
    if (active && activeTool && activeTool !== "inspector") setActive(false);
  }, [active, activeTool]);
  const [inspected, setInspected] = useState<InspectedStyle | null>(null);
  const [copied, setCopied] = useState(false);
  const [highlightEl, setHighlightEl] = useState<HTMLElement | null>(null);
  const [showAll, setShowAll] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleInspect = useCallback(
    (e: MouseEvent) => {
      if (!active) return;

      const target = e.target as HTMLElement;
      if (
        target.closest("[data-inspector]") ||
        target.closest("[data-inspector-tooltip]")
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const computed = window.getComputedStyle(target);
      const rect = target.getBoundingClientRect();

      let textContent = target.textContent?.trim() || "";
      if (textContent.length > 100) {
        textContent = textContent.slice(0, 100) + "...";
      }

      const rawColor = computed.color;
      const rawBg = computed.backgroundColor;

      setInspected({
        // Text
        fontFamily: computed.fontFamily,
        fontSize: computed.fontSize,
        fontWeight: computed.fontWeight,
        fontStyle: computed.fontStyle,
        fontVariant: computed.fontVariant,
        textDecoration: computed.textDecoration,
        textTransform: computed.textTransform,
        lineHeight: computed.lineHeight,
        letterSpacing: computed.letterSpacing,
        wordSpacing: computed.wordSpacing,
        textAlign: computed.textAlign,
        textIndent: computed.textIndent,
        whiteSpace: computed.whiteSpace,
        textOverflow: computed.textOverflow,

        // Colors
        color: rgbToHex(rawColor),
        colorRGB: rawColor,
        backgroundColor: rawBg === "rgba(0, 0, 0, 0)" ? "transparent" : rgbToHex(rawBg),
        bgColorRGB: rawBg,

        // Box model
        width: computed.width,
        height: computed.height,
        padding: computed.padding,
        paddingTop: computed.paddingTop,
        paddingRight: computed.paddingRight,
        paddingBottom: computed.paddingBottom,
        paddingLeft: computed.paddingLeft,
        margin: computed.margin,
        marginTop: computed.marginTop,
        marginRight: computed.marginRight,
        marginBottom: computed.marginBottom,
        marginLeft: computed.marginLeft,

        // Border
        border: computed.border,
        borderTop: computed.borderTop,
        borderRadius: computed.borderRadius,

        // Visual
        opacity: computed.opacity,
        boxShadow: computed.boxShadow,
        transform: computed.transform,
        filter: computed.filter,

        // Layout
        display: computed.display,
        position: computed.position,
        zIndex: computed.zIndex,
        overflow: computed.overflow,
        flexDirection: computed.flexDirection,

        // Content
        textContent,
        tagName: target.tagName.toLowerCase(),
        className: target.className?.toString().slice(0, 120) || "",

        // Position
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
      });

      setHighlightEl(target);
    },
    [active]
  );

  const handleDismiss = useCallback(() => {
    setInspected(null);
    setHighlightEl(null);
    setCopied(false);
    setShowAll(false);
  }, []);

  useEffect(() => {
    if (active) {
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          handleDismiss();
          setActive(false);
        }
      };
      document.addEventListener("click", handleInspect, true);
      document.addEventListener("keydown", handleKey);
      document.body.style.cursor = "crosshair";
      return () => {
        document.removeEventListener("click", handleInspect, true);
        document.removeEventListener("keydown", handleKey);
        document.body.style.cursor = "";
      };
    } else {
      document.body.style.cursor = "";
      handleDismiss();
    }
  }, [active, handleInspect, handleDismiss]);

  // Highlight border around inspected element
  useEffect(() => {
    if (!highlightEl) return;
    const prev = highlightEl.style.outline;
    const prevOffset = highlightEl.style.outlineOffset;
    highlightEl.style.outline = "2px solid #D4AF37";
    highlightEl.style.outlineOffset = "3px";
    return () => {
      highlightEl.style.outline = prev;
      highlightEl.style.outlineOffset = prevOffset;
    };
  }, [highlightEl]);

  // Reposition tooltip if it goes off-screen (only on inspected change, not showAll)
  useEffect(() => {
    if (!inspected || !tooltipRef.current) return;
    // Use requestAnimationFrame to measure after DOM update
    const raf = requestAnimationFrame(() => {
      const tooltip = tooltipRef.current;
      if (!tooltip) return;
      const rect = tooltip.getBoundingClientRect();
      let { top, left } = inspected;

      if (top + rect.height > window.innerHeight + window.scrollY - 20) {
        top = top - rect.height - 20;
      }
      if (left + rect.width > window.innerWidth - 20) {
        left = window.innerWidth - rect.width - 20;
      }
      if (left < 10) left = 10;
      if (top < window.scrollY + 10) top = window.scrollY + 10;

      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${left}px`;
    });
    return () => cancelAnimationFrame(raf);
  }, [inspected]);

  const handleCopy = () => {
    if (!inspected) return;
    const css = [
      `element: <${inspected.tagName}>`,
      `font-family: ${inspected.fontFamily};`,
      `font-size: ${inspected.fontSize};`,
      `font-weight: ${inspected.fontWeight};`,
      `font-style: ${inspected.fontStyle};`,
      `color: ${inspected.colorRGB};`,
      `color-hex: ${inspected.color};`,
      `background: ${inspected.bgColorRGB};`,
      `line-height: ${inspected.lineHeight};`,
      `letter-spacing: ${inspected.letterSpacing};`,
      `text-align: ${inspected.textAlign};`,
      `text-decoration: ${inspected.textDecoration};`,
      `text-transform: ${inspected.textTransform};`,
      `padding: ${inspected.padding};`,
      `margin: ${inspected.margin};`,
      `border: ${inspected.border};`,
      `border-radius: ${inspected.borderRadius};`,
      `opacity: ${inspected.opacity};`,
      `display: ${inspected.display};`,
      `box-shadow: ${inspected.boxShadow};`,
    ].join("\n");
    navigator.clipboard.writeText(css).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const primaryStyleItems = inspected
    ? [
        { label: "Element", value: `<${inspected.tagName}>`, icon: "🏷️" },
        { label: "Font Family", value: inspected.fontFamily.split(",")[0].trim().replace(/['"]/g, ""), icon: "🔤" },
        { label: "Font Size", value: inspected.fontSize, icon: "📏" },
        { label: "Font Weight", value: inspected.fontWeight, icon: "⚖️" },
        { label: "Font Style", value: inspected.fontStyle, icon: "✏️" },
        { label: "Color", value: inspected.colorRGB, icon: "🎨", hex: inspected.color },
        { label: "Background", value: inspected.bgColorRGB === "rgba(0, 0, 0, 0)" ? "transparent" : inspected.bgColorRGB, icon: "🖼️", hex: inspected.backgroundColor },
        { label: "Line Height", value: inspected.lineHeight, icon: "↕️" },
        { label: "Letter Spacing", value: inspected.letterSpacing, icon: "↔️" },
        { label: "Text Align", value: inspected.textAlign, icon: "📐" },
        { label: "Text Decoration", value: inspected.textDecoration, icon: "Underline" },
        { label: "Text Transform", value: inspected.textTransform, icon: "🔠" },
      ]
    : [];

  const advancedStyleItems = inspected
    ? [
        { label: "Width", value: inspected.width, icon: "↔️" },
        { label: "Height", value: inspected.height, icon: "↕️" },
        { label: "Padding", value: inspected.padding, icon: "📦" },
        { label: "Padding Top", value: inspected.paddingTop, icon: "" },
        { label: "Padding Right", value: inspected.paddingRight, icon: "" },
        { label: "Padding Bottom", value: inspected.paddingBottom, icon: "" },
        { label: "Padding Left", value: inspected.paddingLeft, icon: "" },
        { label: "Margin", value: inspected.margin, icon: "📐" },
        { label: "Margin Top", value: inspected.marginTop, icon: "" },
        { label: "Margin Bottom", value: inspected.marginBottom, icon: "" },
        { label: "Border", value: inspected.border, icon: "🔲" },
        { label: "Border Radius", value: inspected.borderRadius, icon: "⭕" },
        { label: "Opacity", value: inspected.opacity, icon: "👁️" },
        { label: "Box Shadow", value: inspected.boxShadow, icon: "🌑" },
        { label: "Display", value: inspected.display, icon: "📊" },
        { label: "Position", value: inspected.position, icon: "📍" },
        { label: "Overflow", value: inspected.overflow, icon: "✂️" },
        { label: "Font Variant", value: inspected.fontVariant, icon: "🔡" },
        { label: "Word Spacing", value: inspected.wordSpacing, icon: "↔️" },
        { label: "Text Indent", value: inspected.textIndent, icon: "➡️" },
        { label: "White Space", value: inspected.whiteSpace, icon: "📄" },
        { label: "Z-Index", value: inspected.zIndex, icon: "📊" },
      ]
    : [];

  return (
    <>

      {/* Floating Toggle Button - moved to top-left area */}
      <button
        data-inspector
        onClick={() => setActive(!active)}
        className={`fixed top-20 right-[72px] z-[9999] w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 cursor-pointer group ${
          active
            ? "bg-secondary text-primary scale-110 shadow-secondary/30 ring-2 ring-secondary/40"
            : "bg-white text-primary hover:bg-surface-container hover:scale-105 border border-primary/20 hover:shadow-xl"
        }`}
        title={active ? "Exit Inspector Mode (Esc)" : "Inspect Content Styles"}
      >
        <Pipette className="w-4.5 h-4.5" />
        {!active && (
          <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-secondary rounded-full border-2 border-white animate-pulse" />
        )}
      </button>

      {/* Inspector Active Indicator */}
      <AnimatePresence>
        {active && !inspected && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            data-inspector
            className="fixed top-33 right-[72px] z-[9999] bg-gray-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 border border-white/10"
          >
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            Click any text to inspect • Press Esc to exit
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inspected Style Panel */}
      <AnimatePresence>
        {inspected && (
          <motion.div
            ref={tooltipRef}
            data-inspector-tooltip
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed z-[10000] bg-gray-900 text-white rounded-2xl shadow-2xl border border-white/10 w-[320px] max-h-[80vh] overflow-hidden"
            style={{ top: inspected.top, left: inspected.left }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-white/5 to-white/[0.02] border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-secondary/20 flex items-center justify-center">
                  <Pipette className="w-3.5 h-3.5 text-secondary" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-secondary block">
                    Style Inspector
                  </span>
                  <span className="text-[9px] text-white/40 font-mono">
                    &lt;{inspected.tagName}&gt;
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleCopy}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  title="Copy All Styles"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-green-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-white/50 hover:text-white" />
                  )}
                </button>
                <button
                  onClick={handleDismiss}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5 text-white/50 hover:text-white" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto max-h-[calc(80vh-52px)]" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
              {/* Preview Text */}
              {inspected.textContent && (
                <div className="px-4 py-2.5 border-b border-white/10 bg-white/[0.03]">
                  <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">Content</p>
                  <p className="text-xs text-white/70 truncate font-medium leading-relaxed">
                    &ldquo;{inspected.textContent}&rdquo;
                  </p>
                </div>
              )}

              {/* Color Swatches */}
              <div className="px-4 py-3 border-b border-white/10 flex gap-3">
                <div className="flex-1 flex items-center gap-2 bg-white/5 rounded-xl p-2.5">
                  <span
                    className="w-10 h-10 rounded-lg border border-white/20 shrink-0 shadow-inner"
                    style={{ backgroundColor: inspected.color }}
                  />
                  <div className="min-w-0">
                    <p className="text-[9px] text-white/30 uppercase tracking-wider">Text Color</p>
                    <p className="text-[11px] text-white font-mono font-medium">{inspected.colorRGB}</p>
                    <p className="text-[10px] text-secondary font-mono">{inspected.color}</p>
                  </div>
                </div>
                <div className="flex-1 flex items-center gap-2 bg-white/5 rounded-xl p-2.5">
                  <span
                    className="w-10 h-10 rounded-lg border border-white/20 shrink-0 shadow-inner"
                    style={{ backgroundColor: inspected.backgroundColor === "transparent" ? "#1a1a1a" : inspected.backgroundColor }}
                  />
                  <div className="min-w-0">
                    <p className="text-[9px] text-white/30 uppercase tracking-wider">Background</p>
                    <p className="text-[11px] text-white font-mono font-medium truncate">
                      {inspected.bgColorRGB === "rgba(0, 0, 0, 0)" ? "transparent" : inspected.bgColorRGB}
                    </p>
                    <p className="text-[10px] text-secondary font-mono">{inspected.backgroundColor}</p>
                  </div>
                </div>
              </div>

              {/* Primary Style Properties */}
              <div className="px-4 py-3">
                <p className="text-[9px] text-white/30 uppercase tracking-wider mb-2 font-bold">Typography</p>
                <div className="space-y-1.5">
                  {primaryStyleItems.map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-2 py-0.5">
                      <span className="text-[10px] text-white/40 whitespace-nowrap min-w-[90px]">
                        {item.label}
                      </span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        {item.hex && (
                          <span
                            className="w-2.5 h-2.5 rounded-sm border border-white/20 shrink-0"
                            style={{ backgroundColor: item.hex }}
                          />
                        )}
                        <span className="text-[11px] text-white font-mono truncate text-right" title={item.value}>
                          {cleanVal(item.value)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Show More / Less Toggle */}
              <button
                onClick={() => setShowAll(!showAll)}
                className="w-full px-4 py-2 flex items-center justify-center gap-1 text-[10px] text-secondary/80 hover:text-secondary border-t border-white/10 hover:bg-white/[0.03] transition-colors cursor-pointer"
              >
                {showAll ? (
                  <>Less details <ChevronUp className="w-3 h-3" /></>
                ) : (
                  <>More details <ChevronDown className="w-3 h-3" /></>
                )}
              </button>

              {/* Advanced Style Properties */}
              <AnimatePresence>
                {showAll && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 py-3 border-t border-white/10">
                      <p className="text-[9px] text-white/30 uppercase tracking-wider mb-2 font-bold">Box Model & Layout</p>
                      <div className="space-y-1.5">
                        {advancedStyleItems.map((item) => (
                          <div key={item.label} className="flex items-center justify-between gap-2 py-0.5">
                            <span className="text-[10px] text-white/40 whitespace-nowrap min-w-[90px]">
                              {item.label}
                            </span>
                            <span className="text-[11px] text-white/70 font-mono truncate text-right" title={item.value}>
                              {cleanVal(item.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* CSS Class */}
                    {inspected.className && (
                      <div className="px-4 pb-3 border-t border-white/10 pt-3">
                        <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1 font-bold">Tailwind Classes</p>
                        <p className="text-[10px] text-white/50 font-mono break-all leading-relaxed bg-white/5 rounded-lg p-2">
                          {inspected.className}
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Copy Button */}
              <div className="px-4 py-3 border-t border-white/10">
                <button
                  onClick={handleCopy}
                  className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/70 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-green-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy All Styles as CSS
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
