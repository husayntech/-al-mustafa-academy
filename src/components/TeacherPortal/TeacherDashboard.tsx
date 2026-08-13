import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  School, BookOpen, Users, LogOut, Clock, Calendar,
  ChevronRight, GraduationCap, BookCheck, Download, Shield
} from "lucide-react";
import { Class, Session, User } from "../../types";

interface TeacherDashboardProps {
  user: User;
  token: string;
  onLogout: () => void;
  onSelectClass: (classId: number) => void;
  onAdminSettings?: () => void;
}

export default function TeacherDashboard({ user, token, onLogout, onSelectClass, onAdminSettings }: TeacherDashboardProps) {
  const [classes, setClasses] = useState<Class[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [staffCount, setStaffCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchClasses();
    fetchCurrentSession();
    fetchStaffCount();
  }, []);

  const fetchClasses = async () => {
    try {
      const res = await fetch("/api/classes", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setClasses(data.classes || []);
    } catch (err) {
      console.error("Failed to fetch classes:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentSession = async () => {
    try {
      const res = await fetch("/api/session/current", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSession(data.session);
    } catch (err) {
      console.error("Failed to fetch session:", err);
    }
  };

  const fetchStaffCount = async () => {
    try {
      const res = await fetch("/api/staff/count", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setStaffCount(data.count ?? null);
    } catch (err) {
      console.error("Failed to fetch staff count:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error("Logout error:", err);
    }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("loginTime");
    onLogout();
  };

  const loginTime = localStorage.getItem("loginTime");
  const loginDate = loginTime ? new Date(loginTime) : null;

  // Calculate session duration
  const getSessionDuration = () => {
    if (!loginDate) return "";
    const diff = Math.floor((currentTime.getTime() - loginDate.getTime()) / 1000);
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    return `${minutes}m ${seconds}s`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-on-surface-variant">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-background"
    >
      {/* Top Bar */}
      <div className="bg-primary text-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <School className="w-6 h-6 text-secondary-fixed" />
            <div>
              <h1 className="font-serif text-lg font-bold">Teacher Portal</h1>
              <p className="text-white/70 text-xs">Welcome, {user.full_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(user.role === "admin" || Boolean(user.is_admin)) && onAdminSettings && (
              <button
                onClick={onAdminSettings}
                className="flex items-center gap-1.5 text-white/70 hover:text-white text-xs font-medium transition-colors cursor-pointer"
              >
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">Admin</span>
              </button>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-white/70 hover:text-white text-xs font-medium transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Session Info Banner */}
      <div className="bg-gradient-to-r from-secondary-fixed/10 to-secondary-fixed/5 border-b border-primary/5">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-wrap items-center gap-4 sm:gap-8 text-xs text-on-surface-variant">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-secondary" />
              {formatDate(currentTime.toISOString())}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-secondary" />
              Current Time: {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
            {loginDate && (
              <>
                <span className="flex items-center gap-1.5">
                  <LogOut className="w-3.5 h-3.5 text-secondary" />
                  Login: {formatTime(loginDate.toISOString())}
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-primary">
                  <Clock className="w-4 h-4 text-secondary" />
                  Session Duration: {getSessionDuration()}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* My Bio Data */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white border border-primary/5 rounded-xl overflow-hidden shadow-xs mb-8">
          <div className="flex items-center justify-between px-5 py-4 border-b border-primary/5 bg-secondary-fixed/10">
            <h3 className="font-serif font-bold text-primary text-sm flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-secondary" />
              My Bio Data
            </h3>
            <span className="text-[10px] font-bold text-secondary uppercase tracking-wider bg-white border border-secondary/20 px-2.5 py-1 rounded-full">
              {(user.role === "admin" || user.is_admin) ? "Administrator" : "Staff"}
            </span>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider mb-1">Full Name</p>
              <p className="font-semibold text-primary">{user.full_name}</p>
              {(user.first_name || user.middle_name || user.surname) && (
                <p className="text-[10px] text-on-surface-variant/60 mt-0.5">
                  {[user.surname, user.first_name, user.middle_name].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            <div>
              <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider mb-1">Username</p>
              <p className="font-semibold text-primary">@{user.username}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider mb-1">Phone</p>
              <p className="font-semibold text-primary">{user.phone || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider mb-1">Email</p>
              <p className="font-semibold text-primary truncate">{user.email || "—"}</p>
            </div>
            {user.address && (
              <div className="sm:col-span-2 lg:col-span-4">
                <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider mb-1">Address</p>
                <p className="font-semibold text-primary">{user.address}</p>
              </div>
            )}
          </div>
        </div>

        <div className="mb-8">
          <h2 className="font-serif text-2xl text-primary font-bold tracking-tight">
            Select a Class
          </h2>
          <p className="text-on-surface-variant text-sm mt-1">
            Choose a class to manage students, enter results, and view subjects
          </p>
        </div>

        {/* Class Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {classes.map((cls, index) => (
            <motion.button
              key={cls.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              onClick={() => onSelectClass(cls.id)}
              className="bg-white border border-primary/10 rounded-xl p-6 text-left hover:shadow-lg hover:border-secondary/30 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
                <GraduationCap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-serif text-lg font-bold text-primary mb-1 group-hover:text-secondary transition-colors">
                {cls.name}
              </h3>
              {cls.name_arabic && (
                <p className="text-lg text-on-surface-variant/60 mb-3 font-serif" dir="rtl">
                  {cls.name_arabic}
                </p>
              )}
              <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  Students
                </span>
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" />
                  Subjects
                </span>
              </div>
              <div className="mt-4 flex items-center gap-1 text-secondary text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                Manage Class <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </motion.button>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white border border-primary/5 rounded-xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-secondary-fixed/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{classes.length}</p>
              <p className="text-xs text-on-surface-variant">Classes</p>
            </div>
          </div>
          <div className="bg-white border border-primary/5 rounded-xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{staffCount ?? "—"}</p>
              <p className="text-xs text-on-surface-variant">Registered Staff</p>
            </div>
          </div>
          <div className="bg-white border border-primary/5 rounded-xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-secondary-fixed/20 flex items-center justify-center">
              <BookCheck className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">3</p>
              <p className="text-xs text-on-surface-variant">Terms</p>
            </div>
          </div>
          <div className="bg-white border border-primary/5 rounded-xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-secondary-fixed/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="text-base font-bold text-primary">{getSessionDuration() || "Active"}</p>
              <p className="text-xs text-on-surface-variant">Session Duration</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
