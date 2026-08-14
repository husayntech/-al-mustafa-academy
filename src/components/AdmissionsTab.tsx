import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FileText, ClipboardList, Users, UserCheck, Star, Sparkles, CreditCard, Download, Mail, Phone, ArrowDown, Wallet, MessageCircle } from "lucide-react";
import { useSiteContent, normalizeImageUrl, normalizeWhatsAppNumber } from "../lib/siteContent";
import EditableImage from "./EditableImage";
import EditableText from "./EditableText";

const ADMISSIONS_HERO_FALLBACK =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDiLF0OV1eAJBmRqraaX91F62t-nsbNN_1DroIoPosFZJBZ4DbrhERnhS77WqaH_EjPmip4AXhrsihf7ytDwKQJAPisUl-P5Vjp61suhQF4raXRfn7yX6WhAKsftVKu5v95iCcYRO5imHE28s4JS9Qb0Y6gSx4OX2yTj9xdQ-ucpnHSl9uBTsoIWG3fa1nfJ1I0DrDEBxTNsNN5oxR7UdCdq37Dj8fFrObtHA_JI8HdIMoGrR1963nnJ0FRqEVsCJlVCfV-9caKy0s";

export default function AdmissionsTab() {
  const siteContent = useSiteContent();
  const renderHtml = (value: string | undefined, fallback: string) => ({
    __html: value && value.trim() ? value : fallback,
  });
  // Parse grade options from site content
  const gradeOptions = (siteContent.admissions_form_grade_options || "Primary (Grades 1-5)\nMiddle School (Grades 6-8)\nHigh School (Grades 9-12)").split("\n").filter((l: string) => l.trim());
  const defaultGrade = gradeOptions[0] || "Primary (Grades 1-5)";
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    grade: defaultGrade,
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Spacing controls
  const admissionsHeroBottomSpacing = parseInt(siteContent.admissions_hero_bottom_spacing || "0");
  const admissionsProcessHeadingGap = parseInt(siteContent.admissions_process_heading_gap || "64");
  const admissionsProcessPaddingTop = parseInt(siteContent.admissions_process_padding_top || "96");
  const admissionsProcessPaddingBottom = parseInt(siteContent.admissions_process_padding_bottom || "96");
  const admissionsDocsPaddingTop = parseInt(siteContent.admissions_docs_padding_top || "96");
  const admissionsDocsPaddingBottom = parseInt(siteContent.admissions_docs_padding_bottom || "96");
  const admissionsFormHeadingGap = parseInt(siteContent.admissions_form_heading_gap || "32");
  const admissionsFormPaddingTop = parseInt(siteContent.admissions_form_padding_top || "96");
  const admissionsFormPaddingBottom = parseInt(siteContent.admissions_form_padding_bottom || "96");

  const handleApplyScroll = () => {
    const applyFormSection = document.getElementById("apply-form-section");
    if (applyFormSection) {
      applyFormSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Payment confirmation: opens WhatsApp pre-filled with the fee + account details
  const handlePaymentConfirm = () => {
    const whatsappNumber = normalizeWhatsAppNumber(siteContent.admissions_whatsapp_number || "2348037525855");
    const bankName = siteContent.payment_bank_name || "Palmpay";
    const accountNumber = siteContent.payment_account_number || "8037525855";
    const accountName = siteContent.payment_account_name || "Ibrahim Olamilekan Mustapha";
    const message = encodeURIComponent(
      `Assalamu Alaikum,\n\nI have just made a payment to Al Mustafa Academy.\n\n*Fee Type:* (Application / Enrollment / Tuition)\n*Amount Paid:* ₦\n*Paid To:* ${bankName} (${accountNumber}) — ${accountName}\n*Payer Name:* \n*Student Name:* \n\nI have attached my transfer receipt. Jazakumullahu Khayran.`
    );
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank");
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.email) return;

    setIsSubmitting(true);

    // Build WhatsApp message
    const whatsappNumber = normalizeWhatsAppNumber(siteContent.admissions_whatsapp_number || "2348037525855");
    const whatsappMessage = encodeURIComponent(
      `Assalamu Alaikum,\n\nI am writing to inquire about admission to Al Mustafa Academy.\n\n*Full Name:* ${formData.fullName}\n*Email:* ${formData.email}\n*Grade of Interest:* ${formData.grade}\n*Message:* ${formData.message || "N/A"}\n\nI look forward to hearing from you.`
    );
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

    // Simulate submission then redirect
    setTimeout(() => {
      setIsSubmitting(false);
      setSuccess(true);
      // Redirect to WhatsApp after a short delay
      setTimeout(() => {
        window.open(whatsappUrl, "_blank");
      }, 1500);
    }, 1250);
  };

  const processSteps = [
    {
      num: "1",
      titleKey: "admissions_step_1_title",
      descKey: "admissions_step_1_desc",
      title: siteContent.admissions_step_1_title || "Inquiry",
      desc: siteContent.admissions_step_1_desc || "Submit an online inquiry to receive our prospectus and schedule a campus tour.",
      icon: FileText,
    },
    {
      num: "2",
      titleKey: "admissions_step_2_title",
      descKey: "admissions_step_2_desc",
      title: siteContent.admissions_step_2_title || "Application",
      desc: siteContent.admissions_step_2_desc || "Complete the online application form and upload all required documentation.",
      icon: ClipboardList,
    },
    {
      num: "3",
      titleKey: "admissions_step_3_title",
      descKey: "admissions_step_3_desc",
      title: siteContent.admissions_step_3_title || "Assessment",
      desc: siteContent.admissions_step_3_desc || "Students undergo academic assessments and a personal interview with our faculty.",
      icon: Users,
    },
    {
      num: "4",
      titleKey: "admissions_step_4_title",
      descKey: "admissions_step_4_desc",
      title: siteContent.admissions_step_4_title || "Admission",
      desc: siteContent.admissions_step_4_desc || "Successful applicants receive an offer letter and instructions for enrollment.",
      icon: UserCheck,
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
      id="admissions-section"
    >
      {/* Hero Header Banner */}
      <section style={{ marginBottom: admissionsHeroBottomSpacing ? `${admissionsHeroBottomSpacing}px` : undefined }} className="relative h-[300px] sm:h-[360px] flex items-center justify-center overflow-hidden">
        <EditableImage
          contentKey="admissions_hero_image"
          label="Admissions Hero Background"
          src={normalizeImageUrl(siteContent.admissions_hero_image || siteContent.hero_image_url) || ADMISSIONS_HERO_FALLBACK}
          alt="Academic Campus"
          className="absolute inset-0"
        >
          <img
            alt="Academic Campus"
            className="w-full h-full object-cover brightness-[0.35]"
            referrerPolicy="no-referrer"
            loading="lazy"
            src={normalizeImageUrl(siteContent.admissions_hero_image || siteContent.hero_image_url) || ADMISSIONS_HERO_FALLBACK}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </EditableImage>
        <div className="absolute inset-0 z-0 bg-gradient-to-t from-primary/80 to-transparent" />

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center text-white">
          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="font-serif text-3xl sm:text-5xl font-bold tracking-tight mb-4 text-balance"
          >
            <EditableText contentKey="admissions_hero_title" value={siteContent.admissions_hero_title || ""} fallback="Start Your Journey of Excellence" label="Admissions Hero Headline">
              <span dangerouslySetInnerHTML={renderHtml(siteContent.admissions_hero_title, "Start Your Journey of Excellence")} />
            </EditableText>
          </motion.h2>
          <p
            className="font-sans text-sm sm:text-lg text-white/90 max-w-2xl mx-auto leading-relaxed font-light"
          >
            <EditableText contentKey="admissions_hero_subtitle" value={siteContent.admissions_hero_subtitle || ""} fallback="Join Al Mustafa Academy, where we bridge sacred tradition with modern academic rigor to nurture the leaders of tomorrow." label="Admissions Hero Subtitle">
              <span dangerouslySetInnerHTML={renderHtml(
                siteContent.admissions_hero_subtitle,
                "Join Al Mustafa Academy, where we bridge sacred tradition with modern academic rigor to nurture the leaders of tomorrow."
              )} />
            </EditableText>
          </p>
          <div className="mt-8">
            <button
              onClick={handleApplyScroll}
              className="bg-secondary-container hover:bg-secondary hover:text-white text-on-secondary-container px-8 py-4 rounded-lg font-semibold text-sm cursor-pointer shadow-lg hover:scale-105 transition-all inline-flex items-center gap-2"
            >
              <EditableText contentKey="admissions_apply_button_text" value={siteContent.admissions_apply_button_text || ""} fallback="Apply / Send Inquiry" label="Apply Button Text" plain>
                <span>{siteContent.admissions_apply_button_text || "Apply / Send Inquiry"}</span>
              </EditableText>
              <ArrowDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Admissions Process Grid */}
      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        style={{ paddingTop: `${admissionsProcessPaddingTop}px`, paddingBottom: `${admissionsProcessPaddingBottom}px` }}
        className="max-w-7xl mx-auto px-6"
      >
        <div className="text-center" style={{ marginBottom: `${admissionsProcessHeadingGap}px` }}>
          <h3
            className="font-serif text-2xl sm:text-4xl text-primary font-bold tracking-tight mb-3"
          >
            <EditableText contentKey="admissions_process_heading" value={siteContent.admissions_process_heading || ""} fallback="Admissions Process" label="Process Section Heading">
              <span dangerouslySetInnerHTML={renderHtml(siteContent.admissions_process_heading, "Admissions Process")} />
            </EditableText>
          </h3>
          <div className="w-24 h-1 bg-secondary mx-auto rounded-full" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-5xl mx-auto">
          {processSteps.map((step, idx) => {
            const IconComp = step.icon;
            return (
              <div
                key={step.num}
                className={`bg-white p-6 border-t-2 border-secondary shadow-xs rounded-lg transition-transform duration-300 hover:-translate-y-1 ${
                  idx % 2 !== 0 ? "md:translate-y-6" : ""
                }`}
              >
                <div className="w-12 h-12 bg-primary text-white flex items-center justify-center rounded-lg mb-4 shadow-sm border border-secondary/20">
                  <IconComp className="w-5 h-5 text-secondary-fixed" />
                </div>
                <h4 className="font-serif text-lg font-bold text-primary mb-2">
                  {step.num}.{" "}
                  <EditableText contentKey={step.titleKey} value={siteContent[step.titleKey] || ""} fallback={step.title} label={`Step ${step.num} Title`} plain>
                    <span>{step.title}</span>
                  </EditableText>
                </h4>
                <p className="font-sans text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                  <EditableText contentKey={step.descKey} value={siteContent[step.descKey] || ""} fallback={step.desc} label={`Step ${step.num} Description`}>
                    <span>{step.desc}</span>
                  </EditableText>
                </p>
              </div>
            );
          })}
        </div>
      </motion.section>

      {/* Required Docs & Tuition Fees split */}
      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        style={{ paddingTop: `${admissionsDocsPaddingTop}px`, paddingBottom: `${admissionsDocsPaddingBottom}px` }}
        className="bg-surface-container-low border-y border-primary/5"
      >
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* List of documents required */}
          <div>
            <h3 className="font-serif text-xl sm:text-2xl text-primary font-bold mb-6 flex items-center gap-3">
              <EditableText contentKey="admissions_documents_heading" value={siteContent.admissions_documents_heading || ""} fallback="Required Documents" label="Required Documents Heading">
                <span dangerouslySetInnerHTML={renderHtml(siteContent.admissions_documents_heading, "Required Documents")} />
              </EditableText>
              <FileText className="w-6 h-6 text-secondary" />
            </h3>
            <div
              className="rich-html font-sans text-sm sm:text-base text-on-surface"
              dangerouslySetInnerHTML={renderHtml(
                siteContent.admissions_documents_html,
                ""
              )}
            />
          </div>

          {/* Table of tuition fees */}
          <div className="bg-white p-8 border border-secondary/20 rounded-xl relative overflow-hidden shadow-xs hover:shadow-sm transition-shadow">
            <div className="absolute top-0 right-0 p-8 opacity-5 select-none pointer-events-none text-primary">
              <CreditCard className="w-32 h-32" />
            </div>
            <h3
              className="font-serif text-xl sm:text-2xl text-primary font-bold mb-4"
            >
              <EditableText contentKey="admissions_fees_heading" value={siteContent.admissions_fees_heading || ""} fallback="Tuition &amp; Fees" label="Tuition & Fees Heading">
                <span dangerouslySetInnerHTML={renderHtml(siteContent.admissions_fees_heading, "Tuition &amp; Fees")} />
              </EditableText>
            </h3>
            <div
              className="rich-html"
              dangerouslySetInnerHTML={renderHtml(
                siteContent.admissions_fees_html,
                ""
              )}
            />
            <button
              onClick={() => alert("The full 2025/2026 academy fee structure has been successfully initiated for mock download!")}
              className="inline-flex items-center text-primary hover:text-secondary font-bold text-xs sm:text-sm transition-all cursor-pointer hover:gap-3"
            >
              {siteContent.admissions_fee_download_text || "Download Full Fee Schedule"}
              <Download className="w-4 h-4 ml-2" />
            </button>
          </div>

          {/* Pay fees — transfer to school account */}
          <div className="bg-white p-8 border border-secondary/20 rounded-xl relative overflow-hidden shadow-xs hover:shadow-sm transition-shadow">
            <div className="absolute top-0 right-0 p-8 opacity-5 select-none pointer-events-none text-primary">
              <Wallet className="w-32 h-32" />
            </div>
            <h3 className="font-serif text-xl sm:text-2xl text-primary font-bold mb-4">
              <EditableText contentKey="payment_heading" value={siteContent.payment_heading || ""} fallback="Pay Application &amp; School Fees" label="Payment: Section Heading">
                <span dangerouslySetInnerHTML={renderHtml(siteContent.payment_heading, "Pay Application &amp; School Fees")} />
              </EditableText>
            </h3>
            <div
              className="rich-html text-sm text-on-surface-variant"
              dangerouslySetInnerHTML={renderHtml(siteContent.payment_instructions, "")}
            />

            <div className="mt-5 rounded-xl border border-primary/10 bg-surface p-5 space-y-3">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-on-surface-variant">Bank / Wallet</span>
                <span className="font-bold text-primary">
                  <EditableText contentKey="payment_bank_name" value={siteContent.payment_bank_name || ""} fallback="Palmpay" label="Payment: Bank / Wallet Name" plain>
                    <span>{siteContent.payment_bank_name || "Palmpay"}</span>
                  </EditableText>
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-on-surface-variant">Account Number</span>
                <span className="font-bold text-primary tracking-wider">
                  <EditableText contentKey="payment_account_number" value={siteContent.payment_account_number || ""} fallback="8037525855" label="Payment: Account Number" plain>
                    <span>{siteContent.payment_account_number || "8037525855"}</span>
                  </EditableText>
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-on-surface-variant">Account Name</span>
                <span className="font-bold text-primary text-right">
                  <EditableText contentKey="payment_account_name" value={siteContent.payment_account_name || ""} fallback="Ibrahim Olamilekan Mustapha" label="Payment: Account Name" plain>
                    <span>{siteContent.payment_account_name || "Ibrahim Olamilekan Mustapha"}</span>
                  </EditableText>
                </span>
              </div>
            </div>

            <button
              onClick={handlePaymentConfirm}
              className="mt-6 w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white text-sm font-bold px-6 py-3.5 rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              {siteContent.payment_confirm_text || "I Have Paid — Confirm via WhatsApp"}
            </button>
          </div>
        </div>
      </motion.section>

      {/* Inquiry Submission & Context Info */}
      <motion.section
        id="apply-form-section"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        style={{ paddingTop: `${admissionsFormPaddingTop}px`, paddingBottom: `${admissionsFormPaddingBottom}px` }}
        className="max-w-5xl mx-auto px-6 scroll-mt-16"
      >
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-16 items-start">
          <div className="lg:col-span-2">              <h3
                className="font-serif text-2xl sm:text-3xl text-primary font-bold"
                style={{ marginBottom: `${admissionsFormHeadingGap}px` }}
              >
                <EditableText contentKey="admissions_contact_heading" value={siteContent.admissions_contact_heading || ""} fallback="Have Questions?" label="Contact Section Heading">
                  <span dangerouslySetInnerHTML={renderHtml(siteContent.admissions_contact_heading, "Have Questions?")} />
                </EditableText>
              </h3>
              <p
                className="font-sans text-xs sm:text-sm text-on-surface-variant leading-relaxed mb-8"
              >
                <EditableText contentKey="admissions_contact_text" value={siteContent.admissions_contact_text || ""} fallback="Our admissions office is here to guide you through every step of this journey. Fill out our contact inquiry form, and an institutional representative will follow up with you within 24 hours." label="Contact Section Text">
                  <span dangerouslySetInnerHTML={renderHtml(
                    siteContent.admissions_contact_text,
                    "Our admissions office is here to guide you through every step of this journey. Fill out our contact inquiry form, and an institutional representative will follow up with you within 24 hours."
                  )} />
                </EditableText>
              </p>
            
            <div className="flex flex-col gap-5 text-sm">
              <div className="flex items-center gap-4">
                <span className="text-primary bg-secondary/15 p-3 rounded-full">
                  <Phone className="w-5 h-5 text-secondary" />
                </span>
                <div>
                  <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">
                    <EditableText contentKey="admissions_phone_label" value={siteContent.admissions_phone_label || ""} fallback="Phone" label="Contact: Phone Label" plain>
                      <span>{siteContent.admissions_phone_label || "Phone"}</span>
                    </EditableText>
                  </p>
                  <p className="font-semibold text-primary">
                    <EditableText contentKey="admissions_contact_phone" value={siteContent.admissions_contact_phone || ""} fallback="+2348037525855" label="Contact Phone Number" plain>
                      <span>{siteContent.admissions_contact_phone || "+2348037525855"}</span>
                    </EditableText>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-primary bg-secondary/15 p-3 rounded-full">
                  <Mail className="w-5 h-5 text-secondary" />
                </span>
                <div>
                  <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">
                    <EditableText contentKey="admissions_email_label" value={siteContent.admissions_email_label || ""} fallback="Email" label="Contact: Email Label" plain>
                      <span>{siteContent.admissions_email_label || "Email"}</span>
                    </EditableText>
                  </p>
                  <p className="font-semibold text-primary">
                    <EditableText contentKey="admissions_contact_email" value={siteContent.admissions_contact_email || ""} fallback="almustafaacademyilorin@gmail.com" label="Contact Email Address" plain>
                      <span>{siteContent.admissions_contact_email || "almustafaacademyilorin@gmail.com"}</span>
                    </EditableText>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3 bg-white p-8 rounded-xl border border-primary/5 shadow-md">
            <AnimatePresence mode="wait">
              {!success ? (
                <motion.form
                  key="form"
                  onSubmit={handleFormSubmit}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label htmlFor="admission-full-name" className="font-semibold text-xs text-on-surface-variant uppercase tracking-wider">
                        {siteContent.admissions_form_full_name_label || "Full Name"}
                      </label>
                      <input
                        id="admission-full-name"
                        type="text"
                        required
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Please enter your full name')}
                        onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                        className="bg-white border border-primary/20 p-3 rounded text-sm focus:outline-none focus:border-secondary transition-colors invalid:border-red-400 invalid:ring-1 invalid:ring-red-400"
                        placeholder={siteContent.admissions_form_full_name_placeholder || "Parent or Guardian"}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="admission-email" className="font-semibold text-xs text-on-surface-variant uppercase tracking-wider">
                        {siteContent.admissions_form_email_label || "Email Address"}
                      </label>
                      <input
                        id="admission-email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Please enter a valid email address')}
                        onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                        className="bg-white border border-primary/20 p-3 rounded text-sm focus:outline-none focus:border-secondary transition-colors invalid:border-red-400 invalid:ring-1 invalid:ring-red-400"
                        placeholder={siteContent.admissions_form_email_placeholder || "example@email.com"}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="admission-grade" className="font-semibold text-xs text-on-surface-variant uppercase tracking-wider">
                      {siteContent.admissions_form_grade_label || "Grade of Interest"}
                    </label>
                    <select
                      id="admission-grade"
                      value={formData.grade}
                      onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                      className="bg-white border border-primary/20 p-3 rounded text-sm focus:outline-none focus:border-secondary transition-colors"
                    >
                      {gradeOptions.map((opt: string) => (
                        <option key={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="admission-message" className="font-semibold text-xs text-on-surface-variant uppercase tracking-wider">
                      {siteContent.admissions_form_message_label || "Message"}
                    </label>
                    <textarea
                      id="admission-message"
                      rows={4}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="bg-white border border-primary/20 p-3 rounded text-sm focus:outline-none focus:border-secondary transition-colors"
                      placeholder={siteContent.admissions_form_message_placeholder || "How can we help you?"}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-primary text-white py-4 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-primary-container hover:scale-102 active:scale-98 transition-all shadow-md disabled:opacity-50 cursor-pointer text-secondary-fixed"
                  >
                    {isSubmitting ? (siteContent.admissions_form_sending_text || "Sending Inquiry...") : (siteContent.admissions_form_submit_text || "Send Inquiry")}
                  </button>
                </motion.form>
              ) : (
                <motion.div
                  key="success"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center py-10"
                >
                  <div className="w-16 h-16 bg-primary text-secondary rounded-full flex items-center justify-center mx-auto mb-6 shadow-md border border-secondary/20 flex-col">
                    <Sparkles className="w-8 h-8 text-secondary" />
                  </div>
                  <h4
                    className="font-serif text-2xl font-bold text-primary mb-3"
                  >
                    <EditableText contentKey="admissions_success_heading" value={siteContent.admissions_success_heading || ""} fallback="Inquiry Submitted!" label="Success Heading">
                      <span dangerouslySetInnerHTML={renderHtml(siteContent.admissions_success_heading, "Inquiry Submitted!")} />
                    </EditableText>
                  </h4>
                  <p
                    className="font-sans text-xs sm:text-sm text-on-surface-variant leading-relaxed max-w-sm mx-auto mb-6"
                    dangerouslySetInnerHTML={renderHtml(
                      (siteContent.admissions_success_message || "Peace be upon you, {name}. Your inquiry has been processed successfully. Our school admissions secretary will reach out to {email} within 24 hours.")
                        .replace("{name}", `<strong>${formData.fullName}</strong>`)
                        .replace("{email}", `<strong>${formData.email}</strong>`),
                      ""
                    )}
                  />
                  <button
                    onClick={() => {
                      setSuccess(false);
                      setFormData({ fullName: "", email: "", grade: "Primary (Grades 1-5)", message: "" });
                    }}
                    className="bg-primary text-white px-6 py-2.5 rounded text-xs font-semibold uppercase tracking-wider hover:bg-primary-container transition-colors cursor-pointer text-secondary-fixed"
                  >
                    <EditableText contentKey="admissions_success_button" value={siteContent.admissions_success_button || ""} fallback="Submit Another Inquiry" label="Success Button Text" plain>
                      <span>{siteContent.admissions_success_button || "Submit Another Inquiry"}</span>
                    </EditableText>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}
