import { motion } from "motion/react";
import {
  Sunrise, Mic, BookOpen, GraduationCap, Coffee, BookMarked,
  Sunset, CalendarClock, Megaphone, Clock, Sparkles, Headphones
} from "lucide-react";
import { useSiteContent, normalizeImageUrl } from "../lib/siteContent";
import EditableImage from "./EditableImage";
import EditableText from "./EditableText";

const MADRASAH_HERO_FALLBACK =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDlagLGnpncRI0maRkiqnopDty3gteLvuai-wV8E-IdFH1qKO6nwv51QlF-8-KFHN43dEpce9QIZPnppXTpWzNIL6yqXqlk8kTx4UpimsnfI_N38_sUyv3pPJYCOlc_vyoTmV9RgI70aU56gYHx_yOBrmTC10bJx7g38caiXAv41rgbYJv25Ao6YVwm32Qo1clmSApOSFqquCbNriHHRKH4cF2kKZf6Wabnxp-_upZu5hsy5bS2Ew3IEoIfDCtYDto892hjQckO1F4";

const SCHEDULE_IMAGE_FALLBACK =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDlagLGnpncRI0maRkiqnopDty3gteLvuai-wV8E-IdFH1qKO6nwv51QlF-8-KFHN43dEpce9QIZPnppXTpWzNIL6yqXqlk8kTx4UpimsnfI_N38_sUyv3pPJYCOlc_vyoTmV9RgI70aU56gYHx_yOBrmTC10bJx7g38caiXAv41rgbYJv25Ao6YVwm32Qo1clmSApOSFqquCbNriHHRKH4cF2kKZf6Wabnxp-_upZu5hsy5bS2Ew3IEoIfDCtYDto892hjQckO1F4";

const ANNOUNCEMENTS_IMAGE_FALLBACK =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuChYsP3-TYjRTvlweFM8GeXEwaVzYYCRhz46RXIbMMUD7bbshymCw-BkqHA6t5e88ug0R137Un_H3vUu_msIWFac5QPhaFYNsnTmM68KiT8MnQSllR2736Ts5Z4sQLOibCx_oW-6lMNPMW9edXXzBPKMRYrsbijy1e5ltreZb31wPeTSYfO48ALOPQbKqPlKG4PVlP_EHd_-6w5MChTkRQs1QOeKpOVTCuZbyb5PerdlDG8Sq0nYDvNMTARuZCCibRp6loeky-IVh0";

const EXTRA_IMAGE_FALLBACK =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCxfijj9ohXFXMZVZUkqyTBQB3ImkiFqpltJjydzSOwCdWxMCOpjETAeJ0I3Dl2QNAr5nzkU5DrMx2jcG6Ji1g7P0jHDnuRCbciGMcW0jtmiPJmt1qfxOrt0m1FTadmggzX59fBDY9T0NuO2SM39if0PR_1nPijlwHzQvnfZ0LWAPdn-c_YaEuaHJQZUhSfWOw-kIYId9vej-znTy6og9AsZyoDgUQoDkuYqH3CTqZ1bBs7nZISweD_oHu-n1bEABjP3fhwUv1R4sM";

export default function MadrasahActivitiesTab() {
  const siteContent = useSiteContent();
  const renderHtml = (value: string | undefined, fallback: string) => ({
    __html: value && value.trim() ? value : fallback,
  });

  // Spacing controls
  const madrasahHeroBottomSpacing = parseInt(siteContent.madrasah_hero_bottom_spacing || "0");
  const madrasahIntroHeadingGap = parseInt(siteContent.madrasah_intro_heading_gap || "16");
  const madrasahIntroPaddingTop = parseInt(siteContent.madrasah_intro_padding_top || "96");
  const madrasahIntroPaddingBottom = parseInt(siteContent.madrasah_intro_padding_bottom || "96");
  const madrasahTimelineHeadingGap = parseInt(siteContent.madrasah_timeline_heading_gap || "64");
  const madrasahTimelinePaddingTop = parseInt(siteContent.madrasah_timeline_padding_top || "96");
  const madrasahTimelinePaddingBottom = parseInt(siteContent.madrasah_timeline_padding_bottom || "96");
  const madrasahWeeklyHeadingGap = parseInt(siteContent.madrasah_weekly_heading_gap || "64");
  const madrasahWeeklyPaddingTop = parseInt(siteContent.madrasah_weekly_padding_top || "96");
  const madrasahWeeklyPaddingBottom = parseInt(siteContent.madrasah_weekly_padding_bottom || "96");
  const madrasahAnnouncementsHeadingGap = parseInt(siteContent.madrasah_announcements_heading_gap || "16");
  const madrasahAnnouncementsPaddingTop = parseInt(siteContent.madrasah_announcements_padding_top || "96");
  const madrasahAnnouncementsPaddingBottom = parseInt(siteContent.madrasah_announcements_padding_bottom || "96");
  const madrasahExtraHeadingGap = parseInt(siteContent.madrasah_extra_heading_gap || "24");
  const madrasahExtraPaddingTop = parseInt(siteContent.madrasah_extra_padding_top || "96");
  const madrasahExtraPaddingBottom = parseInt(siteContent.madrasah_extra_padding_bottom || "96");

  // Saturday & Sunday schedule (existing)
  const weekendSchedule = [
    {
      icon: Sunrise,
      time: siteContent.madrasah_schedule_1_time || "09:00 AM",
      titleKey: "madrasah_schedule_1_title",
      arabicKey: "madrasah_schedule_1_arabic",
      descKey: "madrasah_schedule_1_desc",
      title: siteContent.madrasah_schedule_1_title || "Morning Assembly",
      arabic: siteContent.madrasah_schedule_1_arabic || "الاصطفاف الصباحي",
      desc: siteContent.madrasah_schedule_1_desc ||
        "The school day opens with our morning assembly, which starts at 09:00 AM sharp. All students and staff gather together to begin the day with discipline, supplication, and a shared sense of purpose.",
    },
    {
      icon: Mic,
      time: siteContent.madrasah_schedule_2_time || "09:00 – 09:30 AM",
      titleKey: "madrasah_schedule_2_title",
      arabicKey: "madrasah_schedule_2_arabic",
      descKey: "madrasah_schedule_2_desc",
      title: siteContent.madrasah_schedule_2_title || "Kalimatu Sabahi",
      arabic: siteContent.madrasah_schedule_2_arabic || "كلمة الصباح",
      desc: siteContent.madrasah_schedule_2_desc ||
        "Immediately after the assembly we do the Kalimatu Sabahi (كلمة الصباح) until 09:30 AM — the morning word — where motivation and guidance for the day are shared with all students before lessons begin.",
    },
    {
      icon: BookOpen,
      time: siteContent.madrasah_schedule_3_time || "09:30 – 10:30 AM",
      titleKey: "madrasah_schedule_3_title",
      arabicKey: "madrasah_schedule_3_arabic",
      descKey: "madrasah_schedule_3_desc",
      title: siteContent.madrasah_schedule_3_title || "Memorization & Muraaja'ah",
      arabic: siteContent.madrasah_schedule_3_arabic || "التحفيظ والمراجعة",
      desc: siteContent.madrasah_schedule_3_desc ||
        "Our memorization and Muraaja'ah (revision) starts from 09:30 AM to 10:30 AM — a dedicated hour of Quranic memorization (Hifdh) and revision so that every student strengthens new memorization and keeps earlier portions firm.",
    },
    {
      icon: GraduationCap,
      time: siteContent.madrasah_schedule_4_time || "10:30 – 11:30 AM",
      titleKey: "madrasah_schedule_4_title",
      arabicKey: "madrasah_schedule_4_arabic",
      descKey: "madrasah_schedule_4_desc",
      title: siteContent.madrasah_schedule_4_title || "Normal Classes",
      arabic: siteContent.madrasah_schedule_4_arabic || "الدروس العادية",
      desc: siteContent.madrasah_schedule_4_desc ||
        "Our normal classes begin from 10:30 AM to 11:30 AM as students engage with their subjects in focused, structured lessons with their teachers.",
    },
    {
      icon: Coffee,
      time: siteContent.madrasah_schedule_5_time || "11:30 AM – 12:00 PM",
      titleKey: "madrasah_schedule_5_title",
      arabicKey: "madrasah_schedule_5_arabic",
      descKey: "madrasah_schedule_5_desc",
      title: siteContent.madrasah_schedule_5_title || "Break Time",
      arabic: siteContent.madrasah_schedule_5_arabic || "الاستراحة",
      desc: siteContent.madrasah_schedule_5_desc ||
        "Our break time lasts for 30 minutes, from 11:30 AM to 12:00 PM — a refreshing pause that gives the students time to rest, play, and recharge for the afternoon ahead.",
    },
    {
      icon: BookMarked,
      time: siteContent.madrasah_schedule_6_time || "12:00 – 1:30 PM",
      titleKey: "madrasah_schedule_6_title",
      arabicKey: "madrasah_schedule_6_arabic",
      descKey: "madrasah_schedule_6_desc",
      title: siteContent.madrasah_schedule_6_title || "Classes Continue",
      arabic: siteContent.madrasah_schedule_6_arabic || "استمرار الدروس",
      desc: siteContent.madrasah_schedule_6_desc ||
        "By 12:00 PM until 1:30 PM the classes continue, keeping the momentum of learning going steadily through the afternoon.",
    },
    {
      icon: Sunset,
      time: siteContent.madrasah_schedule_7_time || "1:30 PM",
      titleKey: "madrasah_schedule_7_title",
      arabicKey: "madrasah_schedule_7_arabic",
      descKey: "madrasah_schedule_7_desc",
      title: siteContent.madrasah_schedule_7_title || "Call for Salah",
      arabic: siteContent.madrasah_schedule_7_arabic || "نداء الصلاة",
      desc: siteContent.madrasah_schedule_7_desc ||
        "At 1:30 PM we call for Salah — the whole madrasah pauses the day to gather for prayer and reconnect with Allah.",
    },
    {
      icon: CalendarClock,
      time: siteContent.madrasah_schedule_8_time || "2:00 – 3:30 PM",
      titleKey: "madrasah_schedule_8_title",
      arabicKey: "madrasah_schedule_8_arabic",
      descKey: "madrasah_schedule_8_desc",
      title: siteContent.madrasah_schedule_8_title || "Extra Lessons & Activities",
      arabic: siteContent.madrasah_schedule_8_arabic || "دروس وأنشطة إضافية",
      desc: siteContent.madrasah_schedule_8_desc ||
        "Sometimes after the prayer and the day's activities, some students are asked to wait behind for extra lessons and other activities from 2:00 PM to 3:30 PM.",
    },
  ];

  // Monday-Wednesday weekly schedule (4:00 PM – 6:00 PM, Asr prayer inclusive)
  const weeklySchedule = [
    {
      day: siteContent.madrasah_monday_name || "Monday",
      dayKey: "madrasah_monday_name",
      arabicKey: "madrasah_monday_arabic",
      arabic: siteContent.madrasah_monday_arabic || "الإثنين",
      icon: BookOpen,
      time: siteContent.madrasah_monday_time || "4:00 PM – 6:00 PM",
      activities: [
        {
          time: siteContent.madrasah_monday_act1_time || "4:00 PM",
          titleKey: "madrasah_monday_act1_title",
          descKey: "madrasah_monday_act1_desc",
          title: siteContent.madrasah_monday_act1_title || "Asr Prayer",
          desc: siteContent.madrasah_monday_act1_desc || "Students gather for the congregational Asr prayer before commencing their afternoon activities.",
        },
        {
          time: siteContent.madrasah_monday_act2_time || "4:15 PM – 6:00 PM",
          titleKey: "madrasah_monday_act2_title",
          descKey: "madrasah_monday_act2_desc",
          title: siteContent.madrasah_monday_act2_title || "Muraja'ah & Hifdh",
          desc: siteContent.madrasah_monday_act2_desc || "After Asr prayer, students engage in Muraja'ah (Quran Revision) and Hifdh (Quran Memorization) until closing time at 6:00 PM.",
        },
      ],
    },
    {
      day: siteContent.madrasah_tuesday_name || "Tuesday",
      dayKey: "madrasah_tuesday_name",
      arabicKey: "madrasah_tuesday_arabic",
      arabic: siteContent.madrasah_tuesday_arabic || "الثلاثاء",
      icon: Headphones,
      time: siteContent.madrasah_tuesday_time || "4:00 PM – 6:00 PM",
      activities: [
        {
          time: siteContent.madrasah_tuesday_act1_time || "4:00 PM",
          titleKey: "madrasah_tuesday_act1_title",
          descKey: "madrasah_tuesday_act1_desc",
          title: siteContent.madrasah_tuesday_act1_title || "Asr Prayer",
          desc: siteContent.madrasah_tuesday_act1_desc || "Students gather for the congregational Asr prayer before commencing their afternoon activities.",
        },
        {
          time: siteContent.madrasah_tuesday_act2_time || "4:15 PM – 5:05 PM",
          titleKey: "madrasah_tuesday_act2_title",
          descKey: "madrasah_tuesday_act2_desc",
          title: siteContent.madrasah_tuesday_act2_title || "Hifdh (Quran Memorization)",
          desc: siteContent.madrasah_tuesday_act2_desc || "After Asr prayer, students begin their Hifdh session until 5:05 PM.",
        },
        {
          time: siteContent.madrasah_tuesday_act3_time || "5:05 PM – 5:45 PM",
          titleKey: "madrasah_tuesday_act3_title",
          descKey: "madrasah_tuesday_act3_desc",
          title: siteContent.madrasah_tuesday_act3_title || "Audio Recitation Listening",
          desc: siteContent.madrasah_tuesday_act3_desc || "Students listen to one of the best reciters — Shaykh Husary — to master their tone and guide their recitation properly.",
        },
        {
          time: siteContent.madrasah_tuesday_act4_time || "5:45 PM – 6:00 PM",
          titleKey: "madrasah_tuesday_act4_title",
          descKey: "madrasah_tuesday_act4_desc",
          title: siteContent.madrasah_tuesday_act4_title || "Mutuun Memorization",
          desc: siteContent.madrasah_tuesday_act4_desc || "The final 15 minutes are dedicated to memorization of Mutuun (Arabic poems) until closing time.",
        },
      ],
    },
    {
      day: siteContent.madrasah_wednesday_name || "Wednesday",
      dayKey: "madrasah_wednesday_name",
      arabicKey: "madrasah_wednesday_arabic",
      arabic: siteContent.madrasah_wednesday_arabic || "الأربعاء",
      icon: BookMarked,
      time: siteContent.madrasah_wednesday_time || "4:00 PM – 6:00 PM",
      activities: [
        {
          time: siteContent.madrasah_wednesday_act1_time || "4:00 PM",
          titleKey: "madrasah_wednesday_act1_title",
          descKey: "madrasah_wednesday_act1_desc",
          title: siteContent.madrasah_wednesday_act1_title || "Asr Prayer",
          desc: siteContent.madrasah_wednesday_act1_desc || "Students gather for the congregational Asr prayer before commencing their afternoon activities.",
        },
        {
          time: siteContent.madrasah_wednesday_act2_time || "4:15 PM – 5:00 PM",
          titleKey: "madrasah_wednesday_act2_title",
          descKey: "madrasah_wednesday_act2_desc",
          title: siteContent.madrasah_wednesday_act2_title || "Hifdh (Quran Memorization)",
          desc: siteContent.madrasah_wednesday_act2_desc || "After Asr prayer, students begin their Hifdh session until 5:00 PM.",
        },
        {
          time: siteContent.madrasah_wednesday_act3_time || "5:00 PM – 5:45 PM",
          titleKey: "madrasah_wednesday_act3_title",
          descKey: "madrasah_wednesday_act3_desc",
          title: siteContent.madrasah_wednesday_act3_title || "Muraja'ah (Recitation & Correction)",
          desc: siteContent.madrasah_wednesday_act3_desc || "Every student recites the portion given to them, and teachers correct any mistakes during this period.",
        },
        {
          time: siteContent.madrasah_wednesday_act4_time || "5:45 PM – 6:00 PM",
          titleKey: "madrasah_wednesday_act4_title",
          descKey: "madrasah_wednesday_act4_desc",
          title: siteContent.madrasah_wednesday_act4_title || "Mutuun Memorization",
          desc: siteContent.madrasah_wednesday_act4_desc || "The final 15 minutes are dedicated to memorization of Mutuun (Arabic poems) until closing time.",
        },
      ],
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="w-full text-on-surface bg-background scroll-mt-16"
      id="madrasah-section"
    >
      {/* ======================= HERO ======================= */}
      <section style={{ marginBottom: madrasahHeroBottomSpacing ? `${madrasahHeroBottomSpacing}px` : undefined }} className="relative h-[300px] sm:h-[360px] flex items-center justify-center overflow-hidden">
        <EditableImage
          contentKey="madrasah_hero_image"
          label="Madrasah Hero Background"
          src={normalizeImageUrl(siteContent.madrasah_hero_image || siteContent.hero_image_url) || MADRASAH_HERO_FALLBACK}
          alt="Madrasah Daily Activities"
          className="absolute inset-0"
        >
          <img
            alt="Madrasah Daily Activities"
            className="w-full h-full object-cover brightness-[0.3]"
            referrerPolicy="no-referrer"
            loading="lazy"
            src={normalizeImageUrl(siteContent.madrasah_hero_image || siteContent.hero_image_url) || MADRASAH_HERO_FALLBACK}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </EditableImage>
        <div className="absolute inset-0 z-0 bg-gradient-to-t from-primary/80 to-transparent" />

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center text-white">
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-xl sm:text-2xl text-secondary-fixed/80 font-serif mb-3"
            dir="rtl"
          >
            <EditableText contentKey="madrasah_hero_arabic" value={siteContent.madrasah_hero_arabic || ""} fallback="برنامج اليوم الدراسي" label="Madrasah Hero Arabic Tagline" rtl>
              <span dangerouslySetInnerHTML={renderHtml(siteContent.madrasah_hero_arabic, "برنامج اليوم الدراسي")} />
            </EditableText>
          </motion.p>
          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="font-serif text-3xl sm:text-5xl font-bold tracking-tight mb-4"
          >
            <EditableText contentKey="madrasah_hero_title" value={siteContent.madrasah_hero_title || ""} fallback="A Day at the Madrasah" label="Madrasah Hero Headline">
              <span dangerouslySetInnerHTML={renderHtml(siteContent.madrasah_hero_title, "A Day at the Madrasah")} />
            </EditableText>
          </motion.h2>
          <p
            className="font-sans text-sm sm:text-lg text-white/90 max-w-2xl mx-auto leading-relaxed font-light"
          >
            <EditableText contentKey="madrasah_hero_subtitle" value={siteContent.madrasah_hero_subtitle || ""} fallback="From the morning assembly to the final activity, every moment of our school day is arranged with purpose — nurturing faith, discipline, knowledge, and brotherhood." label="Madrasah Hero Subtitle">
              <span dangerouslySetInnerHTML={renderHtml(
                siteContent.madrasah_hero_subtitle,
                "From the morning assembly to the final activity, every moment of our school day is arranged with purpose — nurturing faith, discipline, knowledge, and brotherhood."
              )} />
            </EditableText>
          </p>
        </div>
      </section>

      {/* ======================= INTRO ======================= */}
      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        style={{ paddingTop: `${madrasahIntroPaddingTop}px`, paddingBottom: `${madrasahIntroPaddingBottom}px` }}
        className="max-w-7xl mx-auto px-6"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="text-left">
            <p
              className="text-lg text-on-surface-variant/40 font-serif mb-1"
              dir="rtl"
            >
              <EditableText contentKey="madrasah_intro_arabic" value={siteContent.madrasah_intro_arabic || ""} fallback="نظرة على يومنا الدراسي" label="Intro Arabic Tagline" rtl>
                <span dangerouslySetInnerHTML={renderHtml(siteContent.madrasah_intro_arabic, "نظرة على يومنا الدراسي")} />
              </EditableText>
            </p>
            <h2
              className="font-serif text-2xl sm:text-4xl text-primary font-bold tracking-tight"
              style={{ marginBottom: `${madrasahIntroHeadingGap}px` }}
            >
              <EditableText contentKey="madrasah_intro_heading" value={siteContent.madrasah_intro_heading || ""} fallback="A Day Structured Around Growth" label="Intro Heading">
                <span dangerouslySetInnerHTML={renderHtml(siteContent.madrasah_intro_heading, "A Day Structured Around Growth")} />
              </EditableText>
            </h2>
            <div className="w-24 h-1 bg-secondary rounded-full" style={{ marginBottom: `${madrasahIntroHeadingGap}px` }} />
            <p
              className="font-sans text-xs sm:text-sm text-on-surface-variant leading-relaxed font-light"
            >
              <EditableText contentKey="madrasah_intro_text" value={siteContent.madrasah_intro_text || ""} fallback="Every day at Al Mustafa Academy follows a carefully arranged routine that balances spiritual development, Quranic memorization, and formal lessons — so each student grows in knowledge, character, and connection to their faith." label="Intro Paragraph">
                <span dangerouslySetInnerHTML={renderHtml(
                  siteContent.madrasah_intro_text,
                  "Every day at Al Mustafa Academy follows a carefully arranged routine that balances spiritual development, Quranic memorization, and formal lessons — so each student grows in knowledge, character, and connection to their faith."
                )} />
              </EditableText>
            </p>
            <div className="mt-8 flex items-center gap-2 text-primary bg-primary/5 border border-primary/10 rounded-full px-4 py-2 w-fit">
              <Clock className="w-4 h-4 text-secondary" />
              <span className="text-xs font-semibold">
                {siteContent.madrasah_schedule_7_time || "1:30 PM"} — Daily Call for Salah
              </span>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="relative rounded-2xl overflow-hidden border border-primary/5 shadow-lg aspect-[4/3]"
          >
            <EditableImage
              contentKey="madrasah_schedule_image"
              label="Madrasah Intro Image"
              src={normalizeImageUrl(siteContent.madrasah_schedule_image) || SCHEDULE_IMAGE_FALLBACK}
              alt="Students during the madrasah day"
              className="absolute inset-0"
            >
              <img
                alt="Students during the madrasah day"
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                referrerPolicy="no-referrer"
                loading="lazy"
                src={normalizeImageUrl(siteContent.madrasah_schedule_image) || SCHEDULE_IMAGE_FALLBACK}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </EditableImage>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary/80 to-transparent p-4">
              <p className="text-white text-xs font-medium" dir="rtl">
                {siteContent.madrasah_schedule_2_title || "كلمة الصباح (Kalimatu Sabahi)"}
              </p>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* ======================= WEEKEND SCHEDULE (SAT & SUN) ======================= */}
      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        style={{ paddingTop: `${madrasahTimelinePaddingTop}px`, paddingBottom: `${madrasahTimelinePaddingBottom}px` }}
        className="bg-surface-container-low border-y border-primary/5"
      >
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center" style={{ marginBottom: `${madrasahTimelineHeadingGap}px` }}>
            <p className="text-base text-on-surface-variant/30 font-serif mb-1" dir="rtl">
              <EditableText contentKey="madrasah_timeline_arabic" value={siteContent.madrasah_timeline_arabic || ""} fallback="جدول اليوم الدراسي" label="Timeline Arabic Tagline" rtl>
                <span dangerouslySetInnerHTML={renderHtml(siteContent.madrasah_timeline_arabic, "جدول اليوم الدراسي")} />
              </EditableText>
            </p>
            <h2
              className="font-serif text-2xl sm:text-3xl text-primary font-bold tracking-tight mb-3"
            >
              <EditableText contentKey="madrasah_timeline_heading" value={siteContent.madrasah_timeline_heading || ""} fallback="Our Daily Schedule" label="Timeline Heading">
                <span dangerouslySetInnerHTML={renderHtml(siteContent.madrasah_timeline_heading, "Our Daily Schedule")} />
              </EditableText>
            </h2>
            <p
              className="font-sans text-xs sm:text-sm text-on-surface-variant max-w-md mx-auto"
            >
              <EditableText contentKey="madrasah_timeline_subtitle" value={siteContent.madrasah_timeline_subtitle || ""} fallback="Each step of the day is timed with intention — from assembly to Salah." label="Timeline Subtitle">
                <span dangerouslySetInnerHTML={renderHtml(
                  siteContent.madrasah_timeline_subtitle,
                  "Each step of the day is timed with intention — from assembly to Salah."
                )} />
              </EditableText>
            </p>
            <div className="w-24 h-1 bg-secondary mx-auto rounded-full mt-5" />
            <p className="mt-4 text-sm font-semibold text-primary bg-primary/10 inline-block px-4 py-2 rounded-full">
              <EditableText contentKey="madrasah_weekend_label" value={siteContent.madrasah_weekend_label || ""} fallback="Saturday & Sunday" label="Weekend Schedule Label" plain>
                <span>{siteContent.madrasah_weekend_label || "Saturday & Sunday"}</span>
              </EditableText>
            </p>
          </div>

          {/* Vertical timeline */}
          <div className="relative">
            <div className="hidden sm:block absolute left-6 top-2 bottom-2 w-0.5 bg-gradient-to-b from-secondary via-primary/20 to-secondary rounded-full" />
            <div className="space-y-8">
              {weekendSchedule.map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.45, delay: i * 0.05 }}
                    className="relative sm:pl-24"
                  >
                    {/* Timeline node (desktop) */}
                    <div className="hidden sm:flex absolute left-0 top-1 w-12 h-12 rounded-full bg-secondary-fixed/20 border border-secondary/40 items-center justify-center text-secondary shadow-sm z-10">
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="bg-white border border-primary/5 rounded-2xl p-5 md:p-6 shadow-xs hover:shadow-lg hover:border-secondary/40 hover:-translate-y-0.5 transition-all duration-300">
                      <div className="flex items-center gap-3 flex-wrap mb-3">
                        <span className="inline-flex items-center gap-1.5 bg-primary text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-sm">
                          <Clock className="w-3.5 h-3.5" />
                          {item.time}
                        </span>
                        <span className="sm:hidden w-8 h-8 rounded-full bg-secondary-fixed/20 text-secondary flex items-center justify-center">
                          <Icon className="w-4 h-4" />
                        </span>
                      </div>
                      <h4 className="font-serif text-lg font-bold text-primary mb-2 flex items-center gap-2 flex-wrap">
                        <EditableText contentKey={item.titleKey} value={siteContent[item.titleKey] || ""} fallback={item.title} label={item.title} plain>
                          <span>{item.title}</span>
                        </EditableText>
                        <EditableText contentKey={item.arabicKey} value={siteContent[item.arabicKey] || ""} fallback={item.arabic} label={`${item.title} (Arabic)`} rtl>
                          <span dir="rtl" className="text-sm font-medium text-on-surface-variant/50 font-serif">{item.arabic}</span>
                        </EditableText>
                      </h4>
                      <p
                        className="font-sans text-xs sm:text-sm text-on-surface-variant leading-relaxed font-light"
                      >
                        <EditableText contentKey={item.descKey} value={siteContent[item.descKey] || ""} fallback={item.desc} label={`${item.title} Description`}>
                          <span dangerouslySetInnerHTML={renderHtml(item.desc, "")} />
                        </EditableText>
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </motion.section>

      {/* ======================= WEEKLY SCHEDULE (MON – WED) ======================= */}
      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        style={{ paddingTop: `${madrasahWeeklyPaddingTop}px`, paddingBottom: `${madrasahWeeklyPaddingBottom}px` }}
        className=""
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center" style={{ marginBottom: `${madrasahWeeklyHeadingGap}px` }}>
            <p className="text-base text-on-surface-variant/30 font-serif mb-1" dir="rtl">
              <EditableText contentKey="madrasah_weekly_arabic_header" value={siteContent.madrasah_weekly_arabic_header || ""} fallback="البرنامج الأسبوعي من الاثنين إلى الأربعاء" label="Weekly Section Arabic Header" rtl>
                <span>{siteContent.madrasah_weekly_arabic_header || "البرنامج الأسبوعي من الاثنين إلى الأربعاء"}</span>
              </EditableText>
            </p>
            <h2
              className="font-serif text-2xl sm:text-3xl text-primary font-bold tracking-tight mb-3"
            >
              <EditableText contentKey="madrasah_weekly_heading" value={siteContent.madrasah_weekly_heading || ""} fallback="Weekly Afternoon Program" label="Weekly Section Heading">
                <span dangerouslySetInnerHTML={renderHtml(siteContent.madrasah_weekly_heading, "Weekly Afternoon Program")} />
              </EditableText>
            </h2>
            <p
              className="font-sans text-xs sm:text-sm text-on-surface-variant max-w-lg mx-auto"
            >
              <EditableText contentKey="madrasah_weekly_subtitle" value={siteContent.madrasah_weekly_subtitle || ""} fallback="Monday to Wednesday — 4:00 PM to 6:00 PM (Asr prayer inclusive)" label="Weekly Section Subtitle">
                <span dangerouslySetInnerHTML={renderHtml(siteContent.madrasah_weekly_subtitle, "Monday to Wednesday — 4:00 PM to 6:00 PM (Asr prayer inclusive)")} />
              </EditableText>
            </p>
            <div className="w-24 h-1 bg-secondary mx-auto rounded-full mt-5" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {weeklySchedule.map((day, i) => {
              const DayIcon = day.icon;
              return (
                <motion.div
                  key={day.day}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.45, delay: i * 0.1 }}
                  className="bg-white border border-primary/5 rounded-2xl overflow-hidden shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
                >
                  {/* Day Header */}
                  <div className="bg-primary p-5 text-white">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-baseline gap-2.5 flex-wrap">
                        <h3 className="font-serif text-xl font-bold">
                          <EditableText contentKey={day.dayKey} value={siteContent[day.dayKey] || ""} fallback={day.day} label={`${day.day} Name`} plain>
                            <span>{day.day}</span>
                          </EditableText>
                        </h3>
                        <EditableText contentKey={day.arabicKey} value={siteContent[day.arabicKey] || ""} fallback={day.arabic} label={`${day.day} Arabic`} rtl>
                          <p className="text-white/70 text-sm font-serif" dir="rtl">{day.arabic}</p>
                        </EditableText>
                      </div>
                      <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                        <DayIcon className="w-6 h-6 text-secondary-fixed" />
                      </div>
                    </div>
                    <div className="mt-3 inline-flex items-center gap-1.5 bg-white/10 text-white/90 text-[11px] font-bold px-3 py-1.5 rounded-full">
                      <Clock className="w-3.5 h-3.5" />
                      {day.time}
                    </div>
                  </div>

                  {/* Activities */}
                  <div className="p-5 space-y-4">
                    {day.activities.map((activity, j) => (
                      <div key={j} className="relative pl-4 border-l-2 border-secondary/30">
                        <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">
                          {activity.time}
                        </span>
                        <h4 className="font-serif text-sm font-bold text-primary mt-1">
                          <EditableText contentKey={activity.titleKey} value={siteContent[activity.titleKey] || ""} fallback={activity.title} label={activity.title} plain>
                            <span>{activity.title}</span>
                          </EditableText>
                        </h4>
                        <p className="font-sans text-xs text-on-surface-variant leading-relaxed font-light mt-1">
                          <EditableText contentKey={activity.descKey} value={siteContent[activity.descKey] || ""} fallback={activity.desc} label={activity.title}>
                            <span>{activity.desc}</span>
                          </EditableText>
                        </p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Note */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45, delay: 0.3 }}
            className="mt-12 bg-secondary-container/30 border border-secondary/20 rounded-2xl p-6 text-center max-w-2xl mx-auto"
          >
            <Sparkles className="w-6 h-6 text-secondary mx-auto mb-3" />
            <h4 className="font-serif text-lg font-bold text-primary mb-2">
              <EditableText contentKey="madrasah_mutuun_heading" value={siteContent.madrasah_mutuun_heading || ""} fallback="Mutuun (Arabic Poems)" label="Mutuun Note Heading" plain>
                <span>{siteContent.madrasah_mutuun_heading || "Mutuun (Arabic Poems)"}</span>
              </EditableText>
            </h4>
            <p
              className="font-sans text-xs sm:text-sm text-on-surface-variant leading-relaxed font-light"
            >
              <EditableText contentKey="madrasah_mutuun_text" value={siteContent.madrasah_mutuun_text || ""} fallback="On both Tuesday and Wednesday, the final 15 minutes (5:45 PM – 6:00 PM) are dedicated to memorizing Mutuun — traditional Arabic poems that reinforce language skills, poetic expression, and cultural heritage." label="Mutuun Note Text">
                <span dangerouslySetInnerHTML={renderHtml(
                  siteContent.madrasah_mutuun_text,
                  "On both Tuesday and Wednesday, the final 15 minutes (5:45 PM – 6:00 PM) are dedicated to memorizing Mutuun — traditional Arabic poems that reinforce language skills, poetic expression, and cultural heritage."
                )} />
              </EditableText>
            </p>
          </motion.div>
        </div>
      </motion.section>

      {/* ======================= STUDENT ADDRESS & ANNOUNCEMENTS ======================= */}
      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        style={{ paddingTop: `${madrasahAnnouncementsPaddingTop}px`, paddingBottom: `${madrasahAnnouncementsPaddingBottom}px` }}
        className="bg-surface-container-low border-y border-primary/5"
      >
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="relative rounded-2xl overflow-hidden border border-primary/5 shadow-lg aspect-[4/3] order-2 lg:order-1"
          >
            <EditableImage
              contentKey="madrasah_announcements_image"
              label="Student Address Image"
              src={normalizeImageUrl(siteContent.madrasah_announcements_image) || ANNOUNCEMENTS_IMAGE_FALLBACK}
              alt="A student addressing fellow students"
              className="absolute inset-0"
            >
              <img
                alt="A student addressing fellow students"
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                referrerPolicy="no-referrer"
                loading="lazy"
                src={normalizeImageUrl(siteContent.madrasah_announcements_image) || ANNOUNCEMENTS_IMAGE_FALLBACK}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </EditableImage>
            <div className="absolute top-4 left-4 bg-secondary-fixed text-primary text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full shadow-md">
              <Megaphone className="w-3.5 h-3.5 inline mr-1" />
              <EditableText contentKey="madrasah_after_salah_badge" value={siteContent.madrasah_after_salah_badge || ""} fallback="After Salah" label="After Salah Badge" plain>
                <span>{siteContent.madrasah_after_salah_badge || "After Salah"}</span>
              </EditableText>
            </div>
          </motion.div>

          <div className="order-1 lg:order-2 text-left">
            <div className="w-12 h-12 bg-secondary/15 text-secondary flex items-center justify-center rounded-xl mb-5">
              <Megaphone className="w-6 h-6" />
            </div>
            <h2
              className="font-serif text-2xl sm:text-3xl text-primary font-bold tracking-tight"
              style={{ marginBottom: `${madrasahAnnouncementsHeadingGap}px` }}
            >
              <EditableText contentKey="madrasah_announcements_heading" value={siteContent.madrasah_announcements_heading || ""} fallback="Student Address & Announcements" label="Student Address Heading">
                <span dangerouslySetInnerHTML={renderHtml(
                  siteContent.madrasah_announcements_heading,
                  "Student Address & Announcements"
                )} />
              </EditableText>
            </h2>
            <div className="w-24 h-1 bg-secondary rounded-full" style={{ marginBottom: `${madrasahAnnouncementsHeadingGap}px` }} />
            <p
              className="font-sans text-xs sm:text-sm text-on-surface-variant leading-relaxed font-light mb-6"
            >
              <EditableText contentKey="madrasah_announcements_text" value={siteContent.madrasah_announcements_text || ""} fallback="A cherished part of our day — sometimes after the prayer and the activities, a student is invited to come out and address his or her fellow students, building confidence and leadership. At other times, our staff pass on information that is crucial to them, keeping everyone informed and connected." label="Student Address Text">
                <span dangerouslySetInnerHTML={renderHtml(
                  siteContent.madrasah_announcements_text,
                  "A cherished part of our day — sometimes after the prayer and the activities, a student is invited to come out and address his or her fellow students, building confidence and leadership. At other times, our staff pass on information that is crucial to them, keeping everyone informed and connected."
                )} />
              </EditableText>
            </p>
            <div className="flex items-start gap-3 bg-white border border-primary/5 rounded-xl p-4 shadow-xs">
              <Sparkles className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
              <p className="text-xs text-on-surface-variant font-light leading-relaxed">
                <EditableText contentKey="madrasah_announcements_note" value={siteContent.madrasah_announcements_note || ""} fallback="This little activity strengthens public speaking, self-confidence, and a strong sense of community among the students." label="Student Address Highlight Note">
                  <span>{siteContent.madrasah_announcements_note ||
                    "This little activity strengthens public speaking, self-confidence, and a strong sense of community among the students."}</span>
                </EditableText>
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ======================= EXTRA LESSONS & ACTIVITIES ======================= */}
      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        style={{ paddingTop: `${madrasahExtraPaddingTop}px`, paddingBottom: `${madrasahExtraPaddingBottom}px` }}
        className=""
      >
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="text-left">
            <div className="w-12 h-12 bg-primary/10 text-primary flex items-center justify-center rounded-xl mb-5">
              <CalendarClock className="w-6 h-6" />
            </div>
            <h2
              className="font-serif text-2xl sm:text-3xl text-primary font-bold tracking-tight"
              style={{ marginBottom: `${madrasahExtraHeadingGap}px` }}
            >
              <EditableText contentKey="madrasah_extra_heading" value={siteContent.madrasah_extra_heading || ""} fallback="Extra Lessons & Activities" label="Extra Lessons Heading">
                <span dangerouslySetInnerHTML={renderHtml(
                  siteContent.madrasah_extra_heading,
                  "Extra Lessons & Activities"
                )} />
              </EditableText>
            </h2>
            <div className="w-24 h-1 bg-secondary rounded-full" style={{ marginBottom: `${madrasahExtraHeadingGap}px` }} />
            <p
              className="font-sans text-xs sm:text-sm text-on-surface-variant leading-relaxed font-light"
            >
              <EditableText contentKey="madrasah_extra_text" value={siteContent.madrasah_extra_text || ""} fallback="Learning does not end when the main classes do. From 2:00 PM to 3:30 PM, some students stay behind for extra lessons and other activities — receiving the additional support and enrichment they need to truly excel." label="Extra Lessons Text">
                <span dangerouslySetInnerHTML={renderHtml(
                  siteContent.madrasah_extra_text,
                  "Learning does not end when the main classes do. From 2:00 PM to 3:30 PM, some students stay behind for extra lessons and other activities — receiving the additional support and enrichment they need to truly excel."
                )} />
              </EditableText>
            </p>
            <div className="mt-8 inline-flex items-center gap-2 bg-primary text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-sm">
              <Clock className="w-4 h-4" />
              {siteContent.madrasah_schedule_8_time || "2:00 – 3:30 PM"}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="relative rounded-2xl overflow-hidden border border-primary/5 shadow-lg aspect-[4/3]"
          >
            <EditableImage
              contentKey="madrasah_extra_image"
              label="Extra Lessons Image"
              src={normalizeImageUrl(siteContent.madrasah_extra_image) || EXTRA_IMAGE_FALLBACK}
              alt="Extra lessons and activities in the afternoon"
              className="absolute inset-0"
            >
              <img
                alt="Extra lessons and activities in the afternoon"
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                referrerPolicy="no-referrer"
                loading="lazy"
                src={normalizeImageUrl(siteContent.madrasah_extra_image) || EXTRA_IMAGE_FALLBACK}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </EditableImage>
          </motion.div>
        </div>
      </motion.section>
    </motion.div>
  );
}
