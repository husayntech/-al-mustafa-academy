import { useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { Mail, KeyRound, Eye, EyeOff, ArrowLeft, CheckCircle, Loader2 } from "lucide-react";

interface ForgotPasswordProps {
  onBack: () => void;
}

/**
 * Gmail-linked password reset flow for staff accounts.
 * Step 1: enter username/email → a 6-digit code is emailed to the linked Gmail.
 * Step 2: enter the code + a new password to finish the reset.
 */
export default function ForgotPassword({ onBack }: ForgotPasswordProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSendCode = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setDevCode(null);
    if (!identifier.trim()) {
      setMessage({ type: "error", text: "Please enter your username or email" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Something went wrong" });
      } else if (data.noEmail && !data.devCode) {
        setMessage({
          type: "error",
          text: "No email (Gmail) is linked to this account. Please contact the administrator to reset your password.",
        });
      } else {
        setMessage({
          type: "success",
          text: data.devCode
            ? "Dev mode (email not configured): use the code shown below."
            : data.message || "If that account exists, a reset code has been sent to its email.",
        });
        if (data.devCode) setDevCode(data.devCode);
        setStep(2);
      }
    } catch {
      setMessage({ type: "error", text: "Connection error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!code.trim()) {
      setMessage({ type: "error", text: "Please enter the reset code" });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: "error", text: "New password must be at least 6 characters" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), code: code.trim(), new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed to reset password" });
      } else {
        setMessage({ type: "success", text: data.message || "Password reset successfully!" });
        setTimeout(onBack, 1800);
      }
    } catch {
      setMessage({ type: "error", text: "Connection error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onBack}
        className="absolute inset-0 bg-black/50 backdrop-blur-xs cursor-pointer"
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative z-10 bg-white rounded-2xl shadow-2xl border border-primary/10 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-serif text-lg font-bold text-primary flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-secondary" />
            Forgot Password
          </h3>
          <button onClick={onBack} className="p-1 hover:bg-surface-container rounded-lg cursor-pointer">
            <ArrowLeft className="w-4 h-4 text-on-surface-variant" />
          </button>
        </div>

        <div className="flex gap-1.5 mb-5">
          {[1, 2].map((s) => (
            <div key={s} className={`flex-1 h-1.5 rounded-full transition-colors ${step >= s ? "bg-secondary" : "bg-surface-container"}`} />
          ))}
        </div>

        {message && (
          <div className={`text-xs px-4 py-2.5 rounded-lg mb-4 flex items-start gap-2 ${
            message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
          }`}>
            {message.type === "success" ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : null}
            <span>{message.text}</span>
          </div>
        )}

        {devCode && (
          <div className="text-center bg-secondary-fixed/10 border border-secondary/30 rounded-xl py-4 mb-4">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1.5">Your reset code</p>
            <p className="text-3xl font-bold tracking-[0.3em] text-primary font-mono">{devCode}</p>
            <p className="text-[10px] text-on-surface-variant/60 mt-1.5">Valid for 15 minutes</p>
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSendCode} className="space-y-4">
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Enter your <strong>username</strong> or the <strong>email (Gmail)</strong> linked to your staff account. We'll email you a 6-digit reset code.
            </p>
            <div>
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Username or Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. ibrahim or ibrahim@example.com"
                  className="w-full bg-surface border border-primary/20 pl-10 pr-3 py-3 text-sm rounded-lg focus:outline-none focus:border-secondary transition-all"
                  autoFocus
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-container text-white py-3.5 rounded-lg font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4 text-secondary-fixed" />}
              Send Reset Code
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Enter the <strong>6-digit code</strong> we emailed you, then choose a new password.
            </p>
            <div>
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Reset Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                maxLength={6}
                className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary text-center font-mono text-xl tracking-[0.3em]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full bg-surface border border-primary/20 p-3 pr-10 text-sm rounded-lg focus:outline-none focus:border-secondary font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 hover:text-primary cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Confirm New Password</label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat the new password"
                className="w-full bg-surface border border-primary/20 p-3 text-sm rounded-lg focus:outline-none focus:border-secondary font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-container text-white py-3.5 rounded-lg font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 text-secondary-fixed" />}
              Reset Password
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
