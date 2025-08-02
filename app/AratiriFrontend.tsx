"use client";
import { useEffect, useState } from "react";
import { LoginScreen } from "./components/auth/LoginScreen";
import { Dashboard } from "./components/dashboard/Dashboard";

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem("aratiri_token");
    if (storedToken) {
      setToken(storedToken);
      setIsAuthenticated(true);
    }
  }, []);

  return (
    <>
      {!isAuthenticated ? (
        <LoginScreen
          setToken={setToken}
          setIsAuthenticated={setIsAuthenticated}
        />
      ) : (
        <Dashboard
          setToken={setToken}
          setIsAuthenticated={setIsAuthenticated}
        />
      )}
    </>
  );
}
