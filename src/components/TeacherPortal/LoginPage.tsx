import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { LogIn, School, Lock, User, Eye, EyeOff, Clock, Calendar, KeyRound } from "lucide-react";
import ForgotPassword from "./ForgotPassword";

interface LoginPageProps {
  onLoginSuccess: (token: string, user: any) => void;
  onBack: () => void;
}

export default function LoginPage({ onLoginSuccess, onBack }: LoginPageProps) {
  const [loginMode, setLoginMode] = useState<"credentials" | "class">("class");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  // Class login state
  const [lastName, setLastName] = useState("");
  const [className, setClassName] = useState("");

  const currentTime = new Date();
  const timeStr = currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = currentTime.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const handleSubmitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Please enter both username and password");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, remember }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("loginTime", new Date().toISOString());
      onLoginSuccess(data.token, data.user);
    } catch (err) {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitClassLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!lastName.trim()) {
      setError("Please enter your last name");
      return;
    }
    if (!className.trim()) {
      setError("Please enter your class name");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/teacher-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ last_name: lastName.trim(), class_name: className.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("loginTime", new Date().toISOString());
      onLoginSuccess(data.token, data.user);
    } catch (err) {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-br from-primary via-primary-container to-primary flex items-center justify-center p-6"
    >
      <div className="w-full max-w-md">
        {/* Back button */}
        <button
          onClick={onBack}
          className="text-white/70 hover:text-white mb-6 text-sm flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          ← Back to Home
        </button>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-primary p-6 text-center relative">
            <div className="w-16 h-16 bg-secondary-container/20 rounded-full flex items-center justify-center mx-auto mb-3 border-2 border-secondary/30">
              <School className="w-8 h-8 text-secondary-fixed" />
            </div>
            <h1 className="font-serif text-xl font-bold text-white">Teacher Portal</h1>
            <p className="text-white/70 text-xs mt-1">Al Mustafa Academy</p>
          </div>

          {/* Session Time Display */}
          <div className="bg-secondary-fixed/10 border-b border-primary/5 px-6 py-3 text-center">
            <div className="flex items-center justify-center gap-4 text-xs text-on-surface-variant">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-secondary" />
                {dateStr}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-secondary" />
                {timeStr}
              </span>
            </div>
          </div>

          {/* Login Mode Toggle */}
          <div className="px-6 pt-4">
            <div className="flex bg-surface rounded-lg p-1">
              <button
                type="button"
                onClick={() => { setLoginMode("class"); setError(""); }}
                className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  loginMode === "class"
                    ? "bg-primary text-white shadow"
                    : "text-on-surface-variant hover:text-primary"
                }`}
              >
                Class Login
              </button>
              <button
                type="button"
                onClick={() => { setLoginMode("credentials"); setError(""); }}
                className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  loginMode === "credentials"
                    ? "bg-primary text-white shadow"
                    : "text-on-surface-variant hover:text-primary"
                }`}
              >
                Username/Password
              </button>
            </div>
          </div>

          {/* Class Login Form */}
          {loginMode === "class" && (
            <form onSubmit={handleSubmitClassLogin} className="p-6 space-y-5">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-2.5 rounded-lg"
                >
                  {error}
                </motion.div>
              )}

              <div>
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                  Last Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Enter your last name"
                    className="w-full bg-surface border border-primary/20 pl-10 pr-3 py-3 text-sm rounded-lg focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/30 transition-all"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                  Class Name (English)
                </label>
                <div className="relative">
                  <School className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
                  <input
                    type="text"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    placeholder="e.g. Al-Awwal Al-Idadi"
                    className="w-full bg-surface border border-primary/20 pl-10 pr-3 py-3 text-sm rounded-lg focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/30 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary-container text-white py-3.5 rounded-lg font-bold text-xs uppercase tracking-widest transition-all duration-200 hover:shadow-lg disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 text-secondary-fixed" />
                    Sign In to Class
                  </>
                )}
              </button>

              <p className="text-[10px] text-on-surface-variant/60 text-center mt-4">
                Enter your last name and the class you teach (in English)
              </p>
            </form>
          )}

          {/* Credentials Login Form */}
          {loginMode === "credentials" && (
            <form onSubmit={handleSubmitCredentials} className="p-6 space-y-5">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-2.5 rounded-lg"
                >
                  {error}
                </motion.div>
              )}                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                    Username
                  </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
                  <input
                    type="text"
                    name="username"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    className="w-full bg-surface border border-primary/20 pl-10 pr-3 py-3 text-sm rounded-lg focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/30 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full bg-surface border border-primary/20 pl-10 pr-10 py-3 text-sm rounded-lg focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/30 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 hover:text-on-surface-variant cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="w-4 h-4 accent-secondary cursor-pointer"
                  />
                  <span className="text-on-surface-variant">Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="text-secondary font-semibold hover:text-primary underline underline-offset-2 cursor-pointer flex items-center gap-1"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary-container text-white py-3.5 rounded-lg font-bold text-xs uppercase tracking-widest transition-all duration-200 hover:shadow-lg disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 text-secondary-fixed" />
                    Sign In to Portal
                  </>
                )}
              </button>

              <p className="text-[10px] text-on-surface-variant/60 text-center mt-4">
                Tick "Remember me" to stay signed in for 30 days — your browser can save the password too.
              </p>
            </form>
          )}
        </motion.div>
      </div>

      {/* Forgot Password Modal (Gmail-linked) */}
      <AnimatePresence>
        {showForgot && <ForgotPassword onBack={() => setShowForgot(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}
