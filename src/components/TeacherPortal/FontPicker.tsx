import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Type } from "lucide-react";

// Common web fonts organized by category
const FONT_OPTIONS = [
  // Serif Fonts (Good for Headings)
  { name: "Playfair Display", category: "serif", value: "Playfair Display, Georgia, serif" },
  { name: "Georgia", category: "serif", value: "Georgia, serif" },
  { name: "Times New Roman", category: "serif", value: "'Times New Roman', Times, serif" },
  { name: "Garamond", category: "serif", value: "Garamond, serif" },
  { name: "Merriweather", category: "serif", value: "Merriweather, serif" },
  { name: "Lora", category: "serif", value: "Lora, serif" },
  { name: "PT Serif", category: "serif", value: "'PT Serif', serif" },
  
  // Sans-Serif Fonts (Good for Body)
  { name: "Inter", category: "sans-serif", value: "Inter, system-ui, sans-serif" },
  { name: "Open Sans", category: "sans-serif", value: "'Open Sans', system-ui, sans-serif" },
  { name: "Roboto", category: "sans-serif", value: "Roboto, system-ui, sans-serif" },
  { name: "Lato", category: "sans-serif", value: "Lato, sans-serif" },
  { name: "Montserrat", category: "sans-serif", value: "Montserrat, sans-serif" },
  { name: "Poppins", category: "sans-serif", value: "Poppins, sans-serif" },
  { name: "Source Sans Pro", category: "sans-serif", value: "'Source Sans Pro', sans-serif" },
  { name: "Nunito", category: "sans-serif", value: "Nunito, sans-serif" },
  
  // Arabic Fonts
  { name: "Traditional Arabic", category: "arabic", value: "'Traditional Arabic', Arial, sans-serif" },
  { name: "Scheherazade New", category: "arabic", value: "'Scheherazade New', serif" },
  { name: "Amiri", category: "arabic", value: "Amiri, serif" },
  { name: "Lateef", category: "arabic", value: "Lateef, serif" },
  { name: "Noto Naskh Arabic", category: "arabic", value: "'Noto Naskh Arabic', serif" },
  
  // Display / Decorative
  { name: "Cinzel", category: "display", value: "Cinzel, serif" },
  { name: "Josefin Sans", category: "display", value: "'Josefin Sans', sans-serif" },
  { name: "Raleway", category: "display", value: "Raleway, sans-serif" },
  { name: "Quicksand", category: "display", value: "Quicksand, sans-serif" },
];

interface FontPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  category?: "serif" | "sans-serif" | "arabic" | "display" | "all";
}

export default function FontPicker({ value, onChange, label, category = "all" }: FontPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter fonts by category and search
  const filteredFonts = FONT_OPTIONS.filter((font) => {
    const matchesCategory = category === "all" || font.category === category;
    const matchesSearch = font.name.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Get the display name for the current value
  const selectedFont = FONT_OPTIONS.find((f) => f.value === value);
  const displayName = selectedFont?.name || value.split(",")[0].replace(/['"]/g, "").trim();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Group fonts by category
  const groupedFonts = filteredFonts.reduce((acc, font) => {
    if (!acc[font.category]) acc[font.category] = [];
    acc[font.category].push(font);
    return acc;
  }, {} as Record<string, typeof FONT_OPTIONS>);

  const categoryLabels: Record<string, string> = {
    serif: "Serif (Headings)",
    "sans-serif": "Sans-Serif (Body)",
    arabic: "Arabic Fonts",
    display: "Display / Decorative",
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {label && (
        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
          {label}
        </label>
      )}
      
      {/* Selected value / Trigger */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setTimeout(() => inputRef.current?.focus(), 100);
        }}
        className="w-full bg-surface border border-border p-3 text-sm rounded-lg focus:outline-none focus:border-secondary transition-colors text-left flex items-center justify-between cursor-pointer hover:border-primary/30"
      >
        <span className="truncate" style={{ fontFamily: value }}>
          {displayName}
        </span>
        <ChevronDown className={`w-4 h-4 text-on-surface-variant transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-border rounded-xl shadow-xl overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-border-light">
            <div className="relative">
              <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search fonts..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-surface rounded-lg focus:outline-none focus:border-secondary border border-transparent"
              />
            </div>
          </div>

          {/* Font list */}
          <div className="max-h-64 overflow-y-auto">
            {Object.entries(groupedFonts).map(([cat, fonts]) => (
              <div key={cat}>
                <div className="px-3 py-1.5 bg-surface-container-low text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider">
                  {categoryLabels[cat] || cat}
                </div>
                {fonts.map((font) => (
                  <button
                    key={font.value}
                    type="button"
                    onClick={() => {
                      onChange(font.value);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`w-full px-3 py-2.5 text-left hover:bg-surface-container transition-colors flex items-center justify-between group ${
                      value === font.value ? "bg-primary/5" : ""
                    }`}
                  >
                    <div>
                      <span className="text-sm block" style={{ fontFamily: font.value }}>
                        {font.name}
                      </span>
                      <span className="text-[10px] text-on-surface-variant/50 capitalize">
                        {font.category.replace("-", " ")}
                      </span>
                    </div>
                    {value === font.value && (
                      <Check className="w-4 h-4 text-secondary shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            ))}
            
            {filteredFonts.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-on-surface-variant/50">
                No fonts found matching "{search}"
              </div>
            )}
          </div>

          {/* Custom input */}
          <div className="p-2 border-t border-border-light bg-surface-container-low">
            <p className="text-[10px] text-on-surface-variant/60 mb-1.5">Or enter custom font stack:</p>
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="e.g., 'My Font', sans-serif"
              className="w-full px-3 py-2 text-xs bg-white border border-border rounded-lg focus:outline-none focus:border-secondary font-mono"
            />
          </div>
        </div>
      )}
    </div>
  );
}
