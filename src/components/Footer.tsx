import { ScreenId } from "../types";
import { Phone, Globe, Mail, MapPin } from "lucide-react";
import { useSiteContent } from "../lib/siteContent";
import { cleanTaglineHtml } from "../lib/cleanHtml";
import EditableText from "./EditableText";

interface FooterProps {
  onScreenChange: (screen: ScreenId) => void;
  onStudentPortal?: () => void;
  onTeacherPortal?: () => void;
  onAdminPortal?: () => void;
}

export default function Footer({ onScreenChange, onStudentPortal, onTeacherPortal, onAdminPortal }: FooterProps) {
  const siteContent = useSiteContent();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-primary text-white border-t border-secondary/20 pt-12 pb-8 px-6">
      <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
        {/* Branding badge - Arabic first */}
        <div className="mb-1" dir="rtl">
          <p className="text-lg text-secondary-fixed/80 font-serif mb-0.5">
            <EditableText contentKey="footer_school_name_ar" value={siteContent.footer_school_name_ar || ""} fallback="مدرسة المصطفى" label="Footer School Name (Arabic)" rtl>
              <span dangerouslySetInnerHTML={{ __html: (siteContent.footer_school_name_ar && siteContent.footer_school_name_ar.trim() ? siteContent.footer_school_name_ar : "مدرسة المصطفى").replace(/\n/g, "<br/>") }} />
            </EditableText>
          </p>
        </div>
        <div className="mb-3">
          <h2 className="font-serif font-bold text-2xl tracking-tight text-white">
            <EditableText contentKey="school_name" value={siteContent.school_name || ""} fallback="Al Mustafa Academy" label="School Name (English)">
              <span dangerouslySetInnerHTML={{ __html: (siteContent.school_name && siteContent.school_name.trim() ? siteContent.school_name : "Al Mustafa Academy").replace(/\n/g, "<br/>") }} />
            </EditableText>
          </h2>
          {/* Tagline 1 — sits right under the school name (direction follows content) */}
          <p
            className="font-serif text-lg sm:text-xl text-white/90 font-semibold mt-1.5"
            dir="auto"
          >
            <EditableText contentKey="footer_tagline" value={siteContent.footer_tagline || ""} fallback="Nurturing Souls, Educating Minds" label="Footer Tagline (English)">
              <span dangerouslySetInnerHTML={{ __html: cleanTaglineHtml(siteContent.footer_tagline || "Nurturing Souls, Educating Minds") }} />
            </EditableText>
          </p>
          {/* Tagline 2 (direction follows content) */}
          <p
            className="font-serif text-sm text-white/60 mt-1"
            dir="auto"
          >
            <EditableText contentKey="footer_arabic_tagline" value={siteContent.footer_arabic_tagline || ""} fallback="جسر بين التقاليد والتميز — تنمية الأرواح وتعليم العقول" label="Footer Arabic Tagline" rtl>
              <span dangerouslySetInnerHTML={{ __html: cleanTaglineHtml(siteContent.footer_arabic_tagline || "جسر بين التقاليد والتميز — تنمية الأرواح وتعليم العقول") }} />
            </EditableText>
          </p>
        </div>

        {/* Navigation Quicklinks */}
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-6 text-sm">
          <button
            onClick={() => onScreenChange("home")}
            className="text-white/80 hover:text-secondary-fixed transition-colors font-medium active:underline decoration-secondary cursor-pointer"
          >
            <EditableText contentKey="nav_home_label" value={siteContent.nav_home_label || ""} fallback="Home" label="Navigation: Home Label">
              <span dangerouslySetInnerHTML={{ __html: siteContent.nav_home_label || "Home" }} />
            </EditableText>
          </button>
          <button
            onClick={() => onScreenChange("admissions")}
            className="text-white/80 hover:text-secondary-fixed transition-colors font-medium active:underline decoration-secondary cursor-pointer"
          >
            <EditableText contentKey="nav_admissions_label" value={siteContent.nav_admissions_label || ""} fallback="Admissions" label="Navigation: Admissions Label">
              <span dangerouslySetInnerHTML={{ __html: siteContent.nav_admissions_label || "Admissions" }} />
            </EditableText>
          </button>
          <button
            onClick={() => onScreenChange("curriculum")}
            className="text-white/80 hover:text-secondary-fixed transition-colors font-medium active:underline decoration-secondary cursor-pointer"
          >
            <EditableText contentKey="nav_curriculum_label" value={siteContent.nav_curriculum_label || ""} fallback="Madrasah Activities" label="Navigation: Madrasah Activities Label">
              <span dangerouslySetInnerHTML={{ __html: siteContent.nav_curriculum_label || "Madrasah Activities" }} />
            </EditableText>
          </button>
        </nav>

        {/* Contact info — icons + editable phone / email / address */}
        <div className="flex flex-col items-center gap-2.5 mb-5">
          <div className="flex justify-center gap-4">
            <a
              href={`tel:${siteContent.contact_phone || "08037525855"}`}
              className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-secondary-fixed hover:text-primary transition-all duration-300"
              aria-label="Call the academy office"
              title={siteContent.contact_phone || "Call Us"}
            >
              <Phone className="w-5 h-5" />
            </a>
            <a
              href={`mailto:${siteContent.contact_email || "almustafaacademyilorin@gmail.com"}`}
              className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-secondary-fixed hover:text-primary transition-all duration-300"
              aria-label="Send an email to admissions"
              title={siteContent.contact_email || "Email Admissions"}
            >
              <Mail className="w-5 h-5" />
            </a>
            <a
              href={typeof window !== "undefined" ? window.location.origin : "#"}
              className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-secondary-fixed hover:text-primary transition-all duration-300"
              aria-label="Visit the Al Mustafa Academy website"
              title="Official Website"
            >
              <Globe className="w-5 h-5" />
            </a>
          </div>

          {/* Editable contact details */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-1.5 text-sm text-white/75">
            <a href={`tel:${siteContent.contact_phone || "08037525855"}`} className="flex items-center gap-1.5 hover:text-secondary-fixed transition-colors">
              <Phone className="w-3.5 h-3.5 text-secondary-fixed/70" />
              <EditableText contentKey="contact_phone" value={siteContent.contact_phone || ""} fallback="08037525855" label="Contact Phone" plain>
                <span>{siteContent.contact_phone || "08037525855"}</span>
              </EditableText>
            </a>
            <a href={`mailto:${siteContent.contact_email || "almustafaacademyilorin@gmail.com"}`} className="flex items-center gap-1.5 hover:text-secondary-fixed transition-colors">
              <Mail className="w-3.5 h-3.5 text-secondary-fixed/70" />
              <EditableText contentKey="contact_email" value={siteContent.contact_email || ""} fallback="almustafaacademyilorin@gmail.com" label="Contact Email" plain>
                <span>{siteContent.contact_email || "almustafaacademyilorin@gmail.com"}</span>
              </EditableText>
            </a>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-secondary-fixed/70" />
              <EditableText contentKey="school_address" value={siteContent.school_address || ""} fallback="25, Sabo-Line Road, Ilorin, Nigeria" label="School Address" plain>
                <span>{siteContent.school_address || "25, Sabo-Line Road, Ilorin, Nigeria"}</span>
              </EditableText>
            </span>
          </div>
        </div>

        {/* Metallic gradient divider line */}
        <div className="w-full max-w-lg gold-divider opacity-30 my-3" />

        {/* Legal Disclaimer */}
        <p className="font-sans text-xs text-white/60 tracking-wide mt-2">
          © {currentYear}{" "}
          <EditableText contentKey="footer_text" value={siteContent.footer_text || ""} fallback="Al Mustafa Academy. Where the Qur'an and Sunnah Shape Character and Excellence since 2013." label="Footer Copyright Text">
            <span dangerouslySetInnerHTML={{ __html: (siteContent.footer_text && siteContent.footer_text.trim() ? siteContent.footer_text : "Al Mustafa Academy. Where the Qur'an and Sunnah Shape Character and Excellence since 2013.").replace(/\n/g, "<br/>") }} />
          </EditableText>
        </p>
      </div>
    </footer>
  );
}
