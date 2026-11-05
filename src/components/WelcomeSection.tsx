import { motion } from "motion/react";
import { Quote } from "lucide-react";
import { useSiteContent, normalizeImageUrl } from "../lib/siteContent";
import EditableImage from "./EditableImage";
import EditableText from "./EditableText";

/**
 * "Welcome Message from the Director / Principal" — a trust-building section
 * placed between Home and Admissions. Every text field is editable from the
 * admin Content tab (and inline via Edit Mode), including the photo.
 */
export default function WelcomeSection() {
  const siteContent = useSiteContent();
  const photo = normalizeImageUrl(siteContent.welcome_photo || "");
  const isEmpty = isEmptyPhotoUrl(siteContent.welcome_photo || "");
  const renderHtml = (value: string | undefined, fallback: string) => ({
    __html: value && value.trim() ? value : fallback,
  });

  const welcomeHeadingGap = parseInt(siteContent.welcome_heading_gap || "40");
  const welcomePaddingTop = parseInt(siteContent.welcome_padding_top || "80");
  const welcomePaddingBottom = parseInt(siteContent.welcome_padding_bottom || "64");

  const name = siteContent.welcome_name || "Dr. Ibrahim Mustapha";
  const title = siteContent.welcome_title || "Director of Studies, Al Mustafa Academy";
  // Monogram used when no photo has been uploaded yet
  const initials = name
    .replace(/^(Dr\.|Dr|Mr\.|Mrs\.|Ms\.)\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <motion.section
      id="welcome-section"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6 }}
      style={{ paddingTop: `${welcomePaddingTop}px`, paddingBottom: `${welcomePaddingBottom}px` }}
      className="scroll-mt-16 bg-surface/70 border-y border-primary/5"
    >
      <div className="max-w-4xl mx-auto px-6">
        <div className="flex items-center justify-center gap-3 mb-4">
          <span className="w-10 h-px bg-secondary" />
          <span className="text-secondary">
            <Quote className="w-5 h-5" />
          </span>
          <span className="w-10 h-px bg-secondary" />
        </div>

        <h2 style={{ marginBottom: `${welcomeHeadingGap}px` }} className="font-serif text-2xl sm:text-3xl text-primary font-bold text-center">
          <EditableText
            contentKey="welcome_heading"
            value={siteContent.welcome_heading || ""}
            fallback="Welcome Message from the Director / Principal"
            label="Welcome: Section Heading"
          >
            <span
              dangerouslySetInnerHTML={renderHtml(
                siteContent.welcome_heading,
                "Welcome Message from the Director / Principal"
              )}
            />
          </EditableText>
        </h2>

        <div className="bg-white rounded-2xl border border-secondary/20 shadow-sm p-8 sm:p-10 relative overflow-hidden">
          <Quote className="absolute -top-2 -right-2 w-24 h-24 text-secondary/10" aria-hidden="true" />

          <p className="text-center font-serif text-secondary font-semibold text-sm mb-2">
            <EditableText
              contentKey="welcome_bismillah"
              value={siteContent.welcome_bismillah || ""}
              fallback="بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ"
              label="Welcome: Bismillah"
              plain
            >
              <span>{siteContent.welcome_bismillah || "بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ"}</span>
            </EditableText>
          </p>
          <p className="text-center text-on-surface-variant italic text-sm mb-7">
            <EditableText
              contentKey="welcome_salutation"
              value={siteContent.welcome_salutation || ""}
              fallback="Assalāmu ‘Alaykum Wa Raḥmatullāhi Wa Barakātuh,"
              label="Welcome: Salutation"
              plain
            >
              <span>{siteContent.welcome_salutation || "Assalāmu ‘Alaykum Wa Raḥmatullāhi Wa Barakātuh,"}</span>
            </EditableText>
          </p>

          <div className="rich-html text-on-surface leading-relaxed">
            <EditableText
              contentKey="welcome_body"
              value={siteContent.welcome_body || ""}
              fallback=""
              label="Welcome: Message Body"
            >
              <span
                dangerouslySetInnerHTML={renderHtml(
                  siteContent.welcome_body,
                  ""
                )}
              />
            </EditableText>
          </div>

          <div className="mt-9 flex flex-col sm:flex-row items-center gap-5 border-t border-primary/10 pt-7">
          {/* Frame always shows. With no live photo it shows a clean empty
              frame (dashed border) — admins in Edit Mode can swap anything in,
              including emptying the frame again. */}
          {photo ? (
            <EditableImage
              contentKey="welcome_photo"
              label="Welcome: Director Photo"
              src={photo}
              alt="Director of Studies, Al Mustafa Academy"
              className="relative shrink-0"
            >
              <img
                src={photo}
                alt="Director of Studies, Al Mustafa Academy"
                className="w-20 h-20 rounded-full object-cover border-2 border-secondary shadow-md"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </EditableImage>
          ) : (
            <EditableImage
              contentKey="welcome_photo"
              label="Welcome: Director Photo"
              src=""
              alt="Director of Studies, Al Mustafa Academy"
              className="relative shrink-0"
            >
              <div className="w-20 h-20 rounded-full border-2 border-dashed border-primary/40 bg-white flex items-center justify-center text-primary font-serif font-bold text-xl">
                {initials || "IM"}
              </div>
            </EditableImage>
          )}
            <div className="text-center sm:text-left">
              <p className="font-serif text-lg font-bold text-primary">
                <EditableText
                  contentKey="welcome_name"
                  value={siteContent.welcome_name || ""}
                  fallback="Dr. Ibrahim Mustapha"
                  label="Welcome: Signatory Name"
                  plain
                >
                  <span>{name}</span>
                </EditableText>
              </p>
              {isEmpty && editModeOn && (
                <div className="flex-1 min-w-[160px] sm:min-w-0">
                  <EditableImage
                    contentKey="welcome_photo"
                    label="Welcome: Director Photo"
                    src=""
                    alt="Director of Studies, Al Mustafa Academy"
                    className="relative shrink-0"
                  >
                    <div className="w-20 h-20 rounded-full border-2 border-dashed border-red-400 bg-red-50 flex flex-col items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-500 mb-1">
                        <X className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-semibold text-red-400">Remove photo</span>
                    </div>
                  </EditableImage>
                </div>
              )}
              <p className="text-sm text-on-surface-variant mt-0.5">
                <EditableText
                  contentKey="welcome_title"
                  value={siteContent.welcome_title || ""}
                  fallback="Director of Studies, Al Mustafa Academy"
                  label="Welcome: Signatory Title"
                  plain
                >
                  <span>{title}</span>
                </EditableText>
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
