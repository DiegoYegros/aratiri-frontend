"use client";
import { useTheme } from "@/app/hooks/useTheme";
import { Loader } from "lucide-react";

interface SettingsTabProps {
  selectedCurrency: string;
  setSelectedCurrency: (currency: string) => void;
  availableCurrencies: string[];
  loading: boolean;
}

export const SettingsTab = ({
  selectedCurrency,
  setSelectedCurrency,
  availableCurrencies,
  loading,
}: SettingsTabProps) => {
  const { theme, setTheme } = useTheme();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Settings</h2>
      <div className="space-y-6">
        <div className="bg-secondary/50 p-4 rounded-lg">
          <label
            htmlFor="theme-select"
            className="block text-sm font-medium text-secondary-foreground mb-2"
          >
            Theme
          </label>
          <select
            id="theme-select"
            value={theme}
            onChange={(e) => setTheme(e.target.value as any)}
            className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition"
          >
            <option value="Aratiri">Aratiri</option>
            <option value="Bitcoin">Bitcoin</option>
            <option value="Default">Default</option>
          </select>
          <p className="text-xs text-secondary-foreground mt-2">
            Choose a visual theme for the application.
          </p>
        </div>

        <div className="bg-secondary/50 p-4 rounded-lg">
          <label
            htmlFor="currency-select"
            className="block text-sm font-medium text-secondary-foreground mb-2"
          >
            Preferred Currency
          </label>
          <select
            id="currency-select"
            value={selectedCurrency}
            onChange={(e) => setSelectedCurrency(e.target.value)}
            className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition"
          >
            {availableCurrencies.map((currency) => (
              <option key={currency} value={currency}>
                {currency.toUpperCase()}
              </option>
            ))}
          </select>
          <p className="text-xs text-secondary-foreground mt-2">
            The selected currency will be used to show equivalent values in the
            application.
          </p>
        </div>
      </div>
    </div>
  );
};
