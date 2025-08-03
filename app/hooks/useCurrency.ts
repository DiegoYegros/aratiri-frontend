"use client";
import { useCallback, useEffect, useState } from "react";
import { apiCall } from "../lib/api";

export const useCurrency = () => {
  const [selectedCurrency, setSelectedCurrencyState] = useState<string>("usd");
  const [availableCurrencies, setAvailableCurrencies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const initializeCurrency = async () => {
      try {
        const currencies = await apiCall("/general-data/currencies");
        if (currencies && Array.isArray(currencies)) {
          setAvailableCurrencies(currencies);
        }
        const storedCurrency = localStorage.getItem("preferredCurrency");
        if (storedCurrency && currencies.includes(storedCurrency)) {
          setSelectedCurrencyState(storedCurrency);
        }
      } catch (error) {
        console.error("Failed to fetch available currencies:", error);
        setAvailableCurrencies(["usd", "pyg", "ars", "eur"]);
      } finally {
        setLoading(false);
      }
    };

    initializeCurrency();
  }, []);

  const setSelectedCurrency = useCallback((currency: string) => {
    localStorage.setItem("preferredCurrency", currency);
    setSelectedCurrencyState(currency);
  }, []);
  return {
    loading,
    selectedCurrency,
    setSelectedCurrency,
    availableCurrencies,
  };
};
