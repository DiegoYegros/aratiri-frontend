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

export const RegisterScreen = ({
  setToken,
  setIsAuthenticated,
  setShowRegister,
}: {
  setToken: (token: string | null) => void;
  setIsAuthenticated: (auth: boolean) => void;
  setShowRegister: (show: boolean) => void;
}) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [alias, setAlias] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isVerification, setIsVerification] = useState(false);
  const t = useTranslation();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError(t("Passwords do not match."));
      return;
    }
    setLoading(true);
    setError("");
    try {
      await apiCall("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password, alias }),
      });
      setIsVerification(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await apiCall("/auth/verify", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      localStorage.setItem("aratiri_accessToken", response.accessToken);
      localStorage.setItem("aratiri_refreshToken", response.refreshToken);
      setToken(response.accessToken);
      setIsAuthenticated(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      subtitle={
        isVerification
          ? t("Enter verification code")
          : t("Create a new account")
      }
      topLeft={
        <div className="absolute top-3 left-3 z-10">
          <IconButton
            label={t("Back")}
            onClick={() =>
              isVerification
                ? setIsVerification(false)
                : setShowRegister(false)
            }
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </IconButton>
        </div>
      }
    >
      {error && <Alert variant="danger">{error}</Alert>}

      {!isVerification ? (
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="register-name" className="block text-sm text-muted-strong">
              {t("Name")}
            </label>
            <input
              id="register-name"
              name="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={fieldClass}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="register-email" className="block text-sm text-muted-strong">
              {t("Email")}
            </label>
            <input
              id="register-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="register-password" className="block text-sm text-muted-strong">
              {t("Password")}
            </label>
            <input
              id="register-password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={fieldClass}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="register-confirm-password"
              className="block text-sm text-muted-strong"
            >
              {t("Confirm Password")}
            </label>
            <input
              id="register-confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={fieldClass}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="register-alias" className="block text-sm text-muted-strong">
              {t("Alias")}
            </label>
            <input
              id="register-alias"
              name="alias"
              type="text"
              autoComplete="nickname"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              className={fieldClass}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-11 bg-accent text-accent-fg font-semibold py-3 px-4 rounded-lg hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 transition touch-manipulation"
          >
            {loading ? t("Registering...") : t("Register")}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="register-code" className="block text-sm text-muted-strong">
              {t("Verification Code")}
            </label>
            <input
              id="register-code"
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
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-11 bg-accent text-accent-fg font-semibold py-3 px-4 rounded-lg hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 transition touch-manipulation"
          >
            {loading ? t("Verifying...") : t("Verify")}
          </button>
        </form>
      )}
    </AuthShell>
  );
};
