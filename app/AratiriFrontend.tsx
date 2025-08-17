"use client";
import { useEffect, useState } from "react";
import { ForgotPasswordScreen } from "./components/auth/ForgotPasswordScreen";
import { LoginScreen } from "./components/auth/LoginScreen";
import { RegisterScreen } from "./components/auth/RegisterScreen";
import { Dashboard } from "./components/dashboard/Dashboard";
import { ThemeProvider } from "./hooks/useTheme";

const decodeJwt = (token: string): { exp: number } | null => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    return null;
  }
};

export default function AratiriFrontend() {
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginMessage, setLoginMessage] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem("aratiri_accessToken");
    if (storedToken) {
      const decodedToken = decodeJwt(storedToken);
      if (decodedToken && decodedToken.exp * 1000 > Date.now()) {
        setToken(storedToken);
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem("aratiri_accessToken");
        localStorage.removeItem("aratiri_refreshToken");
        setLoginMessage("Your session has expired. Please log in again.");
      }
    }

    const message = sessionStorage.getItem("login-message");
    if (message) {
      setLoginMessage(message);
      sessionStorage.removeItem("login-message");
    }

    const handleForceLogout = () => {
      setToken(null);
      setIsAuthenticated(false);
    };

    window.addEventListener("force-logout", handleForceLogout);

    return () => {
      window.removeEventListener("force-logout", handleForceLogout);
    };
  }, []);

  return (
    <ThemeProvider>
      {isAuthenticated ? (
        <Dashboard
          setToken={setToken}
          setIsAuthenticated={setIsAuthenticated}
        />
      ) : showRegister ? (
        <RegisterScreen
          setToken={setToken}
          setIsAuthenticated={setIsAuthenticated}
          setShowRegister={setShowRegister}
        />
      ) : showForgotPassword ? (
        <ForgotPasswordScreen setShowForgotPassword={setShowForgotPassword} />
      ) : (
        <LoginScreen
          setToken={setToken}
          setIsAuthenticated={setIsAuthenticated}
          initialMessage={loginMessage}
          setShowRegister={setShowRegister}
          setShowForgotPassword={setShowForgotPassword}
        />
      )}
    </ThemeProvider>
  );
}
