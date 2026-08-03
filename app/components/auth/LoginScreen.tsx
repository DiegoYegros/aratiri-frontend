"use client";
import { Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { apiCall } from "../../lib/api";
import GoogleLogin from "./GoogleLogin";
import { useTranslation } from "@/app/hooks/useTranslation";
import { AuthShell } from "../ui/AuthShell";
import { Alert } from "../ui/Alert";

const fieldClass =
  "w-full min-h-11 px-3 py-2.5 bg-input border border-panel-edge rounded-md text-foreground placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition touch-manipulation";

export const LoginScreen = ({
  setToken,
  setIsAuthenticated,
  initialMessage,
  setShowRegister,
  setShowForgotPassword,
  onEnterSpark,
}: {
  setToken: (token: string | null) => void;
  setIsAuthenticated: (auth: boolean) => void;
  initialMessage?: string | null;
  setShowRegister: (show: boolean) => void;
  setShowForgotPassword: (show: boolean) => void;
  onEnterSpark?: () => void;
}) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialMessage || "");
  const t = useTranslation();

  useEffect(() => {
    if (initialMessage) {
      setError(initialMessage);
    }
  }, [initialMessage]);

  const handleSuccessfulLogin = (response: {
    accessToken: string;
    refreshToken: string;
  }) => {
    localStorage.setItem("aratiri_accessToken", response.accessToken);
    localStorage.setItem("aratiri_refreshToken", response.refreshToken);
    setToken(response.accessToken);
    setIsAuthenticated(true);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await apiCall("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      handleSuccessfulLogin(response);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (googleToken: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await apiCall("/auth/sso/google", {
        method: "POST",
        body: googleToken,
        headers: { "Content-Type": "text/plain" },
      });
      handleSuccessfulLogin(response);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const sparkSlot = onEnterSpark ? (
    <button
      type="button"
      onClick={onEnterSpark}
      className="inline-flex min-h-11 items-center justify-center gap-2 text-sm text-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent transition touch-manipulation"
    >
      <Zap className="h-4 w-4 text-accent/80" aria-hidden="true" strokeWidth={1.75} />
      <span>{t("Self-custody with Spark")}</span>
    </button>
  ) : undefined;

  return (
    <AuthShell
      variant="login"
      subtitle={t("Bitcoin Lightning Wallet")}
      railTitle={t("Sign In")}
      sparkSlot={sparkSlot}
    >
      {error && (
        <Alert variant="danger" className="text-sm py-2">
          {error}
        </Alert>
      )}

      <form
        onSubmit={handleLogin}
        className="space-y-3 [@media(min-width:1024px)_and_(max-height:720px)]:space-y-2.5"
      >
        <div className="space-y-1.5">
          <label
            htmlFor="login-username"
            className="block text-xs text-muted-strong"
          >
            {t("Username")}
          </label>
          <input
            id="login-username"
            name="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={fieldClass}
            required
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <label
              htmlFor="login-password"
              className="block text-xs text-muted-strong"
            >
              {t("Password")}
            </label>
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-xs text-accent hover:text-accent-hover min-h-8 inline-flex items-center shrink-0"
            >
              {t("Forgot Password?")}
            </button>
          </div>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={fieldClass}
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-11 bg-accent text-accent-fg font-semibold py-2.5 px-4 rounded-md hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 transition touch-manipulation"
        >
          {loading ? t("Signing In...") : t("Sign In")}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-panel-edge" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-panel px-2 text-muted">{t("OR")}</span>
        </div>
      </div>

      <GoogleLogin
        onSuccess={handleGoogleSuccess}
        onError={(errorMsg) => setError(errorMsg)}
      />

      <div className="pt-1 text-center">
        <button
          type="button"
          onClick={() => setShowRegister(true)}
          className="text-sm text-muted hover:text-accent min-h-9 inline-flex items-center justify-center gap-1 touch-manipulation"
        >
          <span>{t("No account?")}</span>
          <span className="text-accent hover:text-accent-hover font-medium">
            {t("Create one")}
          </span>
        </button>
      </div>
    </AuthShell>
  );
};
