"use client";
import { ArrowLeft, Zap } from "lucide-react";
import { useState } from "react";
import { apiCall } from "../../lib/api";

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
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
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 font-sans">
      <div className="relative w-full max-w-md bg-secondary rounded-2xl shadow-lg p-8 space-y-6 border border-border/20">
        <button
          onClick={() =>
            isVerification ? setIsVerification(false) : setShowRegister(false)
          }
          className="absolute top-4 left-4 p-2 text-secondary-foreground hover:text-foreground"
        >
          <ArrowLeft />
        </button>

        <div className="text-center">
          <Zap className="w-16 h-16 text-primary mx-auto mb-4 animate-pulse" />
          <h1 className="text-4xl font-bold">Aratiri</h1>
          <p className="text-secondary-foreground">
            {isVerification
              ? "Enter verification code"
              : "Create a new account"}
          </p>
        </div>

        {error && (
          <div className="bg-destructive/20 border border-destructive text-destructive-foreground px-4 py-3 rounded-lg text-center">
            {error}
          </div>
        )}

        {!isVerification ? (
          <form onSubmit={handleRegister} className="space-y-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition"
              required
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition"
              required
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm Password"
              className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition"
              required
            />
            <input
              type="text"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="Alias"
              className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground font-bold py-3 px-4 rounded-lg hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-secondary disabled:opacity-50 transition"
            >
              {loading ? "Registering..." : "Register"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Verification Code"
              className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground font-bold py-3 px-4 rounded-lg hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-secondary disabled:opacity-50 transition"
            >
              {loading ? "Verifying..." : "Verify"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
