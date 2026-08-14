import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { HelpCircle, ChevronDown, MessageCircle } from "lucide-react";
import { useSiteContent } from "../lib/siteContent";
import EditableText from "./EditableText";

/**
 * FAQ accordion — up to 6 editable question/answer pairs from the Content tab.
 * Each pair is shown only when it has a question (so unused slots disappear).
 */
export default function FAQSection() {
  const siteContent = useSiteContent();
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const renderHtml = (value: string | undefined, fallback: string) => ({
    __html: value && value.trim() ? value : fallback,
  });

  const faqHeadingGap = parseInt(siteContent.faq_heading_gap || "40");
  const faqPaddingTop = parseInt(siteContent.faq_padding_top || "96");
  const faqPaddingBottom = parseInt(siteContent.faq_padding_bottom || "96");

  const items: { qKey: string; aKey: string; q: string; a: string }[] = Array.from({ length: 6 }, (_, i) => ({
    qKey: `faq_q${i + 1}`,
    aKey: `faq_a${i + 1}`,
    q: siteContent[`faq_q${i + 1}`] || "",
    a: siteContent[`faq_a${i + 1}`] || "",
  })).filter((it) => it.q);

  return (
    <motion.section
      id="faq-section"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6 }}
      style={{ paddingTop: `${faqPaddingTop}px`, paddingBottom: `${faqPaddingBottom}px` }}
      className="scroll-mt-16 bg-surface/70 border-y border-primary/5"
    >
      <div className="max-w-3xl mx-auto px-6">
        <div style={{ marginBottom: `${faqHeadingGap}px` }} className="text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="w-8 h-px bg-secondary" />
            <HelpCircle className="w-5 h-5 text-secondary" />
            <span className="w-8 h-px bg-secondary" />
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl text-primary font-bold">
            <EditableText
              contentKey="faq_heading"
              value={siteContent.faq_heading || ""}
              fallback="Frequently Asked Questions"
              label="FAQ: Section Heading"
            >
              <span dangerouslySetInnerHTML={renderHtml(siteContent.faq_heading, "Frequently Asked Questions")} />
            </EditableText>
          </h2>
          <p className="text-sm text-on-surface-variant mt-2">
            <EditableText
              contentKey="faq_subtitle"
              value={siteContent.faq_subtitle || ""}
              fallback="Answers to the questions families ask us most."
              label="FAQ: Subtitle"
            >
              <span dangerouslySetInnerHTML={renderHtml(siteContent.faq_subtitle, "Answers to the questions families ask us most.")} />
            </EditableText>
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {items.map((item, i) => {
            const open = openIndex === i;
            return (
              <div
                key={item.qKey}
                className={`bg-white rounded-xl border transition-colors overflow-hidden ${
                  open ? "border-secondary/40 shadow-md" : "border-primary/10 shadow-sm"
                }`}
              >
                <button
                  onClick={() => setOpenIndex(open ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer"
                  aria-expanded={open}
                >
                  <span className="text-sm sm:text-base font-semibold text-on-surface">
                    <EditableText
                      contentKey={item.qKey}
                      value={siteContent[item.qKey] || ""}
                      fallback={item.q}
                      label={`FAQ: Question ${i + 1}`}
                      plain
                    >
                      <span>{siteContent[item.qKey] || item.q}</span>
                    </EditableText>
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-secondary shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5">
                        <div className="rich-html text-sm text-on-surface-variant leading-relaxed">
                          <EditableText
                            contentKey={item.aKey}
                            value={siteContent[item.aKey] || ""}
                            fallback={item.a}
                            label={`FAQ: Answer ${i + 1}`}
                          >
                            <span dangerouslySetInnerHTML={renderHtml(siteContent[item.aKey], item.a)} />
                          </EditableText>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        <p className="text-center text-sm text-on-surface-variant mt-8 flex items-center justify-center gap-1.5">
          <MessageCircle className="w-4 h-4 text-secondary" />
          Still have a question?{" "}
          <a
            href={`https://wa.me/${siteContent.admissions_whatsapp_number || "2348037525585"}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-semibold hover:text-secondary underline underline-offset-2"
          >
            Message us on WhatsApp
          </a>
        </p>
      </div>
    </motion.section>
  );
}
