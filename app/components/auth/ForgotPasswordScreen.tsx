"use client";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { apiCall } from "../../lib/api";
import { useTranslation } from "@/app/hooks/useTranslation";
import { AuthShell } from "../ui/AuthShell";
import { Alert } from "../ui/Alert";
import { IconButton } from "../ui/IconButton";

const fieldClass =
  "w-full px-4 py-3 bg-input border border-panel-edge rounded-lg text-foreground placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition touch-manipulation";

export const ForgotPasswordScreen = ({
  setShowForgotPassword,
}: {
  setShowForgotPassword: (show: boolean) => void;
}) => {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isVerification, setIsVerification] = useState(false);
  const [success, setSuccess] = useState("");
  const t = useTranslation();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await apiCall("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setIsVerification(true);
      setSuccess(t("A password reset code has been sent to your email."));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await apiCall("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email, code, newPassword }),
      });
      setSuccess(
        t("Password has been reset successfully. You can now log in.")
      );
      setTimeout(() => {
        setShowForgotPassword(false);
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      variant="form"
      subtitle={t("Bitcoin Lightning Wallet")}
      railTitle={t("Reset your password")}
      topLeft={
        <IconButton
          label={t("Back")}
          onClick={() =>
            isVerification
              ? setIsVerification(false)
              : setShowForgotPassword(false)
          }
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </IconButton>
      }
    >
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {!isVerification ? (
        <form onSubmit={handleForgotPassword} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="forgot-email" className="block text-sm text-muted-strong">
              {t("Email")}
            </label>
            <input
              id="forgot-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("Enter your email")}
              className={fieldClass}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-11 bg-accent text-accent-fg font-semibold py-3 px-4 rounded-lg hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 transition touch-manipulation"
          >
            {loading ? t("Sending...") : t("Send Reset Code")}
          </button>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="forgot-code" className="block text-sm text-muted-strong">
              {t("Verification Code")}
            </label>
            <input
              id="forgot-code"
              name="code"
              type="text"
              autoComplete="one-time-code"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={fieldClass}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="forgot-new-password"
              className="block text-sm text-muted-strong"
            >
              {t("New Password")}
            </label>
            <input
              id="forgot-new-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={fieldClass}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-11 bg-accent text-accent-fg font-semibold py-3 px-4 rounded-lg hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 transition touch-manipulation"
          >
            {loading ? t("Resetting...") : t("Reset Password")}
          </button>
        </form>
      )}
    </AuthShell>
  );
};
