import { useEffect, useState } from "react";
import { cleanHtmlMarkup } from "./cleanHtml.js";
import { applyCustomStyles } from "./customStyles.js";

export { cleanHtmlMarkup };

/**
 * Local snapshot of the last-known site content. The blocking bootstrap in
 * index.html applies its theme + custom styles BEFORE the first paint, and
 * useSiteContent hydrates its initial state from it — so repeat visits render
 * the real UI immediately with zero flash of the hardcoded fallbacks.
 */
const SNAPSHOT_KEY = "ama_site_snapshot_v1";

export interface SiteSnapshot {
  content: Record<string, string>;
  ts: number;
}

export function readSiteSnapshot(): SiteSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw) as SiteSnapshot;
    return snap && snap.content ? snap : null;
  } catch {
    return null;
  }
}

export function writeSiteSnapshot(content: Record<string, string>) {
  try {
    localStorage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify({ content, ts: Date.now() } satisfies SiteSnapshot)
    );
  } catch {
    /* storage full / private mode — non-fatal */
  }
}

/**
 * Release the first-paint gate armed by the index.html bootstrap. Called as
 * soon as real content + styles are in place, and on fetch failure so the site
 * is never stuck hidden. Pairing data-ama-ready with the still-present
 * data-ama-boot flips the gate open and runs the fade-in (see index.css), and
 * the branded boot splash fades out at the same time.
 */
export function revealApp() {
  const root = document.documentElement;
  root.setAttribute("data-ama-ready", "1");
  const splash = document.getElementById("boot-splash");
  if (splash) {
    splash.classList.add("hide");
    setTimeout(() => splash.remove(), 300);
  }
}

export type ContentFieldType = "text" | "textarea" | "color" | "image" | "html" | "spacing";

export interface ContentField {
  key: string;
  label: string;
  type: ContentFieldType;
  group: string;
}

/**
 * Master catalog of every editable site-content field.
 * Used by the admin Content tab to render controls for ALL fields —
 * even ones not yet present in the database — so nothing is hidden.
 */
export const CONTENT_FIELDS: ContentField[] = [
  // Text & Announcements (rich HTML — style with fonts, colors, sizes, tables, images)
  { key: "school_announcement", label: "Announcement Banner", type: "html", group: "Text & Announcements" },
  { key: "hero_title", label: "Hero Headline", type: "html", group: "Text & Announcements" },
  { key: "hero_tagline_arabic", label: "Hero Arabic Tagline", type: "html", group: "Text & Announcements" },
  { key: "hero_subtitle", label: "Hero Subtitle", type: "html", group: "Text & Announcements" },
  { key: "cta_button_text", label: "CTA Button Text", type: "text", group: "Text & Announcements" },
  { key: "mission_heading", label: "Mission Heading", type: "html", group: "Text & Announcements" },
  { key: "mission_arabic", label: "Mission Arabic", type: "html", group: "Text & Announcements" },
  { key: "about_text", label: "Mission Paragraph", type: "html", group: "Text & Announcements" },
  { key: "tradition_title", label: "Tradition Card Title", type: "html", group: "Text & Announcements" },
  { key: "tradition_text", label: "Tradition Card Text", type: "html", group: "Text & Announcements" },
  { key: "excellence_title", label: "Excellence Card Title", type: "html", group: "Text & Announcements" },
  { key: "excellence_text", label: "Excellence Card Text", type: "html", group: "Text & Announcements" },

  // ==================== HEADER & FOOTER (branding, nav & copyright) ====================
  { key: "school_name", label: "School Name (English)", type: "html", group: "Header & Footer" },
  { key: "header_tagline", label: "Header Tagline (under logo)", type: "html", group: "Header & Footer" },
  { key: "footer_school_name_ar", label: "Footer School Name (Arabic)", type: "html", group: "Header & Footer" },
  { key: "footer_arabic_tagline", label: "Footer Arabic Tagline", type: "html", group: "Header & Footer" },
  { key: "footer_tagline", label: "Footer Tagline (English)", type: "html", group: "Header & Footer" },
  { key: "footer_text", label: "Footer Copyright Text", type: "html", group: "Header & Footer" },
  { key: "established_tag", label: "Established Tag", type: "text", group: "Header & Footer" },
  { key: "nav_home_label", label: "Navigation: Home Label", type: "html", group: "Header & Footer" },
  { key: "nav_welcome_label", label: "Navigation: Welcome Label", type: "html", group: "Header & Footer" },
  { key: "nav_admissions_label", label: "Navigation: Admissions Label", type: "html", group: "Header & Footer" },
  { key: "nav_curriculum_label", label: "Navigation: Madrasah Activities Label", type: "html", group: "Header & Footer" },
  { key: "header_portals_label", label: "Portals Button Label", type: "text", group: "Header & Footer" },
  { key: "header_student_portal_label", label: "Student Portal Label", type: "text", group: "Header & Footer" },
  { key: "header_staff_portal_label", label: "Staff Portal Label", type: "text", group: "Header & Footer" },
  { key: "header_admin_portal_label", label: "Admin Portal Label", type: "text", group: "Header & Footer" },
  { key: "header_portal_access_label", label: "Mobile: Portal Access Label", type: "text", group: "Header & Footer" },
  { key: "footer_copyright_suffix", label: "Footer Copyright Suffix", type: "text", group: "Header & Footer" },

  // Colors & Theme
  { key: "color_primary", label: "Primary Color (green)", type: "color", group: "Colors & Theme" },
  { key: "color_primary_hover", label: "Primary Hover", type: "color", group: "Colors & Theme" },
  { key: "color_secondary", label: "Secondary / Gold", type: "color", group: "Colors & Theme" },
  { key: "color_secondary_hover", label: "Secondary Hover", type: "color", group: "Colors & Theme" },
  { key: "color_secondary_fixed", label: "Secondary Bright", type: "color", group: "Colors & Theme" },
  { key: "color_secondary_container", label: "Secondary Container (light gold)", type: "color", group: "Colors & Theme" },
  // Typography & Styling
  { key: "font_heading", label: "Heading Font Family", type: "text", group: "Typography & Styling" },
  { key: "font_body", label: "Body Font Family", type: "text", group: "Typography & Styling" },
  { key: "font_arabic", label: "Arabic Font Family", type: "text", group: "Typography & Styling" },
  { key: "heading_size_h1", label: "H1 Heading Size (px)", type: "text", group: "Typography & Styling" },
  { key: "heading_size_h2", label: "H2 Heading Size (px)", type: "text", group: "Typography & Styling" },
  { key: "heading_size_h3", label: "H3 Heading Size (px)", type: "text", group: "Typography & Styling" },
  { key: "body_text_size", label: "Body Text Size (px)", type: "text", group: "Typography & Styling" },
  { key: "line_height_body", label: "Body Line Height", type: "text", group: "Typography & Styling" },
  { key: "letter_spacing_headings", label: "Heading Letter Spacing (em)", type: "text", group: "Typography & Styling" },
  { key: "text_align_default", label: "Default Text Alignment", type: "text", group: "Typography & Styling" },

  // ==================== SECTION SPACING (Home Page) ====================
  { key: "home_hero_bottom_spacing", label: "Hero → Mission Gap", type: "spacing", group: "Section Spacing" },
  { key: "home_mission_heading_gap", label: "Mission: Heading → Paragraph", type: "spacing", group: "Section Spacing" },
  { key: "home_cards_gap", label: "Mission: Tradition ↔ Excellence Gap", type: "spacing", group: "Section Spacing" },
  { key: "home_mission_padding_top", label: "Mission Section: Top Padding", type: "spacing", group: "Section Spacing" },
  { key: "home_mission_padding_bottom", label: "Mission Section: Bottom Padding", type: "spacing", group: "Section Spacing" },

  // ==================== SECTION SPACING (Admissions Page) ====================
  { key: "admissions_hero_bottom_spacing", label: "Hero → Process Gap", type: "spacing", group: "Admissions Spacing" },
  { key: "admissions_process_heading_gap", label: "Process: Heading → Cards", type: "spacing", group: "Admissions Spacing" },
  { key: "admissions_process_padding_top", label: "Process Section: Top Padding", type: "spacing", group: "Admissions Spacing" },
  { key: "admissions_process_padding_bottom", label: "Process Section: Bottom Padding", type: "spacing", group: "Admissions Spacing" },
  { key: "admissions_docs_padding_top", label: "Documents & Fees: Top Padding", type: "spacing", group: "Admissions Spacing" },
  { key: "admissions_docs_padding_bottom", label: "Documents & Fees: Bottom Padding", type: "spacing", group: "Admissions Spacing" },
  { key: "admissions_form_heading_gap", label: "Contact: Heading → Form", type: "spacing", group: "Admissions Spacing" },
  { key: "admissions_form_padding_top", label: "Contact Form: Top Padding", type: "spacing", group: "Admissions Spacing" },
  { key: "admissions_form_padding_bottom", label: "Contact Form: Bottom Padding", type: "spacing", group: "Admissions Spacing" },

  // ==================== SECTION SPACING (Madrasah Activities Page) ====================
  { key: "madrasah_hero_bottom_spacing", label: "Hero → Intro Gap", type: "spacing", group: "Madrasah Spacing" },
  { key: "madrasah_intro_heading_gap", label: "Intro: Heading → Text", type: "spacing", group: "Madrasah Spacing" },
  { key: "madrasah_intro_padding_top", label: "Intro Section: Top Padding", type: "spacing", group: "Madrasah Spacing" },
  { key: "madrasah_intro_padding_bottom", label: "Intro Section: Bottom Padding", type: "spacing", group: "Madrasah Spacing" },
  { key: "madrasah_timeline_heading_gap", label: "Timeline: Heading → Schedule", type: "spacing", group: "Madrasah Spacing" },
  { key: "madrasah_timeline_padding_top", label: "Weekend Schedule: Top Padding", type: "spacing", group: "Madrasah Spacing" },
  { key: "madrasah_timeline_padding_bottom", label: "Weekend Schedule: Bottom Padding", type: "spacing", group: "Madrasah Spacing" },
  { key: "madrasah_weekly_heading_gap", label: "Weekly: Heading → Cards", type: "spacing", group: "Madrasah Spacing" },
  { key: "madrasah_weekly_padding_top", label: "Weekly Schedule: Top Padding", type: "spacing", group: "Madrasah Spacing" },
  { key: "madrasah_weekly_padding_bottom", label: "Weekly Schedule: Bottom Padding", type: "spacing", group: "Madrasah Spacing" },
  { key: "madrasah_announcements_heading_gap", label: "Announcements: Heading → Content", type: "spacing", group: "Madrasah Spacing" },
  { key: "madrasah_announcements_padding_top", label: "Announcements: Top Padding", type: "spacing", group: "Madrasah Spacing" },
  { key: "madrasah_announcements_padding_bottom", label: "Announcements: Bottom Padding", type: "spacing", group: "Madrasah Spacing" },
  { key: "madrasah_extra_heading_gap", label: "Extra Lessons: Heading → Content", type: "spacing", group: "Madrasah Spacing" },
  { key: "madrasah_extra_padding_top", label: "Extra Lessons: Top Padding", type: "spacing", group: "Madrasah Spacing" },
  { key: "madrasah_extra_padding_bottom", label: "Extra Lessons: Bottom Padding", type: "spacing", group: "Madrasah Spacing" },

  // Images
  { key: "hero_image_url", label: "Hero Background Image", type: "image", group: "Images" },
  { key: "logo_url", label: "School Logo", type: "image", group: "Images" },

  // Contact
  { key: "contact_phone", label: "Contact Phone", type: "text", group: "Contact" },
  { key: "contact_email", label: "Contact Email", type: "text", group: "Contact" },
  { key: "school_address", label: "School Address", type: "textarea", group: "Contact" },

  // ==================== ADMISSIONS PAGE ====================
  { key: "admissions_hero_image", label: "Hero Background Image", type: "image", group: "Admissions Page" },
  { key: "admissions_hero_title", label: "Hero Headline", type: "html", group: "Admissions Page" },
  { key: "admissions_hero_subtitle", label: "Hero Subtitle", type: "html", group: "Admissions Page" },
  { key: "admissions_apply_button_text", label: "Apply Button Text", type: "text", group: "Admissions Page" },
  { key: "admissions_process_heading", label: "Process Section Heading", type: "html", group: "Admissions Page" },
  { key: "admissions_step_1_title", label: "Step 1 Title", type: "text", group: "Admissions Page" },
  { key: "admissions_step_1_desc", label: "Step 1 Description", type: "html", group: "Admissions Page" },
  { key: "admissions_step_2_title", label: "Step 2 Title", type: "text", group: "Admissions Page" },
  { key: "admissions_step_2_desc", label: "Step 2 Description", type: "html", group: "Admissions Page" },
  { key: "admissions_step_3_title", label: "Step 3 Title", type: "text", group: "Admissions Page" },
  { key: "admissions_step_3_desc", label: "Step 3 Description", type: "html", group: "Admissions Page" },
  { key: "admissions_step_4_title", label: "Step 4 Title", type: "text", group: "Admissions Page" },
  { key: "admissions_step_4_desc", label: "Step 4 Description", type: "html", group: "Admissions Page" },
  { key: "admissions_documents_heading", label: "Required Documents Heading", type: "html", group: "Admissions Page" },
  { key: "admissions_documents_html", label: "Required Documents List", type: "html", group: "Admissions Page" },
  { key: "admissions_fees_heading", label: "Tuition & Fees Heading", type: "html", group: "Admissions Page" },
  { key: "admissions_fees_html", label: "Tuition & Fees Content", type: "html", group: "Admissions Page" },
  { key: "admissions_contact_heading", label: "Contact Section Heading", type: "html", group: "Admissions Page" },
  { key: "admissions_contact_text", label: "Contact Section Text", type: "html", group: "Admissions Page" },
  { key: "admissions_contact_phone", label: "Contact Phone Number", type: "text", group: "Admissions Page" },
  { key: "admissions_contact_email", label: "Contact Email Address", type: "text", group: "Admissions Page" },
  { key: "admissions_form_full_name_label", label: "Form: Full Name Label", type: "text", group: "Admissions Page" },
  { key: "admissions_form_full_name_placeholder", label: "Form: Full Name Placeholder", type: "text", group: "Admissions Page" },
  { key: "admissions_form_email_label", label: "Form: Email Label", type: "text", group: "Admissions Page" },
  { key: "admissions_form_email_placeholder", label: "Form: Email Placeholder", type: "text", group: "Admissions Page" },
  { key: "admissions_form_grade_label", label: "Form: Grade Label", type: "text", group: "Admissions Page" },
  { key: "admissions_form_grade_options", label: "Form: Grade Options (one per line)", type: "textarea", group: "Admissions Page" },
  { key: "admissions_whatsapp_number", label: "WhatsApp Number (with country code, e.g. 2348037525585)", type: "text", group: "Admissions Page" },
  { key: "admissions_form_message_label", label: "Form: Message Label", type: "text", group: "Admissions Page" },
  { key: "admissions_form_message_placeholder", label: "Form: Message Placeholder", type: "text", group: "Admissions Page" },
  { key: "admissions_form_submit_text", label: "Form: Submit Button Text", type: "text", group: "Admissions Page" },
  { key: "admissions_form_sending_text", label: "Form: Sending Loading Text", type: "text", group: "Admissions Page" },
  { key: "admissions_phone_label", label: "Contact: Phone Label", type: "text", group: "Admissions Page" },
  { key: "admissions_email_label", label: "Contact: Email Label", type: "text", group: "Admissions Page" },
  { key: "admissions_success_heading", label: "Success: Heading", type: "html", group: "Admissions Page" },
  { key: "admissions_success_message", label: "Success: Message", type: "html", group: "Admissions Page" },
  { key: "admissions_success_button", label: "Success: Button Text", type: "text", group: "Admissions Page" },
  { key: "admissions_fee_download_text", label: "Fee: Download Button Text", type: "text", group: "Admissions Page" },

  // ==================== MADRASAH ACTIVITIES PAGE ====================
  { key: "madrasah_hero_image", label: "Hero Background Image", type: "image", group: "Madrasah Activities Page" },
  { key: "madrasah_hero_arabic", label: "Hero Arabic Tagline", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_hero_title", label: "Hero Headline", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_hero_subtitle", label: "Hero Subtitle", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_intro_arabic", label: "Intro Arabic Tagline", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_intro_heading", label: "Intro Heading", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_intro_text", label: "Intro Paragraph", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_image", label: "Intro / Schedule Image", type: "image", group: "Madrasah Activities Page" },
  { key: "madrasah_timeline_arabic", label: "Timeline Arabic Tagline", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_timeline_heading", label: "Timeline Heading", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_timeline_subtitle", label: "Timeline Subtitle", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_1_time", label: "Entry 1 Time", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_1_title", label: "Entry 1 Title", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_1_desc", label: "Entry 1 Description", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_2_time", label: "Entry 2 Time (Kalimatu Sabahi)", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_2_title", label: "Entry 2 Title (Kalimatu Sabahi)", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_2_desc", label: "Entry 2 Description", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_3_time", label: "Entry 3 Time (Memorization & Muraaja'ah)", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_3_title", label: "Entry 3 Title (Memorization & Muraaja'ah)", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_3_desc", label: "Entry 3 Description", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_4_time", label: "Entry 4 Time (Normal Classes)", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_4_title", label: "Entry 4 Title (Normal Classes)", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_4_desc", label: "Entry 4 Description", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_5_time", label: "Entry 5 Time (Break)", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_5_title", label: "Entry 5 Title (Break)", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_5_desc", label: "Entry 5 Description", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_6_time", label: "Entry 6 Time (Classes Continue)", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_6_title", label: "Entry 6 Title (Classes Continue)", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_6_desc", label: "Entry 6 Description", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_7_time", label: "Entry 7 Time (Call for Salah)", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_7_title", label: "Entry 7 Title (Call for Salah)", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_7_desc", label: "Entry 7 Description", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_8_time", label: "Entry 8 Time (Extra Lessons)", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_8_title", label: "Entry 8 Title (Extra Lessons)", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_8_desc", label: "Entry 8 Description", type: "html", group: "Madrasah Activities Page" },
  // Weekend Schedule — Arabic labels for each entry
  { key: "madrasah_schedule_1_arabic", label: "Entry 1 Arabic (Morning Assembly)", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_2_arabic", label: "Entry 2 Arabic (Kalimatu Sabahi)", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_3_arabic", label: "Entry 3 Arabic (Memorization)", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_4_arabic", label: "Entry 4 Arabic (Normal Classes)", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_5_arabic", label: "Entry 5 Arabic (Break)", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_6_arabic", label: "Entry 6 Arabic (Classes Continue)", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_7_arabic", label: "Entry 7 Arabic (Call for Salah)", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_schedule_8_arabic", label: "Entry 8 Arabic (Extra Lessons)", type: "html", group: "Madrasah Activities Page" },
  // Weekend section label
  { key: "madrasah_weekend_label", label: "Weekend Schedule Label", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_after_salah_badge", label: "After Salah Badge Text", type: "text", group: "Madrasah Activities Page" },

  // Weekly Schedule section
  { key: "madrasah_weekly_arabic_header", label: "Weekly Section Arabic Header", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_weekly_heading", label: "Weekly Section Heading", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_weekly_subtitle", label: "Weekly Section Subtitle", type: "html", group: "Madrasah Activities Page" },
  // Monday
  { key: "madrasah_monday_name", label: "Monday Name", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_monday_arabic", label: "Monday Arabic", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_monday_time", label: "Monday Time Range", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_monday_act1_time", label: "Mon Activity 1 Time", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_monday_act1_title", label: "Mon Activity 1 Title", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_monday_act1_desc", label: "Mon Activity 1 Description", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_monday_act2_time", label: "Mon Activity 2 Time", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_monday_act2_title", label: "Mon Activity 2 Title", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_monday_act2_desc", label: "Mon Activity 2 Description", type: "html", group: "Madrasah Activities Page" },
  // Tuesday
  { key: "madrasah_tuesday_name", label: "Tuesday Name", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_tuesday_arabic", label: "Tuesday Arabic", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_tuesday_time", label: "Tuesday Time Range", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_tuesday_act1_time", label: "Tue Activity 1 Time", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_tuesday_act1_title", label: "Tue Activity 1 Title", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_tuesday_act1_desc", label: "Tue Activity 1 Description", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_tuesday_act2_time", label: "Tue Activity 2 Time", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_tuesday_act2_title", label: "Tue Activity 2 Title", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_tuesday_act2_desc", label: "Tue Activity 2 Description", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_tuesday_act3_time", label: "Tue Activity 3 Time", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_tuesday_act3_title", label: "Tue Activity 3 Title", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_tuesday_act3_desc", label: "Tue Activity 3 Description", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_tuesday_act4_time", label: "Tue Activity 4 Time", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_tuesday_act4_title", label: "Tue Activity 4 Title", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_tuesday_act4_desc", label: "Tue Activity 4 Description", type: "html", group: "Madrasah Activities Page" },
  // Wednesday
  { key: "madrasah_wednesday_name", label: "Wednesday Name", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_wednesday_arabic", label: "Wednesday Arabic", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_wednesday_time", label: "Wednesday Time Range", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_wednesday_act1_time", label: "Wed Activity 1 Time", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_wednesday_act1_title", label: "Wed Activity 1 Title", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_wednesday_act1_desc", label: "Wed Activity 1 Description", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_wednesday_act2_time", label: "Wed Activity 2 Time", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_wednesday_act2_title", label: "Wed Activity 2 Title", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_wednesday_act2_desc", label: "Wed Activity 2 Description", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_wednesday_act3_time", label: "Wed Activity 3 Time", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_wednesday_act3_title", label: "Wed Activity 3 Title", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_wednesday_act3_desc", label: "Wed Activity 3 Description", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_wednesday_act4_time", label: "Wed Activity 4 Time", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_wednesday_act4_title", label: "Wed Activity 4 Title", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_wednesday_act4_desc", label: "Wed Activity 4 Description", type: "html", group: "Madrasah Activities Page" },
  // Mutuun note
  { key: "madrasah_mutuun_heading", label: "Mutuun Note Heading", type: "text", group: "Madrasah Activities Page" },
  { key: "madrasah_mutuun_text", label: "Mutuun Note Text", type: "html", group: "Madrasah Activities Page" },

  // Student Address & Announcements
  { key: "madrasah_announcements_heading", label: "Student Address Heading", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_announcements_text", label: "Student Address Text", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_announcements_note", label: "Student Address Highlight Note", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_announcements_image", label: "Student Address Image", type: "image", group: "Madrasah Activities Page" },
  // Extra Lessons
  { key: "madrasah_extra_heading", label: "Extra Lessons Heading", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_extra_text", label: "Extra Lessons Text", type: "html", group: "Madrasah Activities Page" },
  { key: "madrasah_extra_image", label: "Extra Lessons Image", type: "image", group: "Madrasah Activities Page" },

  // ==================== WELCOME MESSAGE (Director / Principal) ====================
  { key: "welcome_heading", label: "Welcome: Section Heading", type: "html", group: "Welcome Message" },
  { key: "welcome_bismillah", label: "Welcome: Bismillah", type: "text", group: "Welcome Message" },
  { key: "welcome_salutation", label: "Welcome: Salutation", type: "text", group: "Welcome Message" },
  { key: "welcome_body", label: "Welcome: Message Body", type: "html", group: "Welcome Message" },
  { key: "welcome_name", label: "Welcome: Signatory Name", type: "text", group: "Welcome Message" },
  { key: "welcome_title", label: "Welcome: Signatory Title", type: "text", group: "Welcome Message" },
  { key: "welcome_photo", label: "Welcome: Director Photo", type: "image", group: "Welcome Message" },
  { key: "welcome_heading_gap", label: "Welcome: Heading → Message Gap", type: "spacing", group: "Welcome Message" },
  { key: "welcome_padding_top", label: "Welcome: Section Top Padding", type: "spacing", group: "Welcome Message" },
  { key: "welcome_padding_bottom", label: "Welcome: Section Bottom Padding", type: "spacing", group: "Welcome Message" },

  // ==================== ACADEMIC CALENDAR ====================
  { key: "calendar_heading", label: "Calendar: Section Heading", type: "html", group: "Academic Calendar" },
  { key: "calendar_subtitle", label: "Calendar: Subtitle (Session)", type: "text", group: "Academic Calendar" },
  { key: "calendar_term_label", label: "Calendar: Term Label", type: "text", group: "Academic Calendar" },
  { key: "calendar_term_dates", label: "Calendar: Term Dates", type: "text", group: "Academic Calendar" },
  { key: "calendar_event_1_title", label: "Calendar: Event 1 Title", type: "text", group: "Academic Calendar" },
  { key: "calendar_event_1_date", label: "Calendar: Event 1 Date", type: "text", group: "Academic Calendar" },
  { key: "calendar_event_2_title", label: "Calendar: Event 2 Title", type: "text", group: "Academic Calendar" },
  { key: "calendar_event_2_date", label: "Calendar: Event 2 Date", type: "text", group: "Academic Calendar" },
  { key: "calendar_event_3_title", label: "Calendar: Event 3 Title", type: "text", group: "Academic Calendar" },
  { key: "calendar_event_3_date", label: "Calendar: Event 3 Date", type: "text", group: "Academic Calendar" },
  { key: "calendar_note", label: "Calendar: Note", type: "html", group: "Academic Calendar" },
  { key: "calendar_heading_gap", label: "Calendar: Heading → Term Card Gap", type: "spacing", group: "Academic Calendar" },
  { key: "calendar_padding_top", label: "Calendar: Section Top Padding", type: "spacing", group: "Academic Calendar" },
  { key: "calendar_padding_bottom", label: "Calendar: Section Bottom Padding", type: "spacing", group: "Academic Calendar" },

  // ==================== FAQS ====================
  { key: "faq_heading", label: "FAQ: Section Heading", type: "html", group: "FAQs" },
  { key: "faq_subtitle", label: "FAQ: Subtitle", type: "html", group: "FAQs" },
  { key: "faq_q1", label: "FAQ: Question 1", type: "text", group: "FAQs" },
  { key: "faq_a1", label: "FAQ: Answer 1", type: "html", group: "FAQs" },
  { key: "faq_q2", label: "FAQ: Question 2", type: "text", group: "FAQs" },
  { key: "faq_a2", label: "FAQ: Answer 2", type: "html", group: "FAQs" },
  { key: "faq_q3", label: "FAQ: Question 3", type: "text", group: "FAQs" },
  { key: "faq_a3", label: "FAQ: Answer 3", type: "html", group: "FAQs" },
  { key: "faq_q4", label: "FAQ: Question 4", type: "text", group: "FAQs" },
  { key: "faq_a4", label: "FAQ: Answer 4", type: "html", group: "FAQs" },
  { key: "faq_q5", label: "FAQ: Question 5", type: "text", group: "FAQs" },
  { key: "faq_a5", label: "FAQ: Answer 5", type: "html", group: "FAQs" },
  { key: "faq_q6", label: "FAQ: Question 6", type: "text", group: "FAQs" },
  { key: "faq_a6", label: "FAQ: Answer 6", type: "html", group: "FAQs" },
  { key: "faq_heading_gap", label: "FAQ: Heading → Questions Gap", type: "spacing", group: "FAQs" },
  { key: "faq_padding_top", label: "FAQ: Section Top Padding", type: "spacing", group: "FAQs" },
  { key: "faq_padding_bottom", label: "FAQ: Section Bottom Padding", type: "spacing", group: "FAQs" },

  // ==================== GALLERY ====================
  { key: "gallery_heading", label: "Gallery: Section Heading", type: "html", group: "Gallery" },
  { key: "gallery_subtitle", label: "Gallery: Subtitle", type: "html", group: "Gallery" },
  { key: "gallery_image_1", label: "Gallery: Image 1", type: "image", group: "Gallery" },
  { key: "gallery_caption_1", label: "Gallery: Caption 1", type: "text", group: "Gallery" },
  { key: "gallery_image_2", label: "Gallery: Image 2", type: "image", group: "Gallery" },
  { key: "gallery_caption_2", label: "Gallery: Caption 2", type: "text", group: "Gallery" },
  { key: "gallery_image_3", label: "Gallery: Image 3", type: "image", group: "Gallery" },
  { key: "gallery_caption_3", label: "Gallery: Caption 3", type: "text", group: "Gallery" },
  { key: "gallery_image_4", label: "Gallery: Image 4", type: "image", group: "Gallery" },
  { key: "gallery_caption_4", label: "Gallery: Caption 4", type: "text", group: "Gallery" },
  { key: "gallery_image_5", label: "Gallery: Image 5", type: "image", group: "Gallery" },
  { key: "gallery_caption_5", label: "Gallery: Caption 5", type: "text", group: "Gallery" },
  { key: "gallery_image_6", label: "Gallery: Image 6", type: "image", group: "Gallery" },
  { key: "gallery_caption_6", label: "Gallery: Caption 6", type: "text", group: "Gallery" },
  { key: "gallery_heading_gap", label: "Gallery: Heading → Photos Gap", type: "spacing", group: "Gallery" },
  { key: "gallery_padding_top", label: "Gallery: Section Top Padding", type: "spacing", group: "Gallery" },
  { key: "gallery_padding_bottom", label: "Gallery: Section Bottom Padding", type: "spacing", group: "Gallery" },

  // ==================== WHATSAPP WIDGET ====================
  { key: "whatsapp_widget_label", label: "WhatsApp Widget: Label", type: "text", group: "WhatsApp Widget" },
  { key: "whatsapp_widget_message", label: "WhatsApp Widget: Pre-filled Message", type: "textarea", group: "WhatsApp Widget" },

  // ==================== FEES & PAYMENT ====================
  { key: "payment_heading", label: "Payment: Section Heading", type: "html", group: "Fees & Payment" },
  { key: "payment_bank_name", label: "Payment: Bank / Wallet Name", type: "text", group: "Fees & Payment" },
  { key: "payment_account_number", label: "Payment: Account Number", type: "text", group: "Fees & Payment" },
  { key: "payment_account_name", label: "Payment: Account Name", type: "text", group: "Fees & Payment" },
  { key: "payment_instructions", label: "Payment: Instructions", type: "html", group: "Fees & Payment" },
  { key: "payment_confirm_text", label: "Payment: Confirm Button Text", type: "text", group: "Fees & Payment" },

  // ==================== NAVIGATION ====================
  { key: "nav_calendar_label", label: "Navigation: Academic Calendar Label", type: "text", group: "Header & Footer" },
  { key: "nav_faq_label", label: "Navigation: FAQs Label", type: "text", group: "Header & Footer" },
  { key: "nav_gallery_label", label: "Navigation: Gallery Label", type: "text", group: "Header & Footer" },
];

/** Default values for every field (used as fallbacks and for "Reset Defaults"). */
export const CONTENT_DEFAULTS: Record<string, string> = {
  school_announcement: "Registration for the new academic year is now open.",
  hero_title: "Empowering Minds, Anchored in Faith",
  hero_tagline_arabic: "أكاديمية المصطفى لتحفيظ القرآن والدراسات الإسلامية",
  hero_subtitle: "A world-class education where tradition meets modern excellence.",
  school_name: "Al Mustafa Academy",
  established_tag: "Established in 2013",
  cta_button_text: "Join Our Community",
  nav_home_label: "Home",
  nav_welcome_label: "Welcome Message",
  nav_admissions_label: "Admissions",
  nav_curriculum_label: "Madrasah Activities",
  header_portals_label: "Portals",
  header_student_portal_label: "Student Portal",
  header_staff_portal_label: "Staff Portal",
  header_admin_portal_label: "Admin Portal",
  header_portal_access_label: "Portal Access",
  footer_copyright_suffix: "All Rights Reserved",
  mission_heading: "Our Sacred Mission",
  mission_arabic: "رسالتنا المقدسة",
  about_text: "Nurturing intellect, faith, and ethical leadership for a globalized world.",
  tradition_title: "Tradition",
  tradition_text: "Rooted in Islamic scholarship, ethics, and heritage.",
  excellence_title: "Excellence",
  excellence_text: "Rigorous schooling in Islamic Sciences, languages, and critical thinking.",
  footer_tagline: "Nurturing Souls, Educating Minds",
  footer_text: "Al Mustafa Academy. Where the Qur'an and Sunnah Shape Character and Excellence since 2013.",
  footer_school_name_ar: "مدرسة المصطفى",
  footer_arabic_tagline: "جسر بين التقاليد والتميز — تنمية الأرواح وتعليم العقول",
  header_tagline: "Where the Qur'an and Sunnah Shape Character and Excellence",
  color_primary: "#0B6E4F",
  color_primary_hover: "#085c41",
  color_secondary: "#D4AF37",
  color_secondary_hover: "#c4a026",
  color_secondary_fixed: "#f7d44a",
  color_secondary_container: "#f5e6b8",
  // Typography defaults
  font_heading: "Playfair Display, Georgia, serif",
  font_body: "Inter, system-ui, sans-serif",
  font_arabic: "Traditional Arabic, Arial, sans-serif",
  heading_size_h1: "48",
  heading_size_h2: "36",
  heading_size_h3: "24",
  body_text_size: "16",
  line_height_body: "1.6",
  letter_spacing_headings: "-0.025",
  text_align_default: "left",
  // Section Spacing defaults (in px) — Home Page
  home_hero_bottom_spacing: "0",
  home_mission_heading_gap: "64",
  home_cards_gap: "24",
  home_mission_padding_top: "80",
  home_mission_padding_bottom: "64",
  // Admissions Page spacing
  admissions_hero_bottom_spacing: "0",
  admissions_process_heading_gap: "64",
  admissions_process_padding_top: "96",
  admissions_process_padding_bottom: "96",
  admissions_docs_padding_top: "96",
  admissions_docs_padding_bottom: "96",
  admissions_form_heading_gap: "32",
  admissions_form_padding_top: "96",
  admissions_form_padding_bottom: "96",
  // Madrasah Activities Page spacing
  madrasah_hero_bottom_spacing: "0",
  madrasah_intro_heading_gap: "16",
  madrasah_intro_padding_top: "96",
  madrasah_intro_padding_bottom: "96",
  madrasah_timeline_heading_gap: "64",
  madrasah_timeline_padding_top: "96",
  madrasah_timeline_padding_bottom: "96",
  madrasah_weekly_heading_gap: "64",
  madrasah_weekly_padding_top: "96",
  madrasah_weekly_padding_bottom: "96",
  madrasah_announcements_heading_gap: "16",
  madrasah_announcements_padding_top: "96",
  madrasah_announcements_padding_bottom: "96",
  madrasah_extra_heading_gap: "24",
  madrasah_extra_padding_top: "96",
  madrasah_extra_padding_bottom: "96",
  // Images
  hero_image_url: "/uploads/logo_1785834148413.jpeg",
  logo_url: "/uploads/logo_1785834148413.jpeg",
  contact_phone: "08037525855",
  contact_email: "almustafaacademyilorin@gmail.com",
  school_address: "25, Sabo-Line Road, Opposite Saw-Mill, Ilorin, Nigeria",

  // ---- Admissions page defaults ----
  admissions_hero_image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDiLF0OV1eAJBmRqraaX91F62t-nsbNN_1DroIoPosFZJBZ4DbrhERnhS77WqaH_EjPmip4AXhrsihf7ytDwKQJAPisUl-P5Vjp61suhQF4raXRfn7yX6WhAKsftVKu5v95iCcYRO5imHE28s4JS9Qb0Y6gSx4OX2yTj9xdQ-ucpnHSl9uBTsoIWG3fa1nfJ1I0DrDEBxTNsNN5oxR7UdCdq37Dj8fFrObtHA_JI8HdIMoGrR1963nnJ0FRqEVsCJlVCfV-9caKy0s",
  admissions_hero_title: "Start Your Journey of Excellence",
  admissions_hero_subtitle: "Join Al Mustafa Academy, where we bridge sacred tradition with modern academic rigor to nurture the leaders of tomorrow.",
  admissions_apply_button_text: "Apply / Send Inquiry",
  admissions_process_heading: "Admissions Process",
  admissions_step_1_title: "Inquiry",
  admissions_step_1_desc: "Submit an online inquiry to receive our prospectus and schedule a campus tour.",
  admissions_step_2_title: "Application",
  admissions_step_2_desc: "Complete the online application form and upload all required documentation.",
  admissions_step_3_title: "Assessment",
  admissions_step_3_desc: "Students undergo academic assessments and a personal interview with our faculty.",
  admissions_step_4_title: "Admission",
  admissions_step_4_desc: "Successful applicants receive an offer letter and instructions for enrollment.",
  admissions_documents_heading: "Required Documents",
  admissions_documents_html:
    "<ul style=\"list-style:none;padding:0;margin:0;\">\n" +
    "  <li style=\"margin-bottom:14px;font-size:14px;color:#1C1C1C;font-weight:500;\"><span style=\"color:#D4AF37;margin-right:8px;\">★</span> Official Birth Certificate (Original &amp; Copy)</li>\n" +
    "  <li style=\"margin-bottom:14px;font-size:14px;color:#1C1C1C;font-weight:500;\"><span style=\"color:#D4AF37;margin-right:8px;\">★</span> Previous 2 years of Academic Records/Transcripts</li>\n" +
    "  <li style=\"margin-bottom:14px;font-size:14px;color:#1C1C1C;font-weight:500;\"><span style=\"color:#D4AF37;margin-right:8px;\">★</span> Character Reference from Previous School</li>\n" +
    "  <li style=\"margin-bottom:14px;font-size:14px;color:#1C1C1C;font-weight:500;\"><span style=\"color:#D4AF37;margin-right:8px;\">★</span> Up-to-date Immunization &amp; Medical Records</li>\n" +
    "  <li style=\"font-size:14px;color:#1C1C1C;font-weight:500;\"><span style=\"color:#D4AF37;margin-right:8px;\">★</span> 4 Passport-sized Photographs of the Student</li>\n" +
    "</ul>",
  admissions_fees_heading: "Tuition &amp; Fees",
  admissions_fees_html:
    "<p style=\"font-size:14px;color:#5C5C5C;line-height:1.7;margin-bottom:22px;\">We offer competitive tuition structures and flexible payment plans to support our families. Scholarship opportunities are available for exceptional candidates.</p>\n" +
    "<div style=\"font-family:inherit;\">\n" +"    <div style=\"display:flex;justify-content:space-between;border-bottom:1px solid #E4E2DA;padding:10px 0;\"><span style=\"font-weight:600;font-size:14px;color:#1C1C1C;\">Application Fee</span><span style=\"font-weight:700;font-size:14px;color:#D4AF37;\">₦1,000</span></div>\n" +
    "  <div style=\"display:flex;justify-content:space-between;border-bottom:1px solid #E4E2DA;padding:10px 0;\"><span style=\"font-weight:600;font-size:14px;color:#1C1C1C;\">Enrollment Fee</span><span style=\"font-weight:700;font-size:14px;color:#D4AF37;\">₦7,000</span></div>\n" +
    "</div>",
  admissions_contact_heading: "Have Questions?",
  admissions_contact_text:
    "Our admissions office is here to guide you through every step of this journey. Fill out our contact inquiry form, and an institutional representative will follow up with you within 24 hours.",
  admissions_contact_phone: "+2348037525855",
  admissions_contact_email: "almustafaacademyilorin@gmail.com",
  admissions_form_full_name_label: "Full Name",
  admissions_form_full_name_placeholder: "Parent or Guardian",
  admissions_form_email_label: "Email Address",
  admissions_form_email_placeholder: "example@email.com",
  admissions_form_grade_label: "Grade of Interest",
  admissions_form_grade_options: "Primary (Grades 1-5)\nMiddle School (Grades 6-8)\nHigh School (Grades 9-12)",
  admissions_whatsapp_number: "2348037525585",
  admissions_form_message_label: "Message",
  admissions_form_message_placeholder: "How can we help you?",
  admissions_form_submit_text: "Send Inquiry",
  admissions_form_sending_text: "Sending Inquiry...",
  admissions_phone_label: "Phone",
  admissions_email_label: "Email",
  admissions_success_heading: "Inquiry Submitted!",
  admissions_success_message: "Peace be upon you, {name}. Your inquiry has been processed successfully. Our school admissions secretary will reach out to {email} within 24 hours.",
  admissions_success_button: "Submit Another Inquiry",
  admissions_fee_download_text: "Download Full Fee Schedule",

  // ---- Madrasah Activities page defaults ----
  madrasah_hero_image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDlagLGnpncRI0maRkiqnopDty3gteLvuai-wV8E-IdFH1qKO6nwv51QlF-8-KFHN43dEpce9QIZPnppXTpWzNIL6yqXqlk8kTx4UpimsnfI_N38_sUyv3pPJYCOlc_vyoTmV9RgI70aU56gYHx_yOBrmTC10bJx7g38caiXAv41rgbYJv25Ao6YVwm32Qo1clmSApOSFqquCbNriHHRKH4cF2kKZf6Wabnxp-_upZu5hsy5bS2Ew3IEoIfDCtYDto892hjQckO1F4",
  madrasah_hero_arabic: "برنامج اليوم الدراسي",
  madrasah_hero_title: "A Day at the Madrasah",
  madrasah_hero_subtitle:
    "From the morning assembly to the final activity, every moment of our school day is arranged with purpose — nurturing faith, discipline, knowledge, and brotherhood.",
  madrasah_intro_arabic: "نظرة على يومنا الدراسي",
  madrasah_intro_heading: "A Day Structured Around Growth",
  madrasah_intro_text:
    "Every day at Al Mustafa Academy follows a carefully arranged routine that balances spiritual development, Quranic memorization, and formal lessons — so each student grows in knowledge, character, and connection to their faith.",
  madrasah_schedule_image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDlagLGnpncRI0maRkiqnopDty3gteLvuai-wV8E-IdFH1qKO6nwv51QlF-8-KFHN43dEpce9QIZPnppXTpWzNIL6yqXqlk8kTx4UpimsnfI_N38_sUyv3pPJYCOlc_vyoTmV9RgI70aU56gYHx_yOBrmTC10bJx7g38caiXAv41rgbYJv25Ao6YVwm32Qo1clmSApOSFqquCbNriHHRKH4cF2kKZf6Wabnxp-_upZu5hsy5bS2Ew3IEoIfDCtYDto892hjQckO1F4",
  madrasah_timeline_arabic: "جدول اليوم الدراسي",
  madrasah_timeline_heading: "Our Daily Schedule",
  madrasah_timeline_subtitle: "Each step of the day is timed with intention — from assembly to Salah.",
  madrasah_schedule_1_time: "09:00 AM",
  madrasah_schedule_1_title: "Morning Assembly",
  madrasah_schedule_1_desc:
    "The school day opens with our morning assembly, which starts at 09:00 AM sharp. All students and staff gather together to begin the day with discipline, supplication, and a shared sense of purpose.",
  madrasah_schedule_2_time: "09:00 – 09:30 AM",
  madrasah_schedule_2_title: "Kalimatu Sabahi",
  madrasah_schedule_2_desc:
    "Immediately after the assembly we do the Kalimatu Sabahi (كلمة الصباح) until 09:30 AM — the morning word — where motivation and guidance for the day are shared with all students before lessons begin.",
  madrasah_schedule_3_time: "09:30 – 10:30 AM",
  madrasah_schedule_3_title: "Memorization & Muraaja'ah",
  madrasah_schedule_3_desc:
    "Our memorization and Muraaja'ah (revision) starts from 09:30 AM to 10:30 AM — a dedicated hour of Quranic memorization (Hifdh) and revision so that every student strengthens new memorization and keeps earlier portions firm.",
  madrasah_schedule_4_time: "10:30 – 11:30 AM",
  madrasah_schedule_4_title: "Normal Classes",
  madrasah_schedule_4_desc:
    "Our normal classes begin from 10:30 AM to 11:30 AM as students engage with their subjects in focused, structured lessons with their teachers.",
  madrasah_schedule_5_time: "11:30 AM – 12:00 PM",
  madrasah_schedule_5_title: "Break Time",
  madrasah_schedule_5_desc:
    "Our break time lasts for 30 minutes, from 11:30 AM to 12:00 PM — a refreshing pause that gives the students time to rest, play, and recharge for the afternoon ahead.",
  madrasah_schedule_6_time: "12:00 – 1:30 PM",
  madrasah_schedule_6_title: "Classes Continue",
  madrasah_schedule_6_desc:
    "By 12:00 PM until 1:30 PM the classes continue, keeping the momentum of learning going steadily through the afternoon.",
  madrasah_schedule_7_time: "1:30 PM",
  madrasah_schedule_7_title: "Call for Salah",
  madrasah_schedule_7_desc:
    "At 1:30 PM we call for Salah — the whole madrasah pauses the day to gather for prayer and reconnect with Allah.",
  madrasah_schedule_8_time: "2:00 – 3:30 PM",
  madrasah_schedule_8_title: "Extra Lessons & Activities",
  madrasah_schedule_8_desc:
    "Sometimes after the prayer and the day's activities, some students are asked to wait behind for extra lessons and other activities from 2:00 PM to 3:30 PM.",
  // Weekend schedule Arabic labels
  madrasah_schedule_1_arabic: "الاصطفاف الصباحي",
  madrasah_schedule_2_arabic: "كلمة الصباح",
  madrasah_schedule_3_arabic: "التحفيظ والمراجعة",
  madrasah_schedule_4_arabic: "الدروس العادية",
  madrasah_schedule_5_arabic: "الاستراحة",
  madrasah_schedule_6_arabic: "استمرار الدروس",
  madrasah_schedule_7_arabic: "نداء الصلاة",
  madrasah_schedule_8_arabic: "دروس وأنشطة إضافية",
  madrasah_weekend_label: "Saturday & Sunday",
  madrasah_after_salah_badge: "After Salah",
  // Weekly Schedule
  madrasah_weekly_arabic_header: "البرنامج الأسبوعي من الاثنين إلى الأربعاء",
  madrasah_weekly_heading: "Weekly Afternoon Program",
  madrasah_weekly_subtitle: "Monday to Wednesday — 4:00 PM to 6:00 PM (Asr prayer inclusive)",
  // Monday
  madrasah_monday_name: "Monday",
  madrasah_monday_arabic: "الإثنين",
  madrasah_monday_time: "4:00 PM – 6:00 PM",
  madrasah_monday_act1_time: "4:00 PM",
  madrasah_monday_act1_title: "Asr Prayer",
  madrasah_monday_act1_desc: "Students gather for the congregational Asr prayer before commencing their afternoon activities.",
  madrasah_monday_act2_time: "4:15 PM – 6:00 PM",
  madrasah_monday_act2_title: "Muraja'ah & Hifdh",
  madrasah_monday_act2_desc: "After Asr prayer, students engage in Muraja'ah (Quran Revision) and Hifdh (Quran Memorization) until closing time at 6:00 PM.",
  // Tuesday
  madrasah_tuesday_name: "Tuesday",
  madrasah_tuesday_arabic: "الثلاثاء",
  madrasah_tuesday_time: "4:00 PM – 6:00 PM",
  madrasah_tuesday_act1_time: "4:00 PM",
  madrasah_tuesday_act1_title: "Asr Prayer",
  madrasah_tuesday_act1_desc: "Students gather for the congregational Asr prayer before commencing their afternoon activities.",
  madrasah_tuesday_act2_time: "4:15 PM – 5:05 PM",
  madrasah_tuesday_act2_title: "Hifdh (Quran Memorization)",
  madrasah_tuesday_act2_desc: "After Asr prayer, students begin their Hifdh session until 5:05 PM.",
  madrasah_tuesday_act3_time: "5:05 PM – 5:45 PM",
  madrasah_tuesday_act3_title: "Audio Recitation Listening",
  madrasah_tuesday_act3_desc: "Students listen to one of the best reciters — Shaykh Husary — to master their tone and guide their recitation properly.",
  madrasah_tuesday_act4_time: "5:45 PM – 6:00 PM",
  madrasah_tuesday_act4_title: "Mutuun Memorization",
  madrasah_tuesday_act4_desc: "The final 15 minutes are dedicated to memorization of Mutuun (Arabic poems) until closing time.",
  // Wednesday
  madrasah_wednesday_name: "Wednesday",
  madrasah_wednesday_arabic: "الأربعاء",
  madrasah_wednesday_time: "4:00 PM – 6:00 PM",
  madrasah_wednesday_act1_time: "4:00 PM",
  madrasah_wednesday_act1_title: "Asr Prayer",
  madrasah_wednesday_act1_desc: "Students gather for the congregational Asr prayer before commencing their afternoon activities.",
  madrasah_wednesday_act2_time: "4:15 PM – 5:00 PM",
  madrasah_wednesday_act2_title: "Hifdh (Quran Memorization)",
  madrasah_wednesday_act2_desc: "After Asr prayer, students begin their Hifdh session until 5:00 PM.",
  madrasah_wednesday_act3_time: "5:00 PM – 5:45 PM",
  madrasah_wednesday_act3_title: "Muraja'ah (Recitation & Correction)",
  madrasah_wednesday_act3_desc: "Every student recites the portion given to them, and teachers correct any mistakes during this period.",
  madrasah_wednesday_act4_time: "5:45 PM – 6:00 PM",
  madrasah_wednesday_act4_title: "Mutuun Memorization",
  madrasah_wednesday_act4_desc: "The final 15 minutes are dedicated to memorization of Mutuun (Arabic poems) until closing time.",
  // Mutuun note
  madrasah_mutuun_heading: "Mutuun (Arabic Poems)",
  madrasah_mutuun_text: "On both Tuesday and Wednesday, the final 15 minutes (5:45 PM – 6:00 PM) are dedicated to memorizing Mutuun — traditional Arabic poems that reinforce language skills, poetic expression, and cultural heritage.",
  madrasah_announcements_heading: "Student Address & Announcements",
  madrasah_announcements_text:
    "A cherished part of our day — sometimes after the prayer and the activities, a student is invited to come out and address his or her fellow students, building confidence and leadership. At other times, our staff pass on information that is crucial to them, keeping everyone informed and connected.",
  madrasah_announcements_note:
    "This little activity strengthens public speaking, self-confidence, and a strong sense of community among the students.",
  madrasah_announcements_image: "https://lh3.googleusercontent.com/aida-public/AB6AXuChYsP3-TYjRTvlweFM8GeXEwaVzYYCRhz46RXIbMMUD7bbshymCw-BkqHA6t5e88ug0R137Un_H3vUu_msIWFac5QPhaFYNsnTmM68KiT8MnQSllR2736Ts5Z4sQLOibCx_oW-6lMNPMW9edXXzBPKMRYrsbijy1e5ltreZb31wPeTSYfO48ALOPQbKqPlKG4PVlP_EHd_-6w5MChTkRQs1QOeKpOVTCuZbyb5PerdlDG8Sq0nYDvNMTARuZCCibRp6loeky-IVh0",
  madrasah_extra_heading: "Extra Lessons & Activities",
  madrasah_extra_text:
    "Learning does not end when the main classes do. From 2:00 PM to 3:30 PM, some students stay behind for extra lessons and other activities — receiving the additional support and enrichment they need to truly excel.",
  madrasah_extra_image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCxfijj9ohXFXMZVZUkqyTBQB3ImkiFqpltJjydzSOwCdWxMCOpjETAeJ0I3Dl2QNAr5nzkU5DrMx2jcG6Ji1g7P0jHDnuRCbciGMcW0jtmiPJmt1qfxOrt0m1FTadmggzX59fBDY9T0NuO2SM39if0PR_1nPijlwHzQvnfZ0LWAPdn-c_YaEuaHJQZUhSfWOw-kIYId9vej-znTy6og9AsZyoDgUQoDkuYqH3CTqZ1bBs7nZISweD_oHu-n1bEABjP3fhwUv1R4sM",

  // ---- Welcome message (Director / Principal) ----
  welcome_heading: "Welcome Message from the Director / Principal",
  welcome_bismillah: "بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ",
  welcome_salutation: "Assalāmu ‘Alaykum Wa Raḥmatullāhi Wa Barakātuh,",
  welcome_body:
    "It is my utmost pleasure and privilege to welcome you to <strong>Al Mustafa Academy</strong>, a sanctuary of knowledge located in the heart of Ilorin, Kwara State. Since our establishment in 2013, our steadfast commitment has been to nurture a generation of God-conscious, academically proficient, and morally upright leaders who exemplify the teachings of the Qur’an and Sunnah in their daily lives.<br/><br/>At Al Mustafa Academy, we believe that true education reaches far beyond textbook knowledge—it must shape character, refine manners (<em>Adab</em>), and inspire purposeful living. By seamlessly balancing rigorous academic standards with comprehensive Qur’an memorization (<em>Hifdh</em>), <em>Tajwīd</em>, Arabic studies, and Islamic etiquette (<em>Akhlaaq</em>), we prepare our students to excel in both contemporary society and the Hereafter.<br/><br/>Whether you are a prospective parent seeking a nurturing environment for your child’s spiritual and intellectual growth, or a returning family continuing this noble journey with us, we invite you to explore our vibrant community. Together, let us build a strong foundation for our children’s future under the guidance of divine wisdom.",
  welcome_name: "Dr. Ibrahim Mustapha",
  welcome_title: "Director of Studies, Al Mustafa Academy",
  welcome_photo: "",
  welcome_heading_gap: "40",
  welcome_padding_top: "80",
  welcome_padding_bottom: "64",

  // ---- Academic calendar ----
  calendar_heading: "MADRASAH ACADEMIC CALENDAR FOR 1448 AH (2026/2027 SESSION)",
  calendar_subtitle: "",
  calendar_term_label: "1st Term",
  calendar_term_dates: "11th July – 25th October, 2026",
  calendar_event_1_title: "Musābaqotu’l-Qur’ān (Qur’an Competition)",
  calendar_event_1_date: "10th & 11th October, 2026",
  calendar_event_2_title: "1st Term Examination",
  calendar_event_2_date: "17th – 25th October, 2026",
  calendar_event_3_title: "",
  calendar_event_3_date: "",
  calendar_note:
    "All parents are kindly advised to take note of these important dates. Jazākumullāhu Khayran.",
  calendar_heading_gap: "40",
  calendar_padding_top: "96",
  calendar_padding_bottom: "96",

  // ---- FAQs ----
  faq_heading: "Frequently Asked Questions",
  faq_subtitle: "Answers to the questions families ask us most.",
  faq_q1: "What is the balance between Western and Islamic studies?",
  faq_a1:
    "Al Mustafa Academy delivers a dual curriculum: a rigorous Western academic programme (English, Mathematics, Sciences, and more) alongside comprehensive Islamic studies — Qur’an memorisation (Hifdh), Tajwīd, Arabic, Fiqh, and Islamic etiquette (Akhlaaq). Students graduate strong in both worlds.",
  faq_q2: "Do you provide transportation for students?",
  faq_a2:
    "Yes — we operate school transportation on select routes within Ilorin. Please contact our admissions office or reach us on WhatsApp for the current routes and pick-up schedule.",
  faq_q3: "Is there a feeding or meal programme?",
  faq_a3:
    "We run a supervised feeding programme that provides nutritious meals during the school day. Details, including menus and fees, are shared with parents each term.",
  faq_q4: "How can I pay application and school fees?",
  faq_a4:
    "Simply transfer the exact amount to the account shown in our Fees section (Palmpay — 8037525855, Ibrahim Olamilekan Mustapha), then tap the confirm button to notify us on WhatsApp with your transfer receipt.",
  faq_q5: "How do I check my child’s results?",
  faq_a5:
    "Parents and students can check termly results through the Student Portal — log in with the student’s surname and password (issued by the school). Report cards are also available as PDF.",
  faq_q6: "When does the academic year begin?",
  faq_a6:
    "Our academic calendar runs by Islamic (Hijri) and civil dates each session — see the Academic Calendar section for term dates, examinations, and important events such as the Qur’an competition.",
  faq_heading_gap: "40",
  faq_padding_top: "96",
  faq_padding_bottom: "96",

  // ---- Gallery ----
  gallery_heading: "Life at Al Mustafa Academy",
  gallery_subtitle: "A glimpse into our classrooms, labs, and Madrasah activities.",
  gallery_image_1: "https://lh3.googleusercontent.com/aida-public/AB6AXuDlagLGnpncRI0maRkiqnopDty3gteLvuai-wV8E-IdFH1qKO6nwv51QlF-8-KFHN43dEpce9QIZPnppXTpWzNIL6yqXqlk8kTx4UpimsnfI_N38_sUyv3pPJYCOlc_vyoTmV9RgI70aU56gYHx_yOBrmTC10bJx7g38caiXAv41rgbYJv25Ao6YVwm32Qo1clmSApOSFqquCbNriHHRKH4cF2kKZf6Wabnxp-_upZu5hsy5bS2Ew3IEoIfDCtYDto892hjQckO1F4",
  gallery_caption_1: "A day at the Madrasah",
  gallery_image_2: "https://lh3.googleusercontent.com/aida-public/AB6AXuChYsP3-TYjRTvlweFM8GeXEwaVzYYCRhz46RXIbMMUD7bbshymCw-BkqHA6t5e88ug0R137Un_H3vUu_msIWFac5QPhaFYNsnTmM68KiT8MnQSllR2736Ts5Z4sQLOibCx_oW-6lMNPMW9edXXzBPKMRYrsbijy1e5ltreZb31wPeTSYfO48ALOPQbKqPlKG4PVlP_EHd_-6w5MChTkRQs1QOeKpOVTCuZbyb5PerdlDG8Sq0nYDvNMTARuZCCibRp6loeky-IVh0",
  gallery_caption_2: "Student address & announcements",
  gallery_image_3: "https://lh3.googleusercontent.com/aida-public/AB6AXuCxfijj9ohXFXMZVZUkqyTBQB3ImkiFqpltJjydzSOwCdWxMCOpjETAeJ0I3Dl2QNAr5nzkU5DrMx2jcG6Ji1g7P0jHDnuRCbciGMcW0jtmiPJmt1qfxOrt0m1FTadmggzX59fBDY9T0NuO2SM39if0PR_1nPijlwHzQvnfZ0LWAPdn-c_YaEuaHJQZUhSfWOw-kIYId9vej-znTy6og9AsZyoDgUQoDkuYqH3CTqZ1bBs7nZISweD_oHu-n1bEABjP3fhwUv1R4sM",
  gallery_caption_3: "Extra lessons & activities",
  gallery_image_4: "",
  gallery_caption_4: "",
  gallery_image_5: "",
  gallery_caption_5: "",
  gallery_image_6: "",
  gallery_caption_6: "",
  gallery_heading_gap: "40",
  gallery_padding_top: "96",
  gallery_padding_bottom: "96",

  // ---- WhatsApp widget ----
  whatsapp_widget_label: "Chat with us on WhatsApp",
  whatsapp_widget_message: "Assalamu Alaikum! I would like to ask about Al Mustafa Academy.",

  // ---- Fees & payment ----
  payment_heading: "Pay Application & School Fees",
  payment_bank_name: "Palmpay",
  payment_account_number: "8037525855",
  payment_account_name: "Ibrahim Olamilekan Mustapha",
  payment_instructions:
    "Transfer the exact fee amount to the account below using USSD, bank transfer, or the Palmpay app. Then tap the button below to confirm your payment on WhatsApp — kindly attach your transfer receipt.",
  payment_confirm_text: "I Have Paid — Confirm via WhatsApp",

  // ---- Navigation labels ----
  nav_calendar_label: "Academic Calendar",
  nav_faq_label: "FAQs",
  nav_gallery_label: "Gallery",
};

/** Maps content keys to the Tailwind v4 CSS custom properties they drive. */
const COLOR_MAP: Record<string, string> = {
  color_primary: "--color-primary",
  color_primary_hover: "--color-primary-hover",
  color_secondary: "--color-secondary",
  color_secondary_hover: "--color-secondary-hover",
  color_secondary_fixed: "--color-secondary-fixed",
  color_secondary_container: "--color-secondary-container",
};

/** Maps content keys to CSS custom properties for typography. */
const TYPOGRAPHY_MAP: Record<string, string> = {
  font_heading: "--font-serif",
  font_body: "--font-sans",
  heading_size_h1: "--heading-size-h1",
  heading_size_h2: "--heading-size-h2",
  heading_size_h3: "--heading-size-h3",
  body_text_size: "--body-text-size",
  line_height_body: "--line-height-body",
  letter_spacing_headings: "--letter-spacing-headings",
};

/** Applies saved theme colors to the document root so the whole site updates live. */
export function applyThemeColors(content: Record<string, string>) {
  const root = document.documentElement;
  for (const [key, cssVar] of Object.entries(COLOR_MAP)) {
    const value = (content[key] || CONTENT_DEFAULTS[key] || "").trim();
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
      root.style.setProperty(cssVar, value);
    }
  }
}

/** Applies typography settings to the document root. */
export function applyTypography(content: Record<string, string>) {
  const root = document.documentElement;
  for (const [key, cssVar] of Object.entries(TYPOGRAPHY_MAP)) {
    const value = (content[key] || CONTENT_DEFAULTS[key] || "").trim();
    if (value) {
      root.style.setProperty(cssVar, value);
    }
  }
}

/**
 * Converts Google Drive "uc?export=view" links into a reliably-served
 * thumbnail URL so images actually display in the browser.
 */
export function normalizeImageUrl(url: string | undefined | null): string {
  if (!url) return "";
  const idMatch = url.match(/drive\.google\.com\/(?:uc\?export=view&id=|file\/d\/)([\w-]+)/);
  if (idMatch) {
    return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w1400`;
  }
  return url;
}

/**
 * Fetch public site content once and keep it in sync.
 * Also refreshes when the admin saves content ("content-saved" event).
 *
 * Initial state is hydrated synchronously from the local snapshot (if any), so
 * the very first React render already shows the real site content — the
 * hardcoded fallbacks are never painted on repeat visits. Theme, typography and
 * Style-Editor custom styles are applied the instant fresh content arrives
 * (no delayed pop-in), and the snapshot is rewritten so every future visit is
 * equally instant.
 */
export function useSiteContent(): Record<string, string> {
  const [content, setContent] = useState<Record<string, string>>(
    () => readSiteSnapshot()?.content ?? {}
  );

  useEffect(() => {
    let active = true;
    // If we hydrated from a local snapshot, the real UI is already painted on
    // the first React render — open the gate now and refresh content in the
    // background, so repeat visits don't wait on the network.
    if (readSiteSnapshot()) revealApp();
    const applyAll = (c: Record<string, string>) => {
      applyThemeColors(c);
      applyTypography(c);
      // Apply Style-Editor rules as soon as the DOM exists for them — the
      // bootstrap already injected them as CSS pre-paint; this re-applies the
      // exact same values so saved edits survive any remount.
      applyCustomStyles(c.custom_styles);
      setContent(c);
      writeSiteSnapshot(c);
      revealApp();
    };
    const load = () => {
      // cache: "no-store" — never let the browser HTTP cache serve stale content
      fetch("/api/content", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error("bad status"))))
        .then((data) => {
          if (!active) return;
          applyAll(data.content || {});
        })
        .catch(() => {
          // Offline / API down: never leave the page hidden or blank — the
          // snapshot (or defaults) already painted, so just lift the gate.
          if (active) revealApp();
        });
    };
    load();
    window.addEventListener("content-saved", load);
    // Also listen for storage events (cross-tab sync)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "content-saved") load();
    };
    window.addEventListener("storage", handleStorage);
    // Auto-refresh every 45s so an OPEN app (phone/PC) picks up edits made from
    // anywhere else — the site content always comes fresh from the server.
    const poll = setInterval(load, 45_000);
    return () => {
      active = false;
      window.removeEventListener("content-saved", load);
      window.removeEventListener("storage", handleStorage);
      clearInterval(poll);
    };
  }, []);

  return content;
}
