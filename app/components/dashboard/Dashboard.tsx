"use client";
import { useCurrency } from "@/app/hooks/useCurrency";
import {
  ArrowLeft,
  ArrowRight,
  History,
  LogOut,
  QrCode,
  Settings,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNotifier } from "../../hooks/useNotifier";
import { Account, API_BASE_URL, apiCall, Transaction } from "../../lib/api";
import { NotificationToast } from "../ui/NotificationToast";
import { AccountTab } from "./AccountTab";
import { ReceiveTab } from "./ReceiveTab";
import { SendTab } from "./SendTab";
import { SettingsTab } from "./SettingsTab";
import { TransactionsTab } from "./TransactionsTab";
export const Dashboard = ({ setIsAuthenticated, setToken }: any) => {
  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("account");
  const { notifications, addNotification, removeNotification } = useNotifier();

  const {
    selectedCurrency,
    setSelectedCurrency,
    availableCurrencies,
    loading: currencyLoading,
  } = useCurrency();

  const fetchAccountData = useCallback(async () => {
    try {
      const accountData = await apiCall("/accounts/account");
      setAccount(accountData);
    } catch (err: any) {
      setError("Failed to fetch account data: " + err.message);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      const to = new Date();
      const from = new Date();
      from.setDate(to.getDate() - 30);
      const fromDate = from.toISOString().split("T")[0];
      const toDate = to.toISOString().split("T")[0];

      const transData = await apiCall(
        `/accounts/account/transactions?from=${fromDate}&to=${toDate}`
      );
      setTransactions(transData.transactions || []);
    } catch (err: any) {
      setError("Failed to fetch transactions: " + err.message);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError("");
      await Promise.all([fetchAccountData(), fetchTransactions()]);
      setLoading(false);
    };
    loadData();
  }, [fetchAccountData, fetchTransactions]);

  useEffect(() => {
    const token = localStorage.getItem("aratiri_token");
    if (!token) return;

    const controller = new AbortController();

    const connectSse = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/notifications/subscribe`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "text/event-stream",
            },
            signal: controller.signal,
          }
        );

        if (!response.body) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split("\n\n");

          buffer = events.pop() || "";

          for (const eventString of events) {
            if (!eventString.trim()) continue;

            let eventName = "message";
            let eventData = "";
            const lines = eventString.split("\n");
            for (const line of lines) {
              if (line.startsWith("event:")) {
                eventName = line.substring(6).trim();
              } else if (line.startsWith("data:")) {
                eventData += line.substring(5).trim();
              }
            }

            if (eventData && eventName === "payment_received") {
              try {
                const paymentData = JSON.parse(eventData);
                addNotification(
                  "Payment Received",
                  `${paymentData.amountSats.toLocaleString()} sats - ${
                    paymentData.memo || "No description"
                  }`,
                  "success"
                );
                fetchAccountData();
                fetchTransactions();
              } catch (e) {
                console.error("Failed to parse payment data:", e);
              }
            }
          }
        }
      } catch (error: any) {
        if (error.name !== "AbortError") {
          console.error("SSE connection error:", error);
        }
      }
    };

    connectSse();

    return () => {
      controller.abort();
    };
  }, [addNotification, fetchAccountData, fetchTransactions]);

  const logout = () => {
    localStorage.removeItem("aratiri_token");
    setToken("");
    setIsAuthenticated(false);
  };

  const renderContent = () => {
    switch (activeTab) {
      case "account":
        return <AccountTab account={account} />;
      case "send":
        return <SendTab />;
      case "receive":
        return <ReceiveTab />;
      case "transactions":
        return (
          <TransactionsTab
            transactions={transactions}
            currency={selectedCurrency}
          />
        );
      case "settings":
        return (
          <SettingsTab
            selectedCurrency={selectedCurrency}
            setSelectedCurrency={setSelectedCurrency}
            availableCurrencies={availableCurrencies}
            loading={currencyLoading}
          />
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <Zap className="w-16 h-16 text-yellow-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans flex flex-col">
      <div className="fixed top-5 right-5 z-50 space-y-3 w-full max-w-sm">
        {notifications.map((n) => (
          <NotificationToast
            key={n.id}
            notification={n}
            onClose={removeNotification}
          />
        ))}
      </div>
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-yellow-500/20 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Zap className="w-8 h-8 text-yellow-400" />
              <h1 className="text-xl font-bold">Aratiri</h1>
            </div>
            <button
              onClick={logout}
              className="flex items-center text-gray-400 hover:text-white transition-colors"
            >
              <LogOut className="w-5 h-5 mr-2" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <aside className="lg:col-span-1">
            <div className="bg-gray-800 rounded-2xl p-6 space-y-2 border border-yellow-500/10">
              <button
                onClick={() => setActiveTab("account")}
                className={`w-full flex items-center space-x-3 p-3 rounded-lg transition ${
                  activeTab === "account"
                    ? "bg-yellow-400 text-gray-900"
                    : "hover:bg-gray-700"
                }`}
              >
                <QrCode />
                <span>Account</span>
              </button>
              <button
                onClick={() => setActiveTab("receive")}
                className={`w-full flex items-center space-x-3 p-3 rounded-lg transition ${
                  activeTab === "receive"
                    ? "bg-yellow-400 text-gray-900"
                    : "hover:bg-gray-700"
                }`}
              >
                <ArrowLeft />
                <span>Receive</span>
              </button>
              <button
                onClick={() => setActiveTab("send")}
                className={`w-full flex items-center space-x-3 p-3 rounded-lg transition ${
                  activeTab === "send"
                    ? "bg-yellow-400 text-gray-900"
                    : "hover:bg-gray-700"
                }`}
              >
                <ArrowRight />
                <span>Send</span>
              </button>
              <button
                onClick={() => setActiveTab("transactions")}
                className={`w-full flex items-center space-x-3 p-3 rounded-lg transition ${
                  activeTab === "transactions"
                    ? "bg-yellow-400 text-gray-900"
                    : "hover:bg-gray-700"
                }`}
              >
                <History />
                <span>Transactions</span>
              </button>
              <button
                onClick={() => setActiveTab("settings")}
                className={`w-full flex items-center space-x-3 p-3 rounded-lg transition ${
                  activeTab === "settings"
                    ? "bg-yellow-400 text-gray-900"
                    : "hover:bg-gray-700"
                }`}
              >
                <Settings />
                <span>Settings</span>
              </button>
            </div>
          </aside>

          <div className="lg:col-span-3">
            <div className="bg-gray-800 rounded-2xl p-6 sm:p-8 border border-yellow-500/10 min-h-[400px]">
              {renderContent()}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
