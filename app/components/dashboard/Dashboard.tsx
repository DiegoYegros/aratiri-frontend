"use client";
import { useCurrency } from "@/app/hooks/useCurrency";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LogOut,
  Settings,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNotifier } from "../../hooks/useNotifier";
import { Account, API_BASE_URL, apiCall, Transaction } from "../../lib/api";
import { NotificationToast } from "../ui/NotificationToast";
import { ReceiveModal } from "./ReceiveModal";
import { SendModal } from "./SendModal";
import { SettingsTab } from "./SettingsTab";
import { TransactionsTab } from "./TransactionsTab";

export const Dashboard = ({ setIsAuthenticated, setToken }: any) => {
  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { notifications, addNotification, removeNotification } = useNotifier();
  const [balanceVisible, setBalanceVisible] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const {
    selectedCurrency,
    setSelectedCurrency,
    availableCurrencies,
    loading: currencyLoading,
  } = useCurrency();

  const [displayUnit, setDisplayUnit] = useState<"sats" | "fiat" | "btc">(
    "sats"
  );

  const fetchAllData = useCallback(async () => {
    try {
      console.log("Fetching all data...");
      const [accountData, transData] = await Promise.all([
        apiCall("/accounts/account"),
        apiCall(
          `/accounts/account/transactions?from=${
            new Date(new Date().setDate(new Date().getDate() - 30))
              .toISOString()
              .split("T")[0]
          }&to=${new Date().toISOString().split("T")[0]}`
        ),
      ]);
      console.log("Data fetched successfully:", { accountData, transData });
      setAccount(accountData);
      setTransactions(transData.transactions || []);
    } catch (err: any) {
      console.error("Failed to fetch data:", err);
      setError("Failed to fetch data: " + err.message);
    }
  }, []);

  const formatBalance = () => {
    if (!isClient || !account) return "•••••••";
    if (!balanceVisible) return "•••••••";

    const balanceInSats = account.balance;
    switch (displayUnit) {
      case "sats":
        return `${balanceInSats.toLocaleString()}`;
      case "btc":
        return `${(balanceInSats / 100_000_000).toFixed(8)}`;
      case "fiat":
        const fiatValue = account.fiat_equivalents[selectedCurrency];
        if (fiatValue === undefined) return "N/A";
        return `${fiatValue.toLocaleString(undefined, {
          style: "decimal",
          currency: selectedCurrency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      default:
        return `${balanceInSats.toLocaleString()}`;
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError("");
      await fetchAllData();
      setLoading(false);
    };
    loadData();
  }, [fetchAllData]);

  const toggleDisplayUnit = () => {
    const units: ("sats" | "fiat" | "btc")[] = ["sats", "btc", "fiat"];
    const currentIndex = units.indexOf(displayUnit);
    const nextIndex = (currentIndex + 1) % units.length;
    setDisplayUnit(units[nextIndex]);
  };

  const getDisplayUnitLabel = () => {
    if (!balanceVisible) return "";

    return displayUnit === "fiat"
      ? selectedCurrency.toUpperCase()
      : displayUnit;
  };

  const toggleBalanceVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newVisibility = !balanceVisible;
    setBalanceVisible(newVisibility);
    localStorage.setItem("balanceVisible", JSON.stringify(newVisibility));
  };

  useEffect(() => {
    const token = localStorage.getItem("aratiri_accessToken");
    if (!token) return;

    const controller = new AbortController();

    const connectSse = async () => {
      try {
        console.log("Connecting to SSE...");
        const response = await fetch(
          `${API_BASE_URL}/notifications/subscribe`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "text/event-stream",
              "Cache-Control": "no-cache",
            },
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(`SSE connection failed: ${response.status}`);
        }

        if (!response.body) {
          throw new Error("Response body is null");
        }

        console.log("SSE connection established");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log("SSE connection ended");
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");

          buffer = parts.pop() || "";

          for (const part of parts) {
            if (!part.trim()) continue;

            console.log("Raw SSE event:", part);

            const lines = part.split("\n");
            let eventType = "message";
            let data = "";

            for (const line of lines) {
              const colonIndex = line.indexOf(":");
              if (colonIndex === -1) continue;

              const field = line.substring(0, colonIndex).trim();
              const value = line.substring(colonIndex + 1).trim();

              if (field === "event") {
                eventType = value;
              } else if (field === "data") {
                data += value;
              }
            }

            console.log("Parsed event type:", eventType, "data:", data);

            if (eventType === "payment_received" && data) {
              try {
                const paymentData = JSON.parse(data);
                console.log("Payment data received:", paymentData);

                const amountSats =
                  paymentData.amountSats || paymentData.amount || 0;
                const memo =
                  paymentData.memo ||
                  paymentData.description ||
                  "No description";

                addNotification(
                  "Payment Received",
                  `${amountSats.toLocaleString()} sats - ${memo}`,
                  "success"
                );

                console.log("Calling fetchAllData after payment received");
                await fetchAllData();
              } catch (parseError) {
                console.error(
                  "Failed to parse payment data:",
                  parseError,
                  "Raw data:",
                  data
                );
              }
            }
          }
        }
      } catch (error: any) {
        if (error.name !== "AbortError") {
          console.error("SSE connection error:", error);
          setTimeout(() => {
            if (!controller.signal.aborted) {
              console.log("Attempting to reconnect SSE...");
              connectSse();
            }
          }, 5000);
        }
      }
    };

    connectSse();

    return () => {
      console.log("Cleaning up SSE connection");
      controller.abort();
    };
  }, [addNotification, fetchAllData]);

  useEffect(() => {
    const storedVisibility = localStorage.getItem("balanceVisible");
    if (storedVisibility !== null) {
      setBalanceVisible(JSON.parse(storedVisibility));
    }
    setIsClient(true);
  }, []);

  const logout = async () => {
    const refreshToken = localStorage.getItem("aratiri_refreshToken");
    try {
      if (refreshToken) {
        await apiCall("/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch (error) {
      console.error(
        "Logout failed on server, clearing client session anyway:",
        error
      );
    } finally {
      localStorage.removeItem("aratiri_accessToken");
      localStorage.removeItem("aratiri_refreshToken");
      setToken("");
      setIsAuthenticated(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <Zap className="w-16 h-16 text-yellow-400 animate-spin" />
      </div>
    );
  }

  const isBalanceVisible = isClient && balanceVisible;
  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans flex flex-col">
      {/* Modals */}
      {isSendModalOpen && (
        <SendModal
          onClose={() => setIsSendModalOpen(false)}
          onPaymentSent={() => {
            setIsSendModalOpen(false);
            fetchAllData();
          }}
        />
      )}
      {isReceiveModalOpen && (
        <ReceiveModal
          account={account}
          onClose={() => setIsReceiveModalOpen(false)}
        />
      )}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-gray-800 p-6 rounded-2xl w-full max-w-md m-4 border border-yellow-500/20 relative">
            <button
              onClick={() => setIsSettingsModalOpen(false)}
              className="absolute top-2 right-2 p-2 text-gray-400 hover:text-white"
            >
              <X />
            </button>
            <SettingsTab
              selectedCurrency={selectedCurrency}
              setSelectedCurrency={setSelectedCurrency}
              availableCurrencies={availableCurrencies}
              loading={currencyLoading}
            />
          </div>
        </div>
      )}

      {/* Notifications */}
      <div className="fixed top-5 right-5 z-50 space-y-3 w-full max-w-sm">
        {notifications.map((n) => (
          <NotificationToast
            key={n.id}
            notification={n}
            onClose={removeNotification}
          />
        ))}
      </div>

      {/* Header */}
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-yellow-500/20 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Zap className="w-8 h-8 text-yellow-400" />
              <h1 className="text-xl font-bold">Aratiri</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Settings className="w-6 h-6" />
              </button>
              <button
                onClick={logout}
                className="flex items-center text-gray-400 hover:text-white transition-colors"
              >
                <LogOut className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Balance Section */}
        <div className="text-center mb-8">
          <div
            className="flex justify-center items-center space-x-2 cursor-pointer"
            onClick={toggleDisplayUnit}
          >
            <h2 className="text-5xl font-bold tracking-tighter">
              {formatBalance()}
            </h2>
            <span className="text-2xl text-gray-400 font-light">
              {getDisplayUnitLabel()}
            </span>
            <button
              onClick={toggleBalanceVisibility}
              className="text-gray-400 hover:text-white"
            >
              {isBalanceVisible ? <Eye size={24} /> : <EyeOff size={24} />}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => setIsReceiveModalOpen(true)}
            className="bg-green-500/20 text-green-300 font-bold py-4 px-4 rounded-lg hover:bg-green-500/30 transition flex items-center justify-center space-x-2 text-lg"
          >
            <ArrowLeft />
            <span>Receive</span>
          </button>
          <button
            onClick={() => setIsSendModalOpen(true)}
            className="bg-yellow-400/20 text-yellow-300 font-bold py-4 px-4 rounded-lg hover:bg-yellow-400/30 transition flex items-center justify-center space-x-2 text-lg"
          >
            <span>Send</span>
            <ArrowRight />
          </button>
        </div>

        {/* Transactions List */}
        <TransactionsTab
          transactions={transactions}
          currency={selectedCurrency}
          balanceVisible={balanceVisible}
          displayUnit={displayUnit}
          onUnitToggle={toggleDisplayUnit}
        />
      </main>
    </div>
  );
};
