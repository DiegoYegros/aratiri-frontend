"use client";

import { useCallback } from "react";
import { useLanguage } from "../LanguageProvider";
import { LanguageCode, translations } from "../lib/translations";

type TranslationParams = Record<string, string | number>;
export type TranslateFn = (key: string, params?: TranslationParams) => string;

const translate = (
  language: LanguageCode,
  key: string,
  params?: TranslationParams
): string => {
  const dictionary = translations[language] || translations.en;
  const fallback = translations.en[key] || key;
  const template = dictionary[key] || fallback;

  if (!params) {
    return template;
  }

  return Object.entries(params).reduce((result, [paramKey, value]) => {
    const regex = new RegExp(`\\{${paramKey}\\}`, "g");
    return result.replace(regex, String(value));
  }, template);
};

export const useTranslation = (): TranslateFn => {
  const { language } = useLanguage();

  return useCallback(
    (key: string, params?: TranslationParams) => translate(language, key, params),
    [language]
  );
};
