"use client";
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
  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader className="animate-spin text-yellow-400" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Settings</h2>
      <div className="space-y-6">
        <div className="bg-gray-700/50 p-4 rounded-lg">
          <label
            htmlFor="currency-select"
            className="block text-sm font-medium text-gray-400 mb-2"
          >
            Preferred Currency
          </label>
          <select
            id="currency-select"
            value={selectedCurrency}
            onChange={(e) => setSelectedCurrency(e.target.value)}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
          >
            {availableCurrencies.map((currency) => (
              <option key={currency} value={currency}>
                {currency.toUpperCase()}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-2">
            The selected currency will be used to show equivalent values in the
            application.
          </p>
        </div>
      </div>
    </div>
  );
};
