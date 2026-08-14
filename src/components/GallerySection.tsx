import { motion } from "motion/react";
import { Images } from "lucide-react";
import { useSiteContent, normalizeImageUrl } from "../lib/siteContent";
import { useEditMode } from "../lib/editMode";
import EditableImage from "./EditableImage";
import EditableText from "./EditableText";

/**
 * Facilities / life gallery — up to 6 editable photos with captions (Content
 * tab, or inline via Edit Mode). Empty slots are hidden for visitors and shown
 * as "add image" placeholders in Edit Mode.
 */
export default function GallerySection() {
  const siteContent = useSiteContent();
  const editModeOn = useEditMode();
  const renderHtml = (value: string | undefined, fallback: string) => ({
    __html: value && value.trim() ? value : fallback,
  });

  const galleryHeadingGap = parseInt(siteContent.gallery_heading_gap || "40");
  const galleryPaddingTop = parseInt(siteContent.gallery_padding_top || "96");
  const galleryPaddingBottom = parseInt(siteContent.gallery_padding_bottom || "96");

  // Gallery tiles render at ~400px, so request an 800px thumbnail (2x for
  // retina) instead of the full-size original — much lighter on mobile.
  const items = Array.from({ length: 6 }, (_, i) => ({
    imgKey: `gallery_image_${i + 1}`,
    capKey: `gallery_caption_${i + 1}`,
    img: normalizeImageUrl(siteContent[`gallery_image_${i + 1}`] || "", 800),
    cap: siteContent[`gallery_caption_${i + 1}`] || "",
  }));

  const visible = items.filter((it) => it.img || editModeOn);

  if (visible.length === 0) return null;

  return (
    <motion.section
      id="gallery-section"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6 }}
      style={{ paddingTop: `${galleryPaddingTop}px`, paddingBottom: `${galleryPaddingBottom}px` }}
      className="scroll-mt-16 bg-background"
    >
      <div className="max-w-6xl mx-auto px-6">
        <div style={{ marginBottom: `${galleryHeadingGap}px` }} className="text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="w-8 h-px bg-secondary" />
            <Images className="w-5 h-5 text-secondary" />
            <span className="w-8 h-px bg-secondary" />
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl text-primary font-bold">
            <EditableText
              contentKey="gallery_heading"
              value={siteContent.gallery_heading || ""}
              fallback="Life at Al Mustafa Academy"
              label="Gallery: Section Heading"
            >
              <span dangerouslySetInnerHTML={renderHtml(siteContent.gallery_heading, "Life at Al Mustafa Academy")} />
            </EditableText>
          </h2>
          <p className="text-sm text-on-surface-variant mt-2">
            <EditableText
              contentKey="gallery_subtitle"
              value={siteContent.gallery_subtitle || ""}
              fallback="A glimpse into our classrooms, labs, and Madrasah activities."
              label="Gallery: Subtitle"
            >
              <span dangerouslySetInnerHTML={renderHtml(siteContent.gallery_subtitle, "A glimpse into our classrooms, labs, and Madrasah activities.")} />
            </EditableText>
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {visible.map((item, i) => (
            <figure
              key={item.imgKey}
              className="group relative rounded-2xl overflow-hidden border border-primary/10 bg-surface shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              <div className="aspect-[4/3] w-full overflow-hidden">
                <EditableImage
                  contentKey={item.imgKey}
                  label={`Gallery: Image ${i + 1}`}
                  src={item.img}
                  alt={item.cap || `Al Mustafa Academy — photo ${i + 1}`}
                  className="relative h-full w-full"
                >
                  {item.img ? (
                    <img
                      src={item.img}
                      alt={item.cap || `Al Mustafa Academy — photo ${i + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div className="w-full h-full min-h-40 flex items-center justify-center border-2 border-dashed border-secondary/30 text-[11px] font-semibold text-on-surface-variant/50 uppercase tracking-wider">
                      Add image {i + 1}
                    </div>
                  )}
                </EditableImage>
              </div>
              {(item.cap || editModeOn) && (
                <figcaption className="px-4 py-3 text-center text-xs font-semibold text-primary">
                  <EditableText
                    contentKey={item.capKey}
                    value={siteContent[item.capKey] || ""}
                    fallback={item.cap}
                    label={`Gallery: Caption ${i + 1}`}
                    plain
                  >
                    <span>{siteContent[item.capKey] || item.cap || "Add a caption…"}</span>
                  </EditableText>
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
