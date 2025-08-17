"use client";
import { Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { apiCall } from "../../lib/api";
import GoogleLogin from "./GoogleLogin";

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
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-secondary rounded-2xl shadow-lg p-8 space-y-6 border border-border/20">
        <div className="text-center">
          <Zap className="w-16 h-16 text-primary mx-auto mb-4 animate-pulse" />
          <h1 className="text-4xl font-bold">Aratiri</h1>
          <p className="text-gray-400">Bitcoin Lightning Wallet</p>
        </div>

        {error && (
          <div className="bg-primary/20 border border-primary text-primary-foreground px-4 py-3 rounded-lg text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition"
            required
          />
          <div className="text-right">
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm text-primary hover:text-accent"
            >
              Forgot Password?
            </button>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground font-bold py-3 px-4 rounded-lg hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-secondary disabled:opacity-50 transition"
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-700" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-secondary px-2 text-gray-500">OR</span>
          </div>
        </div>

        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={(errorMsg) => setError(errorMsg)}
        />
        <div className="text-center">
          <button
            onClick={() => setShowRegister(true)}
            className="text-primary hover:text-accent"
          >
            Create new account
          </button>
        </div>
        <div className="absolute bottom-4 right-4 text-xs text-gray-500">
          v0.1.0
        </div>
      </div>
    </div>
  );
};
