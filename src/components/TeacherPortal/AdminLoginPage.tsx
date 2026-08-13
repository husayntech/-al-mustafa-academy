import { useState, FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Shield, Lock, User, Eye, EyeOff, KeyRound } from "lucide-react";
import ForgotPassword from "./ForgotPassword";

interface AdminLoginPageProps {
  onLoginSuccess: (token: string, user: any) => void;
  onBack: () => void;
}

export default function AdminLoginPage({ onLoginSuccess, onBack }: AdminLoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-br from-primary via-primary-container to-primary flex items-center justify-center p-6"
    >
      <div className="w-full max-w-sm">
        <button
          onClick={onBack}
          className="text-white/50 hover:text-white mb-6 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          ← Back to site
        </button>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-secondary/10"
        >
          {/* Header */}
          <div className="bg-primary p-6 text-center relative">
            <div className="w-14 h-14 bg-secondary-fixed/10 rounded-full flex items-center justify-center mx-auto mb-3 border-2 border-secondary/20">
              <Shield className="w-7 h-7 text-secondary-fixed" />
            </div>
            <h1 className="font-serif text-lg font-bold text-white">Admin Portal</h1>
            <p className="text-white/50 text-[10px] mt-1">Authorized Personnel Only</p>
          </div>

          {/* Notice */}
          <div className="bg-yellow-50 border-b border-yellow-100 px-5 py-2.5">
            <p className="text-[10px] text-yellow-700 text-center font-medium">
              🔒 Hidden portal — for staff and administrators only
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                  autoFocus
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
                  <KeyRound className="w-4 h-4 text-secondary-fixed" />
                  Access Admin Portal
                </>
              )}
            </button>

            <div className="text-center">
              <p className="text-[10px] text-on-surface-variant/50">
                Default: admin / admin123
              </p>
              <p className="text-[9px] text-on-surface-variant/30 mt-1">
                Use teacher / teacher123 for teacher access
              </p>
            </div>
          </form>
        </motion.div>
      </div>

      {/* Forgot Password Modal (Gmail-linked) */}
      <AnimatePresence>
        {showForgot && <ForgotPassword onBack={() => setShowForgot(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}
