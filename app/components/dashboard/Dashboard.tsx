"use client";
import { useCurrency } from "@/app/hooks/useCurrency";
import { useBtcPrice } from "@/app/hooks/useBtcPrice";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LogOut,
  Settings,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNotifier } from "../../hooks/useNotifier";
import { Account, API_BASE_URL, apiCall, Transaction } from "../../lib/api";
import {
  formatBtc,
  formatFiat,
  formatFiatAmount,
  formatSats,
} from "../../lib/format";
import { NotificationToast } from "../ui/NotificationToast";
import { Modal } from "../ui/Modal";
import { IconButton } from "../ui/IconButton";
import { Alert } from "../ui/Alert";
import { ReceiveModal } from "./ReceiveModal";
import { SendModal } from "./SendModal";
import { SettingsTab } from "./SettingsTab";
import { TransactionsTab } from "./TransactionsTab";
import { RefreshZapButton } from "./RefreshZapButton";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useLanguage } from "@/app/LanguageProvider";

export const Dashboard = ({ setIsAuthenticated, setToken }: any) => {
  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const { notifications, addNotification, removeNotification } = useNotifier();
  const [balanceVisible, setBalanceVisible] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const t = useTranslation();
  const { language } = useLanguage();
  const locale = language === "es" ? "es-ES" : "en-US";
  const refreshLock = useRef(false);

  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const {
    selectedCurrency,
    setSelectedCurrency,
    availableCurrencies,
    loading: currencyLoading,
  } = useCurrency();

  const {
    price: btcPrice,
    loading: btcPriceLoading,
    error: btcPriceError,
    refresh: refreshBtcPrice,
  } = useBtcPrice(selectedCurrency);

  const [displayUnit, setDisplayUnit] = useState<"sats" | "fiat" | "btc">(
    "sats"
  );

  const fetchAllData = useCallback(async () => {
    try {
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
      setAccount(accountData);
      setTransactions(transData.transactions || []);
      setError("");
    } catch (err: any) {
      setError(t("Failed to fetch data: {error}", { error: err.message }));
    }
  }, [t]);

  const handleRefresh = async () => {
    if (isRefreshing || refreshLock.current) return;
    refreshLock.current = true;

    const startTime = Date.now();
    setIsRefreshing(true);

    await Promise.all([fetchAllData(), refreshBtcPrice()]);

    const elapsedTime = Date.now() - startTime;
    const animationDuration = 1500;
    const remainingTime = animationDuration - (elapsedTime % animationDuration);

    setTimeout(() => {
      setIsRefreshing(false);
      refreshLock.current = false;
    }, remainingTime);
  };

  const formatBalance = () => {
    if (!isClient || !account) return "•••••••";
    if (!balanceVisible) return "•••••••";

    const balanceInSats = account.balance;
    switch (displayUnit) {
      case "sats":
        return formatSats(balanceInSats, locale);
      case "btc":
        return formatBtc(balanceInSats);
      case "fiat": {
        const fiatValue = account.fiat_equivalents[selectedCurrency];
        if (fiatValue === undefined) return "N/A";
        return formatFiatAmount(fiatValue, locale);
      }
      default:
        return formatSats(balanceInSats, locale);
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

  const toggleBalanceVisibility = () => {
    const newVisibility = !balanceVisible;
    setBalanceVisible(newVisibility);
    localStorage.setItem("balanceVisible", JSON.stringify(newVisibility));
  };

  const addNotificationRef = useRef(addNotification);
  const fetchAllDataRef = useRef(fetchAllData);
  const refreshBtcPriceRef = useRef(refreshBtcPrice);
  const tRef = useRef(t);

  useEffect(() => {
    addNotificationRef.current = addNotification;
  }, [addNotification]);

  useEffect(() => {
    fetchAllDataRef.current = fetchAllData;
  }, [fetchAllData]);

  useEffect(() => {
    refreshBtcPriceRef.current = refreshBtcPrice;
  }, [refreshBtcPrice]);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    const token = localStorage.getItem("aratiri_accessToken");
    if (!token) return;

    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;

    const connectWebSocket = () => {
      const wsUrl = `${API_BASE_URL.replace(
        "http",
        "ws"
      )}/notifications/subscribe?token=${token}`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          const eventType = message.event;
          const eventData = message.data;

          if (eventType === "payment_received" && eventData) {
            const amountSats = eventData.amountSats || 0;
            const memo = eventData.memo || tRef.current("No description");

            addNotificationRef.current(
              tRef.current("Payment Received"),
              `${amountSats.toLocaleString()} sats - ${memo}`,
              "success"
            );

            void fetchAllDataRef.current();
            void refreshBtcPriceRef.current();
          } else if (eventType === "payment_sent") {
            void fetchAllDataRef.current();
            void refreshBtcPriceRef.current();
          }
        } catch {
          // Ignore malformed notification payloads
        }
      };

      ws.onclose = (event: CloseEvent) => {
        if (!event.wasClean) {
          reconnectTimeout = setTimeout(() => {
            connectWebSocket();
          }, 5000);
        }
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connectWebSocket();
    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, []);

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
    } catch {
      // Clear client session regardless of server logout result
    } finally {
      localStorage.removeItem("aratiri_accessToken");
      localStorage.removeItem("aratiri_refreshToken");
      setToken("");
      setIsAuthenticated(false);
    }
  };

  const showSpotPrice =
    isClient &&
    balanceVisible &&
    (displayUnit === "sats" || displayUnit === "btc") &&
    !btcPriceError;

  if (loading) {
    return (
      <div
        className="min-h-dvh bg-background flex items-center justify-center text-foreground"
        role="status"
        aria-live="polite"
        aria-label={t("Loading wallet")}
      >
        <Zap className="w-12 h-12 text-accent animate-calm-busy" aria-hidden="true" />
      </div>
    );
  }

  const isBalanceVisible = isClient && balanceVisible;

  return (
    <div className="min-h-dvh bg-background text-foreground font-sans flex flex-col">
      {isSendModalOpen && (
        <SendModal
          onClose={() => setIsSendModalOpen(false)}
          onPaymentSent={() => {
            setIsSendModalOpen(false);
            void fetchAllData();
            void refreshBtcPrice();
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
        <Modal
          title={t("Settings")}
          onClose={() => setIsSettingsModalOpen(false)}
          labelledBy="settings-title"
        >
          <SettingsTab
            selectedCurrency={selectedCurrency}
            setSelectedCurrency={setSelectedCurrency}
            availableCurrencies={availableCurrencies}
            loading={currencyLoading}
          />
        </Modal>
      )}

      <div className="fixed top-4 inset-x-4 sm:inset-x-auto sm:right-5 sm:left-auto z-50 space-y-3 w-auto sm:w-full sm:max-w-sm pointer-events-none sm:pointer-events-auto">
        {notifications.map((n) => (
          <div key={n.id} className="pointer-events-auto">
            <NotificationToast
              notification={n}
              onClose={removeNotification}
            />
          </div>
        ))}
      </div>

      <header className="bg-panel border-b border-panel-edge sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-1">
              <RefreshZapButton
                isRefreshing={isRefreshing}
                onRefresh={handleRefresh}
                label={t("Refresh wallet data")}
                busyLabel={t("Refreshing wallet data")}
              />
              <span
                data-testid="brand-wordmark"
                className="text-xl font-semibold tracking-tight select-none"
              >
                Aratiri
              </span>
            </div>
            <div className="flex items-center gap-1">
              <IconButton
                label={t("Settings")}
                onClick={() => setIsSettingsModalOpen(true)}
              >
                <Settings className="w-5 h-5" aria-hidden="true" />
              </IconButton>
              <IconButton label={t("Log out")} onClick={logout}>
                <LogOut className="w-5 h-5" aria-hidden="true" />
              </IconButton>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {error && (
          <Alert variant="danger" className="mb-6">
            {error}
          </Alert>
        )}

        <section className="text-center mb-8" aria-labelledby="balance-heading">
          <h2 id="balance-heading" className="sr-only">
            {t("Balance")}
          </h2>
          <div className="flex justify-center items-center gap-2 flex-wrap">
            <p className="text-4xl sm:text-5xl font-semibold tracking-tighter font-amount">
              {formatBalance()}
            </p>
            {isBalanceVisible && (
              <button
                type="button"
                onClick={toggleDisplayUnit}
                aria-label={t("Change display unit. Current unit: {unit}", {
                  unit: getDisplayUnitLabel(),
                })}
                className="inline-flex items-center justify-center text-xl sm:text-2xl text-muted font-light min-h-11 min-w-11 px-2 rounded-lg hover:text-foreground hover:bg-panel-elevated transition-colors"
              >
                {getDisplayUnitLabel()}
              </button>
            )}
            <IconButton
              label={
                isBalanceVisible ? t("Hide balance") : t("Show balance")
              }
              onClick={toggleBalanceVisibility}
            >
              {isBalanceVisible ? (
                <Eye size={22} aria-hidden="true" />
              ) : (
                <EyeOff size={22} aria-hidden="true" />
              )}
            </IconButton>
          </div>
          {showSpotPrice && (
            <p
              className="mt-2 text-sm text-muted font-amount min-h-5"
              aria-live="polite"
            >
              {btcPriceLoading && !btcPrice ? (
                <span className="inline-block w-40 h-3 rounded bg-panel-elevated align-middle" />
              ) : btcPrice ? (
                t("1 BTC ≈ {price}", {
                  price: formatFiat(btcPrice.price, btcPrice.currency, locale),
                })
              ) : (
                <span className="text-muted">—</span>
              )}
            </p>
          )}
        </section>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-8">
          <button
            type="button"
            onClick={() => setIsReceiveModalOpen(true)}
            className="min-h-12 bg-success-bg text-success font-semibold py-3 px-4 rounded-lg border border-success/30 hover:bg-success/20 transition flex items-center justify-center gap-2 text-base sm:text-lg touch-manipulation"
          >
            <ArrowLeft aria-hidden="true" />
            <span>{t("Receive")}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsSendModalOpen(true)}
            className="min-h-12 bg-accent-subtle text-accent font-semibold py-3 px-4 rounded-lg border border-accent/30 hover:bg-accent/25 transition flex items-center justify-center gap-2 text-base sm:text-lg touch-manipulation"
          >
            <span>{t("Send")}</span>
            <ArrowRight aria-hidden="true" />
          </button>
        </div>

        <TransactionsTab
          transactions={transactions}
          currency={selectedCurrency}
          balanceVisible={balanceVisible}
          displayUnit={displayUnit}
        />
      </main>
    </div>
  );
};
