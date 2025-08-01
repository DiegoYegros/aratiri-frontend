"use client";
import { apiCall } from "@/app/lib/api";
import { Zap } from "lucide-react";
import { useState } from "react";
import GoogleLogin from "./GoogleLogin";

export const LoginScreen = ({ setToken, setIsAuthenticated }: any) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await apiCall("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      localStorage.setItem("aratiri_token", response.token);
      setToken(response.token);
      setIsAuthenticated(true);
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

      localStorage.setItem("aratiri_token", response.token);
      setToken(response.token);
      setIsAuthenticated(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-gray-800 rounded-2xl shadow-lg p-8 space-y-6 border border-yellow-500/20">
        <div className="text-center">
          <Zap className="w-16 h-16 text-yellow-400 mx-auto mb-4 animate-pulse" />
          <h1 className="text-4xl font-bold">Aratiri</h1>
          <p className="text-gray-400">Bitcoin Lightning Wallet</p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-400 text-gray-900 font-bold py-3 px-4 rounded-lg hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 transition"
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-600" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-gray-800 px-2 text-gray-500">OR</span>
          </div>
        </div>

        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={(errorMsg) => setError(errorMsg)}
        />
        <div className="absolute bottom-4 right-4 text-xs text-gray-500">
          v0.1.0
        </div>
      </div>
    </div>
  );
};
