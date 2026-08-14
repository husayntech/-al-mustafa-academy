import { motion } from "motion/react";
import { ScreenId } from "../types";
import { Scale, TrendingUp, ChevronDown } from "lucide-react";
import { useSiteContent, normalizeImageUrl, CONTENT_DEFAULTS } from "../lib/siteContent";
import EditableImage from "./EditableImage";
import EditableText from "./EditableText";

interface HomeTabProps {
  onScreenChange: (screen: ScreenId) => void;
}

export default function HomeTab({ onScreenChange }: HomeTabProps) {
  const siteContent = useSiteContent();

  const handleScrollDown = () => {
    const nextSection = document.getElementById("sacred-mission-section");
    if (nextSection) {
      nextSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  const toHtml = (v: string) => v.replace(/\n/g, "<br/>");
  const renderHtml = (value: string | undefined, fallback: string) => ({
    __html: toHtml(value && value.trim() ? value : fallback),
  });

  const heroTitle = siteContent.hero_title || "Empowering Minds, Anchored in Faith";
  const heroTagline = siteContent.hero_tagline_arabic || "تمكين العقول، مرتكزة على الإيمان";
  const missionHeading = siteContent.mission_heading || "Our Sacred Mission";
  const missionArabic = siteContent.mission_arabic || "رسالتنا المقدسة";
  const ctaText = siteContent.cta_button_text || "Join Our Community";

  // Spacing controls
  const homeHeroBottomSpacing = parseInt(siteContent.home_hero_bottom_spacing || "0");
  const homeMissionHeadingGap = parseInt(siteContent.home_mission_heading_gap || "64");
  const homeCardsGap = parseInt(siteContent.home_cards_gap || "24");
  const homeMissionPaddingTop = parseInt(siteContent.home_mission_padding_top || "80");
  const homeMissionPaddingBottom = parseInt(siteContent.home_mission_padding_bottom || "64");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full text-on-surface bg-background scroll-mt-16"
      id="home-section"
    >
      {/* School Announcement News Ticker (marquee) */}
      {siteContent.school_announcement && (() => {
        const tickerItems = [
          siteContent.school_announcement.trim(),
          siteContent.established_tag || "Established in 2013",
          siteContent.contact_email || "almustafaacademyilorin@gmail.com",
        ].filter(Boolean);
        const renderSet = (hidden: boolean) => (
          <div className="flex items-center shrink-0" aria-hidden={hidden}>
            {tickerItems.map((item, i) => (
              <span key={i} className="flex items-center gap-2.5 px-8 text-xs sm:text-sm font-medium text-primary whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary shrink-0" />
                <span dangerouslySetInnerHTML={renderHtml(item, "")} />
              </span>
            ))}
          </div>
        );
        return (
          <div className="w-full bg-secondary-fixed/10 border-b border-secondary/10 overflow-hidden">
            <div className="marquee-track py-2.5">
              {renderSet(false)}
              {renderSet(true)}
            </div>
          </div>
        );
      })()}

      {/* Hero Section */}
      <section style={{ marginBottom: homeHeroBottomSpacing ? `${homeHeroBottomSpacing}px` : undefined }} className="relative h-[calc(100vh-4rem)] min-h-[650px] flex items-center justify-center text-center px-6 overflow-hidden bg-primary">
        <EditableImage
          contentKey="hero_image_url"
          label="Home Hero Background"
          src={normalizeImageUrl(siteContent.hero_image_url || siteContent.logo_url) || CONTENT_DEFAULTS.hero_image_url}
          alt="A serene architectural view of a modern academy campus"
          className="absolute inset-0"
        >
          {/* Slow Ken Burns zoom on the hero background */}
          <motion.img
            className="w-full h-full object-cover brightness-[0.25]"
            referrerPolicy="no-referrer"
            alt="A serene architectural view of a modern academy campus"
            loading="lazy"
            initial={{ scale: 1.15 }}
            animate={{ scale: 1.05 }}
            transition={{ duration: 22, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
            src={normalizeImageUrl(siteContent.hero_image_url || siteContent.logo_url) || CONTENT_DEFAULTS.hero_image_url}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </EditableImage>
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/70 via-primary/50 to-primary/85" />

        {/* Floating Islamic geometric ornaments (slow-spinning stars) */}
        <div className="absolute inset-0 z-[1] pointer-events-none" aria-hidden="true">
          <svg
            viewBox="0 0 200 200"
            className="absolute -top-40 -right-40 w-[36rem] h-[36rem] text-secondary-fixed opacity-[0.14] animate-spin-slow"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="45" y="45" width="110" height="110" />
            <rect x="45" y="45" width="110" height="110" transform="rotate(45 100 100)" />
            <circle cx="100" cy="100" r="14" fill="currentColor" stroke="none" />
          </svg>
          <svg
            viewBox="0 0 200 200"
            className="absolute -bottom-48 -left-40 w-[30rem] h-[30rem] text-secondary-fixed opacity-[0.10] animate-spin-slow"
            style={{ animationDirection: "reverse", animationDuration: "70s" }}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="45" y="45" width="110" height="110" />
            <rect x="45" y="45" width="110" height="110" transform="rotate(45 100 100)" />
            <circle cx="100" cy="100" r="10" fill="currentColor" stroke="none" />
          </svg>
          <svg
            viewBox="0 0 200 200"
            className="absolute top-[28%] left-[8%] w-20 h-20 text-secondary-fixed opacity-[0.18] animate-float-slow"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="45" y="45" width="110" height="110" />
            <rect x="45" y="45" width="110" height="110" transform="rotate(45 100 100)" />
          </svg>
        </div>

        <div className="relative z-10 max-w-2xl px-2">
          <motion.span
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-secondary-fixed font-sans text-xs sm:text-sm font-semibold uppercase tracking-[0.25em] mb-4 block"
          >
            <EditableText contentKey="established_tag" value={siteContent.established_tag || ""} fallback="Established in 2013" label="Established Tag" plain>
              <span>{siteContent.established_tag || "Established in 2013"}</span>
            </EditableText>
          </motion.span>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="text-xl sm:text-2xl text-secondary-fixed/70 font-serif mb-2"
            dir="rtl"
          >
            <EditableText contentKey="hero_tagline_arabic" value={siteContent.hero_tagline_arabic || ""} fallback="تمكين العقول، مرتكزة على الإيمان" label="Hero Arabic Tagline" rtl>
              <span dangerouslySetInnerHTML={renderHtml(heroTagline, "تمكين العقول، مرتكزة على الإيمان")} />
            </EditableText>
          </motion.p>
          <motion.h1
            initial={{ y: 35, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.6 }}
            className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight mb-6"
          >
            <EditableText contentKey="hero_title" value={siteContent.hero_title || ""} fallback="Empowering Minds, Anchored in Faith" label="Hero Headline">
              <span
                className="hero-title-gradient"
                dangerouslySetInnerHTML={renderHtml(heroTitle, "Empowering Minds, Anchored in Faith")}
              />
            </EditableText>
          </motion.h1>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="font-sans text-sm sm:text-lg text-white/90 max-w-lg mx-auto mb-8 font-light leading-relaxed px-4"
          >
            <EditableText contentKey="hero_subtitle" value={siteContent.hero_subtitle || ""} fallback="A world-class education where tradition meets modern excellence." label="Hero Subtitle">
              <span dangerouslySetInnerHTML={renderHtml(siteContent.hero_subtitle, "A world-class education where tradition meets modern excellence.")} />
            </EditableText>
          </motion.p>
          <motion.button
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.65 }}
            onClick={() => onScreenChange("admissions")}
            className="bg-secondary-container hover:bg-secondary hover:text-white text-on-secondary-container px-8 py-4 rounded-full font-semibold text-sm cursor-pointer shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
          >
            <EditableText contentKey="cta_button_text" value={siteContent.cta_button_text || ""} fallback="Join Our Community" label="CTA Button Text" plain>
              <span>{ctaText}</span>
            </EditableText>
          </motion.button>
        </div>

        {/* Bouncing Scroll Down Trigger */}
        <button
          onClick={handleScrollDown}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 cursor-pointer text-white/50 hover:text-white transition-colors animate-bounce"
          aria-label="Scroll to Sacred Mission Section"
        >
          <ChevronDown className="w-8 h-8" />
        </button>
      </section>

      {/* Our Mission Section */}
      <motion.section
        id="sacred-mission-section"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        style={{ paddingTop: `${homeMissionPaddingTop}px`, paddingBottom: `${homeMissionPaddingBottom}px` }}
        className="px-6 max-w-7xl mx-auto relative scroll-mt-16"
      >
        <div className="islamic-pattern absolute inset-0 z-0 opacity-[0.035]" />
        
        <div className="relative z-10">
          <div className="flex flex-col items-center text-center" style={{ marginBottom: `${homeMissionHeadingGap}px` }}>
            <div className="w-16 h-1 bg-secondary rounded-full mb-6" />
            <p className="text-lg text-on-surface-variant/40 font-serif mb-1" dir="rtl">
              <EditableText contentKey="mission_arabic" value={siteContent.mission_arabic || ""} fallback="رسالتنا المقدسة" label="Mission Arabic" rtl>
                <span dangerouslySetInnerHTML={renderHtml(missionArabic, "رسالتنا المقدسة")} />
              </EditableText>
            </p>
            <h2 className="font-serif text-2xl sm:text-4xl text-primary font-bold tracking-tight mb-4">
              <EditableText contentKey="mission_heading" value={siteContent.mission_heading || ""} fallback="Our Sacred Mission" label="Mission Heading">
                <span dangerouslySetInnerHTML={renderHtml(missionHeading, "Our Sacred Mission")} />
              </EditableText>
            </h2>
            <p className="font-sans text-sm sm:text-base text-on-surface-variant max-w-2xl leading-relaxed">
              <EditableText contentKey="about_text" value={siteContent.about_text || ""} fallback="Nurturing intellect, faith, and ethical leadership for a globalized world." label="Mission Paragraph">
                <span dangerouslySetInnerHTML={renderHtml(siteContent.about_text, "Nurturing intellect, faith, and ethical leadership for a globalized world.")} />
              </EditableText>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto" style={{ gap: `${homeCardsGap}px` }}>
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-white p-8 border-t-4 border-secondary shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-300 rounded-lg group"
            >
              <div className="w-12 h-12 rounded-full bg-secondary-fixed/30 flex items-center justify-center mb-5 text-secondary group-hover:bg-secondary-fixed/50 transition-colors duration-300">
                <Scale className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl font-bold text-primary mb-3 group-hover:text-secondary transition-colors duration-300">
                <EditableText contentKey="tradition_title" value={siteContent.tradition_title || ""} fallback="Tradition" label="Tradition Card Title">
                  <span dangerouslySetInnerHTML={renderHtml(siteContent.tradition_title, "Tradition")} />
                </EditableText>
              </h3>
              <p className="font-sans text-sm text-on-surface-variant leading-relaxed">
                <EditableText contentKey="tradition_text" value={siteContent.tradition_text || ""} fallback="Rooted in Islamic scholarship, ethics, and heritage." label="Tradition Card Text">
                  <span dangerouslySetInnerHTML={renderHtml(siteContent.tradition_text, "Rooted in Islamic scholarship, ethics, and heritage.")} />
                </EditableText>
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-white p-8 border-t-4 border-secondary shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-300 rounded-lg group"
            >
              <div className="w-12 h-12 rounded-full bg-secondary-fixed/30 flex items-center justify-center mb-5 text-secondary group-hover:bg-secondary-fixed/50 transition-colors duration-300">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl font-bold text-primary mb-3 group-hover:text-secondary transition-colors duration-300">
                <EditableText contentKey="excellence_title" value={siteContent.excellence_title || ""} fallback="Excellence" label="Excellence Card Title">
                  <span dangerouslySetInnerHTML={renderHtml(siteContent.excellence_title, "Excellence")} />
                </EditableText>
              </h3>
              <p className="font-sans text-sm text-on-surface-variant leading-relaxed">
                <EditableText contentKey="excellence_text" value={siteContent.excellence_text || ""} fallback="Rigorous schooling in Islamic Sciences, languages, and critical thinking." label="Excellence Card Text">
                  <span dangerouslySetInnerHTML={renderHtml(siteContent.excellence_text, "Rigorous schooling in Islamic Sciences, languages, and critical thinking.")} />
                </EditableText>
              </p>
            </motion.div>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}
