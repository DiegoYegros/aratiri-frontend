"use client";

import { AVAILABLE_LANGUAGES, LanguageCode } from "./lib/translations";
import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  availableLanguages: typeof AVAILABLE_LANGUAGES;
  loading: boolean;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined
);

const STORAGE_KEY = "preferredLanguage";

export const LanguageProvider = ({ children }: PropsWithChildren) => {
  const [language, setLanguageState] = useState<LanguageCode>("en");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedLanguage = localStorage.getItem(STORAGE_KEY) as
      | LanguageCode
      | null;
    if (storedLanguage && AVAILABLE_LANGUAGES.some((l) => l.code === storedLanguage)) {
      setLanguageState(storedLanguage);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((value: LanguageCode) => {
    localStorage.setItem(STORAGE_KEY, value);
    setLanguageState(value);
  }, []);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      availableLanguages: AVAILABLE_LANGUAGES,
      loading,
    }),
    [language, setLanguage, loading]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
};
