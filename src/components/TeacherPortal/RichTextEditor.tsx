import { useRef, useState, useEffect, useCallback, type ReactNode } from "react";
import { cleanHtmlMarkup } from "../../lib/siteContent";
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Quote, Link2,
  Image as ImageIcon, Table2, Undo2, Redo2, Code2, IndentIncrease,
  IndentDecrease, CaseUpper, CaseLower, Languages, X, Upload,
  Unlink, Heading1, Heading2, Heading3, Pilcrow, Eraser, Type, Palette
} from "lucide-react";

const FONT_FAMILIES = [
  "Arial", "Calibri", "Times New Roman", "Georgia", "Tahoma",
  "Trebuchet MS", "Verdana", "Segoe UI", "Courier New", "Impact",
  "Comic Sans MS", "Traditional Arabic",
];

const FONT_SIZES = [
  "10px", "12px", "14px", "16px", "18px", "20px", "24px",
  "28px", "32px", "36px", "40px", "48px",
];

const TEXT_COLORS = ["#1C1C1C", "#0B6E4F", "#D4AF37", "#DC2626", "#2563EB", "#7C3AED", "#059669", "#F5F5F5"];

interface ToolbarButtonProps {
  onClick: () => void;
  title: string;
  active?: boolean;
  children: ReactNode;
}

function ToolbarButton({ onClick, title, active, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`w-8 h-8 flex items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-colors cursor-pointer shrink-0 ${
        active ? "bg-secondary-container text-primary" : ""
      }`}
    >
      {children}
    </button>
  );
}

interface PopoverProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

function Popover({ title, onClose, children }: PopoverProps) {
  return (
    <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-border rounded-xl shadow-xl p-4 w-72">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-primary">{title}</span>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClose}
          className="p-1 hover:bg-surface-container rounded cursor-pointer text-on-surface-variant"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {children}
    </div>
  );
}

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  token?: string;
  placeholders?: { token: string; label: string }[];
  minHeight?: number;
  placeholder?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  token,
  placeholders,
  minHeight = 200,
  placeholder = "Start writing…",
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  const [showSource, setShowSource] = useState(false);
  const [sourceText, setSourceText] = useState(value);
  const [popover, setPopover] = useState<null | "link" | "image" | "table">(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [imgUrl, setImgUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(4);

  const emit = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    if (html !== valueRef.current) {
      valueRef.current = html;
      onChange(html);
    }
  }, [onChange]);

  // Sync external value into the editor (only when it differs — avoids clobbering while typing).
  // Also strips browser copy/paste artifacts (<!--StartFragment--> etc.) from loaded values.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const cleaned = cleanHtmlMarkup(value);
    if (el.innerHTML !== cleaned) {
      el.innerHTML = cleaned;
      valueRef.current = cleaned;
    }
  }, [value]);

  // Prefer CSS spans over <font> tags for inline styles
  useEffect(() => {
    document.execCommand("styleWithCSS", false, "true");
  }, []);

  const exec = useCallback(
    (command: string, cmdValue?: string) => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      document.execCommand(command, false, cmdValue);
      emit();
    },
    [emit]
  );

  const wrapSelection = useCallback(
    (style: string) => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const span = document.createElement("span");
      span.setAttribute("style", style);
      if (range.collapsed) {
        span.innerHTML = "\u200b";
        range.insertNode(span);
        sel.removeAllRanges();
        const r = document.createRange();
        r.setStart(span.firstChild as Node, 0);
        r.collapse(true);
        sel.addRange(r);
      } else {
        try {
          range.surroundContents(span);
        } catch {
          const frag = range.extractContents();
          span.appendChild(frag);
          range.insertNode(span);
        }
        sel.removeAllRanges();
        const r = document.createRange();
        r.selectNodeContents(span);
        sel.addRange(r);
      }
      emit();
    },
    [emit]
  );

  const applySentenceCase = () => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const text = sel.toString();
    const transformed = text.replace(/(^\s*\w|[.!?]\s+\w)/g, (m) => m.toUpperCase());
    document.execCommand("insertText", false, transformed);
    emit();
  };

  const setDirection = (dir: "rtl" | "ltr") => {
    try {
      exec("direction", dir);
    } catch {
      wrapSelection(`direction:${dir};unicode-bidi:embed;`);
    }
  };

  const insertTable = () => {
    const rows = Math.max(1, tableRows);
    const cols = Math.max(1, tableCols);
    const cells = Array.from(
      { length: rows },
      () =>
        `<tr>${Array.from(
          { length: cols },
          () => '<td style="border:1px solid #c9c4b8;padding:6px;"><br></td>'
        ).join("")}</tr>`
    ).join("");
    const html = `<table style="width:100%;border-collapse:collapse;margin:8px 0;" cellspacing="0" cellpadding="0"><tbody>${cells}</tbody></table>`;
    exec("insertHTML", html);
    setPopover(null);
  };

  const handleImageUpload = async (file: File) => {
    if (!token) {
      alert("Upload requires being logged in as admin.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        exec("insertHTML", `<img src="${data.url}" alt="" style="max-width:100%;" />`);
        setPopover(null);
        setImgUrl("");
      } else {
        alert(data.error || "Upload failed");
      }
    } catch {
      alert("Upload connection error");
    }
    setUploading(false);
  };

  const insertImageFromUrl = () => {
    if (!imgUrl.trim()) return;
    exec("insertHTML", `<img src="${imgUrl.trim()}" alt="" style="max-width:100%;" />`);
    setPopover(null);
    setImgUrl("");
  };

  const insertLink = () => {
    const sel = window.getSelection();
    const hasSelection = sel && !sel.isCollapsed;
    if (!linkUrl.trim()) return;
    const url = linkUrl.trim().startsWith("http") ? linkUrl.trim() : `https://${linkUrl.trim()}`;
    if (hasSelection) {
      exec("createLink", url);
    } else {
      exec("insertHTML", `<a href="${url}" target="_blank">${url}</a>`);
    }
    setPopover(null);
    setLinkUrl("");
  };

  const toggleSource = () => {
    if (!showSource) {
      setSourceText(editorRef.current?.innerHTML || "");
    } else {
      // Commit source back (strip any pasted fragment/comment artifacts first)
      const el = editorRef.current;
      if (el) {
        const cleaned = cleanHtmlMarkup(sourceText);
        el.innerHTML = cleaned;
        valueRef.current = cleaned;
        onChange(cleaned);
      }
    }
    setShowSource(!showSource);
  };

  const placeholderBlock = (
    <span className="text-on-surface-variant/40 pointer-events-none absolute top-3 left-3 text-sm">
      {placeholder}
    </span>
  );

  const showPlaceholder = !value || value === "<br>";

  return (
    <div className="border border-border rounded-xl bg-white overflow-hidden">
      {/* Toolbar */}
      <div className="relative bg-surface-container-low border-b border-border px-2 py-1.5 flex flex-wrap items-center gap-1">
        {/* Undo / Redo */}
        <ToolbarButton title="Undo" onClick={() => exec("undo")}><Undo2 className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton title="Redo" onClick={() => exec("redo")}><Redo2 className="w-3.5 h-3.5" /></ToolbarButton>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Headings */}
        <ToolbarButton title="Heading 1" onClick={() => exec("formatBlock", "h1")}><Heading1 className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton title="Heading 2" onClick={() => exec("formatBlock", "h2")}><Heading2 className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton title="Heading 3" onClick={() => exec("formatBlock", "h3")}><Heading3 className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton title="Paragraph" onClick={() => exec("formatBlock", "p")}><Pilcrow className="w-3.5 h-3.5" /></ToolbarButton>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Inline styles */}
        <ToolbarButton title="Bold" onClick={() => exec("bold")}><Bold className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton title="Italic" onClick={() => exec("italic")}><Italic className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton title="Underline" onClick={() => exec("underline")}><Underline className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton title="Strikethrough" onClick={() => exec("strikeThrough")}><Strikethrough className="w-3.5 h-3.5" /></ToolbarButton>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Font family */}
        <select
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => exec("fontName", e.target.value)}
          value=""
          className="h-8 text-[11px] rounded-md border border-border bg-white px-1.5 cursor-pointer text-on-surface-variant focus:outline-none focus:border-secondary"
          title="Font family"
        >
          <option value="" disabled>Font</option>
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
          ))}
        </select>

        {/* Font size */}
        <select
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => wrapSelection(`font-size:${e.target.value};`)}
          value=""
          className="h-8 text-[11px] rounded-md border border-border bg-white px-1.5 cursor-pointer text-on-surface-variant focus:outline-none focus:border-secondary"
          title="Font size"
        >
          <option value="" disabled>Size</option>
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Colors */}
        <label
          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-surface-container-high cursor-pointer text-on-surface-variant shrink-0 relative"
          title="Text color"
        >
          <Palette className="w-3.5 h-3.5" />
          <input
            type="color"
            className="absolute inset-0 opacity-0 cursor-pointer"
            onMouseDown={(e) => e.preventDefault()}
            onChange={(e) => exec("foreColor", e.target.value)}
          />
        </label>
        <div className="flex items-center gap-0.5 px-1">
          {TEXT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              title={`Text color ${c}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("foreColor", c)}
              className="w-3.5 h-3.5 rounded-full border border-black/10 cursor-pointer hover:scale-125 transition-transform"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Text case */}
        <select
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "sentence") applySentenceCase();
            else if (v === "none") wrapSelection("text-transform:none;");
            else if (v) wrapSelection(`text-transform:${v};`);
            e.target.value = "";
          }}
          value=""
          className="h-8 text-[11px] rounded-md border border-border bg-white px-1.5 cursor-pointer text-on-surface-variant focus:outline-none focus:border-secondary"
          title="Text case"
        >
          <option value="" disabled>Case</option>
          <option value="none">None</option>
          <option value="uppercase">UPPERCASE</option>
          <option value="lowercase">lowercase</option>
          <option value="capitalize">Capitalize Each Word</option>
          <option value="sentence">Sentence case</option>
        </select>
        <ToolbarButton title="Upper" onClick={() => wrapSelection("text-transform:uppercase;")}><CaseUpper className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton title="Lower" onClick={() => wrapSelection("text-transform:lowercase;")}><CaseLower className="w-3.5 h-3.5" /></ToolbarButton>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Alignment */}
        <ToolbarButton title="Align left" onClick={() => exec("justifyLeft")}><AlignLeft className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton title="Align center" onClick={() => exec("justifyCenter")}><AlignCenter className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton title="Align right" onClick={() => exec("justifyRight")}><AlignRight className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton title="Justify" onClick={() => exec("justifyFull")}><AlignJustify className="w-3.5 h-3.5" /></ToolbarButton>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Lists */}
        <ToolbarButton title="Bullet list" onClick={() => exec("insertUnorderedList")}><List className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton title="Numbered list" onClick={() => exec("insertOrderedList")}><ListOrdered className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton title="Indent" onClick={() => exec("indent")}><IndentIncrease className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton title="Outdent" onClick={() => exec("outdent")}><IndentDecrease className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton title="Blockquote" onClick={() => exec("formatBlock", "blockquote")}><Quote className="w-3.5 h-3.5" /></ToolbarButton>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Direction */}
        <ToolbarButton title="Right-to-left (Arabic)" onClick={() => setDirection("rtl")}><Languages className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton title="Left-to-right" onClick={() => setDirection("ltr")}><Type className="w-3.5 h-3.5" /></ToolbarButton>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Inserts */}
        <div className="relative">
          <ToolbarButton title="Insert link" onClick={() => setPopover(popover === "link" ? null : "link")}><Link2 className="w-3.5 h-3.5" /></ToolbarButton>
          {popover === "link" && (
            <Popover title="Insert Link" onClose={() => setPopover(null)}>
              <input
                type="text"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full bg-surface border border-border p-2.5 text-xs rounded-lg focus:outline-none focus:border-secondary mb-2"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={insertLink}
                  className="flex-1 bg-primary text-white py-2 rounded-lg text-xs font-semibold cursor-pointer hover:bg-primary-container"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => exec("unlink")}
                  className="flex-1 border border-border text-on-surface-variant py-2 rounded-lg text-xs font-semibold cursor-pointer hover:bg-surface-container flex items-center justify-center gap-1"
                >
                  <Unlink className="w-3 h-3" /> Remove
                </button>
              </div>
            </Popover>
          )}
        </div>

        <div className="relative">
          <ToolbarButton title="Insert image" onClick={() => setPopover(popover === "image" ? null : "image")}><ImageIcon className="w-3.5 h-3.5" /></ToolbarButton>
          {popover === "image" && (
            <Popover title="Insert Image" onClose={() => setPopover(null)}>
              {token && (
                <label className="flex items-center justify-center gap-2 bg-surface-container border border-dashed border-border rounded-lg py-2.5 text-xs font-semibold text-primary cursor-pointer hover:bg-surface-container-high mb-2">
                  <Upload className="w-3.5 h-3.5" />
                  {uploading ? "Uploading…" : "Upload image"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImageUpload(f);
                    }}
                  />
                </label>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={imgUrl}
                  onChange={(e) => setImgUrl(e.target.value)}
                  placeholder="https://… or /uploads/…"
                  className="flex-1 bg-surface border border-border p-2.5 text-xs rounded-lg focus:outline-none focus:border-secondary"
                />
                <button
                  type="button"
                  onClick={insertImageFromUrl}
                  className="bg-primary text-white px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer hover:bg-primary-container"
                >
                  Add
                </button>
              </div>
            </Popover>
          )}
        </div>

        <div className="relative">
          <ToolbarButton title="Insert table" onClick={() => setPopover(popover === "table" ? null : "table")}><Table2 className="w-3.5 h-3.5" /></ToolbarButton>
          <ToolbarButton title="Remove table (place cursor inside table first)" onClick={() => {
            const el = editorRef.current;
            if (!el) return;
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;
            let node: Node | null = sel.getRangeAt(0).startContainer;
            while (node && node !== el) {
              if (node.nodeName === "TABLE") {
                node.parentNode?.removeChild(node);
                emit();
                return;
              }
              node = node.parentNode;
            }
            alert("Place your cursor inside a table first, then click this button.");
          }}><X className="w-3.5 h-3.5 text-red-500" /></ToolbarButton>
          {popover === "table" && (
            <Popover title="Insert Table" onClose={() => setPopover(null)}>
              <div className="flex items-center gap-3 mb-3">
                <label className="text-[11px] text-on-surface-variant flex items-center gap-2">
                  Rows
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={tableRows}
                    onChange={(e) => setTableRows(parseInt(e.target.value) || 1)}
                    className="w-14 bg-surface border border-border p-1.5 text-xs rounded-lg text-center focus:outline-none focus:border-secondary"
                  />
                </label>
                <label className="text-[11px] text-on-surface-variant flex items-center gap-2">
                  Columns
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={tableCols}
                    onChange={(e) => setTableCols(parseInt(e.target.value) || 1)}
                    className="w-14 bg-surface border border-border p-1.5 text-xs rounded-lg text-center focus:outline-none focus:border-secondary"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={insertTable}
                className="w-full bg-primary text-white py-2 rounded-lg text-xs font-semibold cursor-pointer hover:bg-primary-container"
              >
                Insert Table
              </button>
            </Popover>
          )}
        </div>

        <div className="w-px h-6 bg-border mx-1" />

        <ToolbarButton title="Clear all formatting & tables" onClick={() => {
          const el = editorRef.current;
          if (!el) return;
          // Remove all tables
          el.querySelectorAll("table").forEach((t) => t.remove());
          // Clear inline formatting
          exec("removeFormat");
        }}><Eraser className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton title="HTML source" onClick={toggleSource} active={showSource}><Code2 className="w-3.5 h-3.5" /></ToolbarButton>
      </div>

      {/* Placeholder chips (used by result-sheet template editor) */}
      {placeholders && placeholders.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-secondary-fixed/10 border-b border-border">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mr-1">
            Insert field:
          </span>
          {placeholders.map((p) => (
            <button
              key={p.token}
              type="button"
              title={p.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("insertText", p.token)}
              className="px-2 py-1 bg-white border border-secondary/30 text-primary text-[10px] font-mono rounded-md hover:bg-secondary-container cursor-pointer transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Editor area */}
      {showSource ? (
        <textarea
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          spellCheck={false}
          className="w-full p-3 text-xs font-mono bg-surface text-on-surface focus:outline-none resize-y"
          style={{ minHeight }}
        />
      ) : (
        <div className="relative">
          {showPlaceholder && placeholderBlock}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={emit}
            onBlur={emit}
            onPaste={(e) => {
              // Keep pasted content as HTML so formatting survives, but strip
              // StartFragment/EndFragment markers and other copy-paste junk first.
              e.preventDefault();
              const text = e.clipboardData.getData("text/html") || e.clipboardData.getData("text/plain");
              document.execCommand("insertHTML", false, cleanHtmlMarkup(text) || "<br>");
              emit();
            }}
            className="rich-html prose-none w-full px-3 py-3 text-sm text-on-surface focus:outline-none overflow-y-auto"
            style={{ minHeight }}
          />
        </div>
      )}
    </div>
  );
}
