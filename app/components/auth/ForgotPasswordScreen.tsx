"use client";
import { ArrowLeft, Zap } from "lucide-react";
import { useState } from "react";
import { apiCall } from "../../lib/api";

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
      setSuccess("A password reset code has been sent to your email.");
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
      setSuccess("Password has been reset successfully. You can now log in.");
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
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 font-sans">
      <div className="relative w-full max-w-md bg-secondary rounded-2xl shadow-lg p-8 space-y-6 border border-border/20">
        <button
          onClick={() =>
            isVerification
              ? setIsVerification(false)
              : setShowForgotPassword(false)
          }
          className="absolute top-4 left-4 p-2 text-secondary-foreground hover:text-foreground"
        >
          <ArrowLeft />
        </button>
        <div className="text-center">
          <Zap className="w-16 h-16 text-primary mx-auto mb-4 animate-pulse" />
          <h1 className="text-4xl font-bold">Aratiri</h1>
          <p className="text-secondary-foreground">Reset your password</p>
        </div>

        {error && (
          <div className="bg-destructive/20 border border-destructive text-destructive-foreground px-4 py-3 rounded-lg text-center">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-success/20 border border-success text-success-foreground px-4 py-3 rounded-lg text-center">
            {success}
          </div>
        )}

        {!isVerification ? (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground font-bold py-3 px-4 rounded-lg hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-secondary disabled:opacity-50 transition"
            >
              {loading ? "Sending..." : "Send Reset Code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Verification Code"
              className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition"
              required
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New Password"
              className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground font-bold py-3 px-4 rounded-lg hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-secondary disabled:opacity-50 transition"
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
