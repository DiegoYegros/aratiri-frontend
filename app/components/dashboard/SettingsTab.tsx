"use client";
import { Loader } from "lucide-react";
import { useLanguage } from "@/app/LanguageProvider";
import { LanguageCode } from "@/app/lib/translations";
import { useTranslation } from "@/app/hooks/useTranslation";

interface SettingsTabProps {
  selectedCurrency: string;
  setSelectedCurrency: (currency: string) => void;
  availableCurrencies: string[];
  loading: boolean;
}

const selectClass =
  "w-full min-h-11 px-4 py-3 bg-input border border-panel-edge rounded-lg text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition";

export const SettingsTab = ({
  selectedCurrency,
  setSelectedCurrency,
  availableCurrencies,
  loading,
}: SettingsTabProps) => {
  const t = useTranslation();
  const {
    language,
    setLanguage,
    availableLanguages,
    loading: languageLoading,
  } = useLanguage();

  if (loading || languageLoading) {
    return (
      <div
        className="flex justify-center items-center py-10"
        role="status"
        aria-label={t("Loading settings")}
      >
        <Loader className="animate-spin text-accent" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border border-panel-edge rounded-lg p-4">
        <label
          htmlFor="currency-select"
          className="block text-sm font-medium text-muted-strong mb-2"
        >
          {t("Preferred Currency")}
        </label>
        <select
          id="currency-select"
          value={selectedCurrency}
          onChange={(e) => setSelectedCurrency(e.target.value)}
          className={selectClass}
        >
          {availableCurrencies.map((currency) => (
            <option key={currency} value={currency}>
              {currency.toUpperCase()}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted mt-2">
          {t(
            "The selected currency will be used to show equivalent values in the application."
          )}
        </p>
      </div>
      <div className="border border-panel-edge rounded-lg p-4">
        <label
          htmlFor="language-select"
          className="block text-sm font-medium text-muted-strong mb-2"
        >
          {t("Language")}
        </label>
        <select
          id="language-select"
          value={language}
          onChange={(event) =>
            setLanguage(event.target.value as LanguageCode)
          }
          className={selectClass}
        >
          {availableLanguages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {t(lang.labelKey)}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted mt-2">
          {t(
            "Choose the interface language. Changes take effect immediately."
          )}
        </p>
      </div>
    </div>
  );
};
