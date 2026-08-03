"use client";
import { useCallback, useEffect, useState } from "react";
import { publicApiGet } from "../lib/api";

export const useCurrency = () => {
  const [selectedCurrency, setSelectedCurrencyState] = useState<string>("usd");
  const [availableCurrencies, setAvailableCurrencies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const initializeCurrency = async () => {
      try {
        const currencies = await publicApiGet<string[]>(
          "/general-data/currencies"
        );
        if (currencies && Array.isArray(currencies)) {
          setAvailableCurrencies(currencies);
        }
        const storedCurrency = localStorage.getItem("preferredCurrency");
        if (storedCurrency && currencies.includes(storedCurrency)) {
          setSelectedCurrencyState(storedCurrency);
        }
      } catch {
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
