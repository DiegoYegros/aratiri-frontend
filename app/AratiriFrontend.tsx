"use client";
import { useEffect, useState } from "react";
import { ForgotPasswordScreen } from "./components/auth/ForgotPasswordScreen";
import { LoginScreen } from "./components/auth/LoginScreen";
import { RegisterScreen } from "./components/auth/RegisterScreen";
import { Dashboard } from "./components/dashboard/Dashboard";
import { SparkProvider } from "./components/spark/SparkProvider";

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
  } catch {
    return null;
  }
};

export default function AratiriFrontend() {
  const [, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [guestSpark, setGuestSpark] = useState(false);
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
        setGuestSpark(false);
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
      // Keep guest Spark shell if already there; otherwise return to login.
      // Spark localStorage is intentionally not cleared.
    };

    window.addEventListener("force-logout", handleForceLogout);

    return () => {
      window.removeEventListener("force-logout", handleForceLogout);
    };
  }, []);

  return (
    <SparkProvider>
      {isAuthenticated ? (
        <Dashboard
          accessMode="full"
          setToken={setToken}
          setIsAuthenticated={(auth: boolean) => {
            setIsAuthenticated(auth);
            if (!auth) setGuestSpark(false);
          }}
        />
      ) : guestSpark ? (
        <Dashboard
          accessMode="spark"
          setToken={setToken}
          setIsAuthenticated={(auth: boolean) => {
            setIsAuthenticated(auth);
            if (auth) setGuestSpark(false);
          }}
          onSignIn={() => setGuestSpark(false)}
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
          onEnterSpark={() => setGuestSpark(true)}
        />
      )}
    </SparkProvider>
  );
}
