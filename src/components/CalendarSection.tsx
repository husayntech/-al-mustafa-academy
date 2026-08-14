import { useState } from "react";
import { motion } from "motion/react";
import { CalendarDays, BookMarked, Landmark } from "lucide-react";
import { useSiteContent } from "../lib/siteContent";
import EditableText from "./EditableText";

interface CalendarEvent {
  titleKey: string;
  dateKey: string;
  title: string;
  date: string;
}

/**
 * Academic Calendar — term dates and key events (exams, Qur'an competition…).
 * Everything is editable from the admin Content tab; empty events are hidden.
 */
export default function CalendarSection() {
  const siteContent = useSiteContent();
  const renderHtml = (value: string | undefined, fallback: string) => ({
    __html: value && value.trim() ? value : fallback,
  });

  const calendarHeadingGap = parseInt(siteContent.calendar_heading_gap || "40");
  const calendarPaddingTop = parseInt(siteContent.calendar_padding_top || "96");
  const calendarPaddingBottom = parseInt(siteContent.calendar_padding_bottom || "96");

  // Term tabs — 1st/2nd/3rd term, so parents can plan further ahead. Dates
  // left empty show "To be announced" and are editable in the admin Content tab.
  const [activeTerm, setActiveTerm] = useState(0);
  const terms: { labelKey: string; dateKey: string; label: string; dates: string }[] = [
    {
      labelKey: "calendar_term_label",
      dateKey: "calendar_term_dates",
      label: siteContent.calendar_term_label || "1st Term",
      dates: siteContent.calendar_term_dates || "",
    },
    {
      labelKey: "calendar_term_2_label",
      dateKey: "calendar_term_2_dates",
      label: siteContent.calendar_term_2_label || "2nd Term",
      dates: siteContent.calendar_term_2_dates || "",
    },
    {
      labelKey: "calendar_term_3_label",
      dateKey: "calendar_term_3_dates",
      label: siteContent.calendar_term_3_label || "3rd Term",
      dates: siteContent.calendar_term_3_dates || "",
    },
  ];
  const activeDates = terms[activeTerm];

  const events: CalendarEvent[] = [
    {
      titleKey: "calendar_event_1_title",
      dateKey: "calendar_event_1_date",
      title: siteContent.calendar_event_1_title || "",
      date: siteContent.calendar_event_1_date || "",
    },
    {
      titleKey: "calendar_event_2_title",
      dateKey: "calendar_event_2_date",
      title: siteContent.calendar_event_2_title || "",
      date: siteContent.calendar_event_2_date || "",
    },
    {
      titleKey: "calendar_event_3_title",
      dateKey: "calendar_event_3_date",
      title: siteContent.calendar_event_3_title || "",
      date: siteContent.calendar_event_3_date || "",
    },
  ].filter((e) => e.title || e.date);

  return (
    <motion.section
      id="calendar-section"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6 }}
      style={{ paddingTop: `${calendarPaddingTop}px`, paddingBottom: `${calendarPaddingBottom}px` }}
      className="scroll-mt-16 bg-background"
    >
      <div className="max-w-5xl mx-auto px-6">
        <div style={{ marginBottom: `${calendarHeadingGap}px` }} className="text-center">
          <h2 className="font-serif text-2xl sm:text-3xl text-primary font-bold tracking-wide">
            <EditableText
              contentKey="calendar_heading"
              value={siteContent.calendar_heading || ""}
              fallback="MADRASAH ACADEMIC CALENDAR"
              label="Calendar: Section Heading"
            >
              <span dangerouslySetInnerHTML={renderHtml(siteContent.calendar_heading, "MADRASAH ACADEMIC CALENDAR")} />
            </EditableText>
          </h2>
          {siteContent.calendar_subtitle && siteContent.calendar_subtitle.trim() && (
            <p className="text-secondary font-semibold text-xs sm:text-sm uppercase tracking-widest mt-2">
              <EditableText
                contentKey="calendar_subtitle"
                value={siteContent.calendar_subtitle || ""}
                fallback=""
                label="Calendar: Subtitle (Session)"
                plain
              >
                <span>{siteContent.calendar_subtitle}</span>
              </EditableText>
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {/* Term card — highlighted, with 1st/2nd/3rd term tabs */}
          <div className="bg-primary text-white rounded-2xl p-7 flex flex-col justify-center shadow-lg relative overflow-hidden">
            <div className="absolute -bottom-6 -right-6 opacity-10">
              <Landmark className="w-40 h-40" />
            </div>
            <div className="flex flex-wrap gap-2 mb-5 relative z-10">
              {terms.map((t, i) => (
                <button
                  key={t.labelKey}
                  onClick={() => setActiveTerm(i)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    i === activeTerm
                      ? "bg-secondary-fixed text-primary shadow"
                      : "bg-white/10 text-white/80 hover:bg-white/20"
                  }`}
                  aria-pressed={i === activeTerm}
                >
                  <EditableText contentKey={t.labelKey} value={siteContent[t.labelKey] || ""} fallback={t.label} label={`Calendar: ${t.label} Label`} plain>
                    <span>{siteContent[t.labelKey] || t.label}</span>
                  </EditableText>
                </button>
              ))}
            </div>
            <p className="font-serif text-2xl font-bold leading-snug relative z-10">
              <EditableText
                contentKey={activeDates.dateKey}
                value={siteContent[activeDates.dateKey] || ""}
                fallback={activeDates.dates || "To be announced"}
                label={`Calendar: ${activeDates.label} Dates`}
                plain
              >
                <span>{siteContent[activeDates.dateKey] || activeDates.dates || "To be announced"}</span>
              </EditableText>
            </p>
          </div>

          {/* Key events */}
          <div className="md:col-span-2 bg-white rounded-2xl border border-primary/10 p-7 shadow-sm">
            <h3 className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider mb-5">
              <BookMarked className="w-4 h-4 text-secondary" />
              Key Dates
            </h3>
            <div className="flex flex-col divide-y divide-primary/5">
              {events.map((ev, i) => (
                <div key={i} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-lg bg-secondary/15 text-secondary flex items-center justify-center shrink-0">
                      <CalendarDays className="w-4.5 h-4.5" />
                    </span>
                    <span className="text-sm font-semibold text-on-surface min-w-0">
                      <EditableText
                        contentKey={ev.titleKey}
                        value={siteContent[ev.titleKey] || ""}
                        fallback={ev.title}
                        label={`Calendar: ${ev.title || "Event"}`}
                        plain
                      >
                        <span>{siteContent[ev.titleKey] || ev.title}</span>
                      </EditableText>
                    </span>
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-primary shrink-0 text-right">
                    <EditableText
                      contentKey={ev.dateKey}
                      value={siteContent[ev.dateKey] || ""}
                      fallback={ev.date}
                      label="Calendar: Event Date"
                      plain
                    >
                      <span>{siteContent[ev.dateKey] || ev.date}</span>
                    </EditableText>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {siteContent.calendar_note && (
          <p className="text-center text-sm text-on-surface-variant italic mt-8 rich-html">
            <EditableText
              contentKey="calendar_note"
              value={siteContent.calendar_note || ""}
              fallback=""
              label="Calendar: Note"
            >
              <span dangerouslySetInnerHTML={renderHtml(siteContent.calendar_note, "")} />
            </EditableText>
          </p>
        )}
      </div>
    </motion.section>
  );
}
