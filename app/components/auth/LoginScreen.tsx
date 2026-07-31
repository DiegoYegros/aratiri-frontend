"use client";
import { useEffect, useState } from "react";
import { apiCall } from "../../lib/api";
import GoogleLogin from "./GoogleLogin";
import { useTranslation } from "@/app/hooks/useTranslation";
import { AuthShell } from "../ui/AuthShell";
import { Alert } from "../ui/Alert";

const fieldClass =
  "w-full px-4 py-3 bg-input border border-panel-edge rounded-lg text-foreground placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition touch-manipulation";

export const LoginScreen = ({
  setToken,
  setIsAuthenticated,
  initialMessage,
  setShowRegister,
  setShowForgotPassword,
}: {
  setToken: (token: string | null) => void;
  setIsAuthenticated: (auth: boolean) => void;
  initialMessage?: string | null;
  setShowRegister: (show: boolean) => void;
  setShowForgotPassword: (show: boolean) => void;
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

  return (
    <AuthShell subtitle={t("Bitcoin Lightning Wallet")}>
      {error && <Alert variant="danger">{error}</Alert>}

      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="login-username" className="block text-sm text-muted-strong">
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
          <label htmlFor="login-password" className="block text-sm text-muted-strong">
            {t("Password")}
          </label>
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
        <div className="text-right">
          <button
            type="button"
            onClick={() => setShowForgotPassword(true)}
            className="text-sm text-accent hover:text-accent-hover min-h-11 inline-flex items-center"
          >
            {t("Forgot Password?")}
          </button>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-11 bg-accent text-accent-fg font-semibold py-3 px-4 rounded-lg hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 transition touch-manipulation"
        >
          {loading ? t("Signing In...") : t("Sign In")}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-panel-edge" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-panel px-2 text-muted">{t("OR")}</span>
        </div>
      </div>

      <GoogleLogin
        onSuccess={handleGoogleSuccess}
        onError={(errorMsg) => setError(errorMsg)}
      />
      <div className="text-center">
        <button
          type="button"
          onClick={() => setShowRegister(true)}
          className="text-accent hover:text-accent-hover min-h-11 inline-flex items-center"
        >
          {t("Create new account")}
        </button>
      </div>
    </AuthShell>
  );
};
