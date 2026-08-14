import { lazy, Suspense, useEffect, useState } from "react";
import { motion, AnimatePresence, useScroll, useSpring } from "motion/react";
import { ArrowUp, GraduationCap } from "lucide-react";
import { ScreenId, User, Student, Class, Subject, Result } from "./types";
import { useSiteContent } from "./lib/siteContent";
import { applyCustomStyles } from "./lib/customStyles";
import { useEditMode } from "./lib/editMode";
import Header from "./components/Header";
import Footer from "./components/Footer";
import HomeTab from "./components/HomeTab";
import WelcomeSection from "./components/WelcomeSection";
import AdmissionsTab from "./components/AdmissionsTab";
import CalendarSection from "./components/CalendarSection";
import MadrasahActivitiesTab from "./components/MadrasahActivitiesTab";
import FAQSection from "./components/FAQSection";
import GallerySection from "./components/GallerySection";

import WhatsAppWidget from "./components/WhatsAppWidget";

// Portal screens, the chatbot, and the admin edit-mode tools are lazy-loaded so
// the public landing page ships a small bundle — the heavy JS (Gemini SDK,
// jsPDF/html2canvas, admin/portal screens) only downloads when actually used.
const Chatbot = lazy(() => import("./components/Chatbot"));
const ContentInspector = lazy(() => import("./components/ContentInspector"));
const SpacingGuide = lazy(() => import("./components/SpacingGuide"));
const LoginPage = lazy(() => import("./components/TeacherPortal/LoginPage"));
const StudentLogin = lazy(() => import("./components/TeacherPortal/StudentLogin"));
const TeacherLandingPage = lazy(() => import("./components/TeacherPortal/TeacherLandingPage"));
const TeacherDashboard = lazy(() => import("./components/TeacherPortal/TeacherDashboard"));
const ClassDetail = lazy(() => import("./components/TeacherPortal/ClassDetail"));
const StudentResultsForm = lazy(() => import("./components/TeacherPortal/StudentResultsForm"));
const StudentResultPage = lazy(() => import("./components/TeacherPortal/StudentResultPage"));
const SubjectsView = lazy(() => import("./components/TeacherPortal/SubjectsView"));
const AdminSettings = lazy(() => import("./components/TeacherPortal/AdminSettings"));
const AdminLoginPage = lazy(() => import("./components/TeacherPortal/AdminLoginPage"));

function PageLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  );
}

export default function App() {
  const [contentVersion, setContentVersion] = useState(0);
  const siteContent = useSiteContent(); // fetch content once + apply theme colors + stay in sync

  // Force re-render of content when admin saves
  useEffect(() => {
    const handleContentSaved = () => setContentVersion(v => v + 1);
    window.addEventListener('content-saved', handleContentSaved);
    return () => window.removeEventListener('content-saved', handleContentSaved);
  }, []);

  const editModeOn = useEditMode();

  const [currentScreen, setCurrentScreen] = useState<ScreenId>("home");

  // Re-apply persisted Style Editor changes after content loads / screen changes,
  // so saved margin/padding/style edits survive a refresh and apply site-wide.
  useEffect(() => {
    // Wait a tick so the newly rendered elements are in the DOM
    const t = setTimeout(() => {
      applyCustomStyles(siteContent.custom_styles);
    }, 60);
    return () => clearTimeout(t);
  }, [siteContent, currentScreen, contentVersion]);

  // Reading-progress bar — fills the top of the page as the user scrolls through the landing page
  const { scrollYProgress } = useScroll();
  const progressScaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });

  // Floating scroll-to-top button — appears once the user scrolls down the landing page
  const [showScrollTop, setShowScrollTop] = useState(false);
  // Sticky "Apply Now" button — appears once the user scrolls past the hero
  const [showApply, setShowApply] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 600);
      setShowApply(window.scrollY > 500);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [user, setUser] = useState<User | null>(
    localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user")!) : null
  );

  // Refresh the logged-in user's full bio (name parts, phone, email, address) on load
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (!storedToken) return;
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${storedToken}` } })
      .then((res) => res.json())
      .then((data) => {
        if (data.user && data.user.id) {
          setUser(data.user);
          try { localStorage.setItem("user", JSON.stringify(data.user)); } catch {}
        }
      })
      .catch(() => {});
  }, []);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showSubjects, setShowSubjects] = useState(false);
  const [showAdminSettings, setShowAdminSettings] = useState(false);
  const [showResultPage, setShowResultPage] = useState(false);
  const [resultPageData, setResultPageData] = useState<{
    subjects: Subject[];
    results: Result[];
    term: number;
    academicYear: string;
  } | null>(null);

  // On the landing page, all content sections (Home, Welcome, Admissions,
  // Calendar, Madrasah, FAQs, Gallery) are rendered together in one long page.
  // Nav links scroll to the matching section instead of switching screens.
  // Portal screens still use currentScreen as before.
  const SECTION_IDS: Record<string, string> = {
    home: "home-section",
    admissions: "admissions-section",
    curriculum: "madrasah-section",
    calendar: "calendar-section",
    faq: "faq-section",
    gallery: "gallery-section",
  };
  const handleScreenChange = (screenId: ScreenId) => {
    if (screenId in SECTION_IDS) {
      setCurrentScreen("home");
      const el = document.getElementById(SECTION_IDS[screenId]);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } else {
      setCurrentScreen(screenId);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleLoginSuccess = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    setCurrentScreen("teacher-portal");
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setSelectedClass(null);
    setSelectedStudent(null);
    setShowSubjects(false);
    setCurrentScreen("home");
  };

  const handleSelectClass = async (classId: number) => {
    try {
      const res = await fetch(`/api/classes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const cls = (data.classes || []).find((c: Class) => c.id === classId);
      setSelectedClass(cls || null);
      setSelectedStudent(null);
      setShowSubjects(false);
    } catch (err) {
      console.error("Failed to fetch class:", err);
    }
  };

  const handleBackToDashboard = () => {
    setSelectedClass(null);
    setSelectedStudent(null);
    setShowSubjects(false);
  };

  const handleStudentResults = (student: Student) => {
    setSelectedStudent(student);
  };

  const handleBackToClass = () => {
    setSelectedStudent(null);
    setShowSubjects(false);
    setShowResultPage(false);
    setResultPageData(null);
  };

  const handleShowResultPage = (subjects: Subject[], results: Result[], term: number, academicYear: string) => {
    setResultPageData({ subjects, results, term, academicYear });
    setShowResultPage(true);
  };

  const handleBackToResultsForm = () => {
    setShowResultPage(false);
    setResultPageData(null);
  };

  const handleShowSubjects = () => {
    setShowSubjects(true);
    setSelectedStudent(null);
  };

  const handleLogoutFromPortal = () => {
    handleLogout();
    setCurrentScreen("teacher-landing");
  };

  const handleGoToLogin = () => {
    setCurrentScreen("teacher-login");
  };

  const handleGoToLanding = () => {
    setCurrentScreen("teacher-landing");
  };

  const handleGoToAdmin = () => {
    setShowAdminSettings(true);
  };

  const handleBackFromAdmin = () => {
    setShowAdminSettings(false);
  };

  // Portal access from landing page
  const handleOpenAdminLogin = () => {
    setShowAdminLoginModal(true);
  };

  const handleOpenStudentLogin = () => {
    setCurrentScreen("student-login");
  };

  const handleOpenTeacherLogin = () => {
    if (token && user) {
      setCurrentScreen("teacher-portal");
    } else {
      setCurrentScreen("teacher-landing");
    }
  };

  const handleCloseAdminLogin = () => {
    setShowAdminLoginModal(false);
  };

  const handleAdminLoginSuccess = (newToken: string, newUser: User) => {
    setShowAdminLoginModal(false);
    setToken(newToken);
    setUser(newUser);
    if (newUser.role === "admin" || newUser.is_admin) {
      setShowAdminSettings(true);
      setCurrentScreen("teacher-portal");
    } else {
      setCurrentScreen("teacher-portal");
    }
  };

  const handleGoToTeacherLogin = () => {
    setCurrentScreen("teacher-login");
  };

  // Student portal (surname-based login)
  if (currentScreen === "student-login") {
    return (
      <Suspense fallback={<PageLoading />}>
        <StudentLogin onBack={() => setCurrentScreen("home")} />
      </Suspense>
    );
  }

  // Hidden admin login modal (overlays the main content)
  if (showAdminLoginModal) {
    return (
      <Suspense fallback={<PageLoading />}>
        <AdminLoginPage onLoginSuccess={handleAdminLoginSuccess} onBack={handleCloseAdminLogin} />
      </Suspense>
    );
  }

  // Render teacher portal content
  if (currentScreen === "teacher-landing") {
    return (
      <Suspense fallback={<PageLoading />}>
        <TeacherLandingPage onLogin={handleGoToLogin} onBack={() => setCurrentScreen("home")} />
      </Suspense>
    );
  }

  if (currentScreen === "teacher-login") {
    return (
      <Suspense fallback={<PageLoading />}>
        <LoginPage onLoginSuccess={handleLoginSuccess} onBack={() => setCurrentScreen("home")} />
      </Suspense>
    );
  }

  if (currentScreen === "teacher-portal" && token && user) {
    // Admin settings
    if (showAdminSettings && (user.role === "admin" || user.is_admin)) {
      return (
        <Suspense fallback={<PageLoading />}>
          <AdminSettings token={token} user={user} onBack={handleBackFromAdmin} />
        </Suspense>
      );
    }

    // Show subjects view
    if (selectedClass && showSubjects) {
      return (
        <Suspense fallback={<PageLoading />}>
          <SubjectsView classData={selectedClass} token={token} onBack={handleBackToClass} />
        </Suspense>
      );
    }

    // Show student result page (formatted sheet)
    if (selectedClass && selectedStudent && showResultPage && resultPageData) {
      return (
        <Suspense fallback={<PageLoading />}>
          <StudentResultPage
            student={selectedStudent}
            className={selectedClass.name}
            classNameArabic={selectedClass.name_arabic}
            subjects={resultPageData.subjects}
            results={resultPageData.results}
            term={resultPageData.term}
            academicYear={resultPageData.academicYear}
            onBack={handleBackToResultsForm}
          />
        </Suspense>
      );
    }

    // Show student results form
    if (selectedClass && selectedStudent) {
      return (
        <Suspense fallback={<PageLoading />}>
          <StudentResultsForm
            student={selectedStudent}
            className={selectedClass.name}
            token={token}
            onBack={handleBackToClass}
            onViewResult={handleShowResultPage}
          />
        </Suspense>
      );
    }

    // Show class detail
    if (selectedClass) {
      return (
        <Suspense fallback={<PageLoading />}>
          <ClassDetail
            classData={selectedClass}
            token={token}
            userRole={user?.role}
            onBack={handleBackToDashboard}
            onStudentResults={handleStudentResults}
            onSubjects={handleShowSubjects}
          />
        </Suspense>
      );
    }

    // Show dashboard
    return (
      <Suspense fallback={<PageLoading />}>
        <TeacherDashboard
          user={user}
          token={token}
          onLogout={handleLogoutFromPortal}
          onSelectClass={handleSelectClass}
          onAdminSettings={handleGoToAdmin}
        />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans flex flex-col antialiased">
      {/* Reading Progress Bar — fixed above the header, fills as you scroll */}
      <motion.div
        style={{ scaleX: progressScaleX }}
        className="fixed top-0 left-0 right-0 h-1 origin-left bg-secondary z-[45] pointer-events-none"
        aria-hidden="true"
      />

      {/* Dynamic Navigation Header */}
      <Header
        currentScreen={currentScreen}
        onScreenChange={handleScreenChange}
        onStudentPortal={handleOpenStudentLogin}
        onTeacherPortal={handleOpenTeacherLogin}
        onAdminPortal={handleOpenAdminLogin}
      />

      {/* Main Interactive Screen Content — all public sections on one page */}
      <main className="flex-1 pt-16 flex flex-col">
        <HomeTab onScreenChange={handleScreenChange} />
        <WelcomeSection />
        <AdmissionsTab />
        <CalendarSection />
        <MadrasahActivitiesTab />
        <FAQSection />
        <GallerySection />
      </main>

      {/* Universal Footer */}
      <Footer
        onScreenChange={handleScreenChange}
        onStudentPortal={handleOpenStudentLogin}
        onTeacherPortal={handleOpenTeacherLogin}
        onAdminPortal={handleOpenAdminLogin}
      />

      {/* Floating Overlays (positioned fixed, outside layout flow) */}
      <Suspense fallback={null}>
        <Chatbot />
      </Suspense>
      <WhatsAppWidget />
      {/* Style Inspector + Style Editor — only when Edit Mode is enabled (admin only) */}
      {editModeOn && (user?.role === "admin" || user?.is_admin) && (
        <Suspense fallback={null}>
          <ContentInspector />
          <SpacingGuide />
        </Suspense>
      )}

      {/* Sticky Apply Now Button */}
      <AnimatePresence>
        {showApply && (
          <motion.button
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              const el = document.getElementById("apply-form-section");
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              else window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-secondary hover:bg-secondary-hover text-white px-7 py-3.5 rounded-full font-bold text-sm uppercase tracking-wider shadow-xl shadow-black/25 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <GraduationCap className="w-4 h-4" />
            {siteContent.admissions_apply_button_text || "Apply / Send Inquiry"}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Floating Scroll-to-Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-6 left-6 z-50 w-12 h-12 rounded-full bg-primary text-white shadow-lg shadow-black/20 hover:bg-secondary hover:scale-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
            aria-label="Scroll to top"
          >
            <ArrowUp className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
