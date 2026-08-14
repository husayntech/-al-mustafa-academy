import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Menu, Home, GraduationCap, BookOpen, CalendarDays, HelpCircle, ChevronDown, Lock, UserRound, ShieldCheck } from "lucide-react";
import { ScreenId } from "../types";
import { useSiteContent, normalizeImageUrl } from "../lib/siteContent";
import EditableImage from "./EditableImage";
import EditableText from "./EditableText";

interface HeaderProps {
  currentScreen: ScreenId;
  onScreenChange: (screen: ScreenId) => void;
  onStudentPortal?: () => void;
  onTeacherPortal?: () => void;
  onAdminPortal?: () => void;
}

export default function Header({
  currentScreen,
  onScreenChange,
  onStudentPortal,
  onTeacherPortal,
  onAdminPortal,
}: HeaderProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [portalsOpen, setPortalsOpen] = useState(false);
  const siteContent = useSiteContent();
  const logoUrl = normalizeImageUrl(siteContent.logo_url || "/uploads/logo_1785834148413.jpeg");

  const navLinks: { id: ScreenId; label: string; labelKey: string; icon: any }[] = [
    { id: "home", label: siteContent.nav_home_label || "Home", labelKey: "nav_home_label", icon: Home },
    { id: "admissions", label: siteContent.nav_admissions_label || "Admissions", labelKey: "nav_admissions_label", icon: GraduationCap },
    { id: "calendar", label: siteContent.nav_calendar_label || "Academic Calendar", labelKey: "nav_calendar_label", icon: CalendarDays },
    { id: "curriculum", label: siteContent.nav_curriculum_label || "Madrasah Activities", labelKey: "nav_curriculum_label", icon: BookOpen },
    { id: "faq", label: siteContent.nav_faq_label || "FAQs", labelKey: "nav_faq_label", icon: HelpCircle },
  ];

  const portalLinks: { label: string; icon: any; onClick?: () => void }[] = [
    { label: siteContent.header_student_portal_label || "Student Portal", icon: UserRound, onClick: onStudentPortal },
    { label: siteContent.header_staff_portal_label || "Staff Portal", icon: GraduationCap, onClick: onTeacherPortal },
    { label: siteContent.header_admin_portal_label || "Admin Portal", icon: ShieldCheck, onClick: onAdminPortal },
  ];

  const handleLinkClick = (id: ScreenId) => {
    setDrawerOpen(false);
    setPortalsOpen(false);
    onScreenChange(id);
  };

  const handlePortalClick = (fn?: () => void) => {
    setPortalsOpen(false);
    setDrawerOpen(false);
    if (fn) fn();
  };

  return (
    <>
      <header className="fixed top-0 left-0 w-full z-40 bg-white border-b border-primary/5 shadow-xs h-16">
        <div className="flex justify-between items-center px-6 h-full w-full max-w-7xl mx-auto">
          {/* Mobile Menu Trigger & Branding */}
          <div className="flex items-center gap-3">
            <button
              id="menu-toggle"
              onClick={() => setDrawerOpen(true)}
              className="p-1.5 lg:hidden text-primary hover:bg-surface-container rounded-md transition-colors cursor-pointer"
              aria-label="Toggle Navigation Drawer"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div
              onClick={() => handleLinkClick("home")}
              className="flex items-center gap-2 cursor-pointer hover:opacity-85 transition-opacity"
            >
              <EditableImage
                contentKey="logo_url"
                label="School Logo"
                src={logoUrl}
                alt="Al Mustafa Academy Logo"
                className="relative w-9 h-9 rounded-lg shrink-0"
              >
                <img
                  src={logoUrl}
                  alt="Al Mustafa Academy Logo"
                  className="w-9 h-9 rounded-lg object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </EditableImage>
              <h1
                className="font-serif text-xl font-bold text-primary tracking-tight"
              >
                <EditableText contentKey="school_name" value={siteContent.school_name || ""} fallback="Al Mustafa Academy" label="School Name (English)">
                  <span dangerouslySetInnerHTML={{ __html: siteContent.school_name || "Al Mustafa Academy" }} />
                </EditableText>
              </h1>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-6 xl:gap-8 h-full">
            {navLinks.map((link) => {
              const isActive = currentScreen === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => handleLinkClick(link.id)}
                  className={`relative h-full text-sm font-semibold tracking-wide flex items-center transition-colors cursor-pointer ${
                    isActive
                      ? "text-secondary"
                      : "text-on-surface-variant hover:text-secondary"
                  }`}
                >
                  <EditableText contentKey={link.labelKey} value={siteContent[link.labelKey] || ""} fallback={link.label} label={`Navigation: ${link.label}`}>
                    <span dangerouslySetInnerHTML={{ __html: link.label }} />
                  </EditableText>
                </button>
              );
            })}

            {/* Portals Dropdown */}
            <div className="relative h-full flex items-center">
              <button
                onClick={() => setPortalsOpen((v) => !v)}
                className={`relative h-full text-sm font-semibold tracking-wide flex items-center gap-1 transition-colors cursor-pointer ${
                  portalsOpen
                    ? "text-secondary border-b-2 border-secondary"
                    : "text-on-surface-variant hover:text-secondary"
                }`}
                aria-haspopup="true"
                aria-expanded={portalsOpen}
              >
                <Lock className="w-3.5 h-3.5" />
                {siteContent.header_portals_label || "Portals"}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${portalsOpen ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {portalsOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setPortalsOpen(false)}
                      aria-hidden="true"
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl border border-primary/10 shadow-2xl z-50 overflow-hidden py-1.5"
                    >
                      {portalLinks.map((p) => (
                        <button
                          key={p.label}
                          onClick={() => handlePortalClick(p.onClick)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors cursor-pointer text-left"
                        >
                          <p.icon className="w-4 h-4 text-secondary shrink-0" />
                          {p.label}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </nav>

          {/* Logo badge */}
          <div className="flex items-center gap-1.5 text-primary bg-primary/5 px-2.5 py-1.5 rounded-md">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-primary" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4.5C4 3.12 5.12 2 6.5 2H20v20H6.5C5.12 22 4 20.88 4 19.5V4.5Z" />
              <path d="M4 19.5C4 18.12 5.12 17 6.5 17H20" strokeWidth="0" fill="currentColor" opacity="0.1" />
              <path d="M8 7h8M8 11h6M8 15h4" strokeLinecap="round" />
              <path d="M12 2v20" strokeDasharray="2 2" opacity="0.3" />
            </svg>
            <span className="text-[11px] font-semibold tracking-wider font-sans uppercase hidden sm:inline">2013</span>
          </div>
        </div>
      </header>

      {/* Navigation Drawer (Mobile) */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Overlay */}
            <motion.div
              id="drawer-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 bg-black/50 z-50 backdrop-blur-xs cursor-pointer lg:hidden"
            />

            {/* Side Drawer Content */}
            <motion.aside
              id="drawer-container"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 250 }}
              className="fixed left-0 top-0 h-full w-80 max-w-[85vw] z-[60] bg-surface flex flex-col py-6 px-1 shadow-2xl lg:hidden border-r border-primary/10"
            >
              <div className="px-5 mb-8 flex items-center gap-3">
                <EditableImage
                  contentKey="logo_url"
                  label="School Logo"
                  src={logoUrl}
                  alt="Al Mustafa Academy Logo"
                  className="relative w-12 h-12 rounded-xl shrink-0"
                >
                  <img
                    src={logoUrl}
                    alt="Al Mustafa Academy Logo"
                    className="w-12 h-12 rounded-xl object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </EditableImage>
                <div>
                  <h2
                    className="font-serif font-bold text-lg text-primary leading-tight"
                  >
                    <EditableText contentKey="school_name" value={siteContent.school_name || ""} fallback="Al Mustafa Academy" label="School Name (English)">
                      <span dangerouslySetInnerHTML={{ __html: siteContent.school_name || "Al Mustafa Academy" }} />
                    </EditableText>
                  </h2>
                  <p
                    className="text-[11px] font-semibold tracking-wider text-secondary uppercase mt-0.5"
                  >
                    <EditableText contentKey="header_tagline" value={siteContent.header_tagline || ""} fallback="Bridging Tradition &amp; Excellence" label="Header Tagline (under logo)">
                      <span dangerouslySetInnerHTML={{ __html: siteContent.header_tagline || "Bridging Tradition &amp; Excellence" }} />
                    </EditableText>
                  </p>
                </div>
              </div>

              <nav className="flex flex-col gap-1 px-2">
                {navLinks.map((link) => {
                  const isActive = currentScreen === link.id;
                  const IconComponent = link.icon;
                  return (
                    <button
                      key={link.id}
                      onClick={() => handleLinkClick(link.id)}
                      className={`w-full px-5 py-3.5 rounded-full flex items-center gap-4 transition-all text-left cursor-pointer ${
                        isActive
                          ? "bg-primary text-on-primary font-semibold shadow-md"
                          : "text-on-surface-variant hover:bg-surface-container-high"
                      }`}
                    >
                      <IconComponent className={`w-5 h-5 ${isActive ? "text-secondary-fixed" : "text-primary/70"}`} />
                      <EditableText contentKey={link.labelKey} value={siteContent[link.labelKey] || ""} fallback={link.label} label={`Navigation: ${link.label}`}>
                        <span className="text-sm font-medium" dangerouslySetInnerHTML={{ __html: link.label }} />
                      </EditableText>
                    </button>
                  );
                })}
              </nav>

              {/* Portal Access (Mobile) */}
              <div className="mt-4 px-2">
                <p className="px-5 text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest mb-2">
                  {siteContent.header_portal_access_label || "Portal Access"}
                </p>
                <div className="flex flex-col gap-1">
                  {portalLinks.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => handlePortalClick(p.onClick)}
                      className="w-full px-5 py-3 rounded-full flex items-center gap-4 text-left text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
                    >
                      <p.icon className="w-5 h-5 text-primary/70" />
                      <span className="text-sm font-medium">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-auto px-5 pt-8 border-t border-primary/5 text-center text-[10px] text-on-surface-variant/60 font-medium">
                {siteContent.established_tag || "Established 2013"} • {siteContent.footer_copyright_suffix || "All Rights Reserved"}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
