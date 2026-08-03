"use client";
import { useCurrency } from "@/app/hooks/useCurrency";
import { useBtcPrice } from "@/app/hooks/useBtcPrice";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LogIn,
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
import type { WalletKind } from "@/app/lib/walletKind";
import { NotificationToast } from "../ui/NotificationToast";
import { Modal } from "../ui/Modal";
import { IconButton } from "../ui/IconButton";
import { Alert } from "../ui/Alert";
import { ReceiveModal } from "./ReceiveModal";
import { SendModal } from "./SendModal";
import { SettingsTab } from "./SettingsTab";
import { TransactionsTab } from "./TransactionsTab";
import { RequestCenter } from "./RequestCenter";
import { RefreshZapButton } from "./RefreshZapButton";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useLanguage } from "@/app/LanguageProvider";
import { SparkGetStarted } from "../spark/SparkGetStarted";
import { SparkHiddenState } from "../spark/SparkHiddenState";
import { SparkOnboarding } from "../spark/SparkOnboarding";
import { SparkSecurityPanel } from "../spark/SparkSecurityPanel";
import { SparkUnlockModal } from "../spark/SparkUnlockModal";
import { useSpark } from "../spark/SparkProvider";

type DashboardSection = "custodial" | "spark" | "requests";
export type DashboardAccessMode = "spark" | "full";

export const Dashboard = ({
  setIsAuthenticated,
  setToken,
  accessMode = "full",
  onSignIn,
}: {
  setIsAuthenticated: (auth: boolean) => void;
  setToken: (token: string | null) => void;
  accessMode?: DashboardAccessMode;
  onSignIn?: () => void;
}) => {
  const isSparkOnly = accessMode === "spark";
  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(!isSparkOnly);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const { notifications, addNotification, removeNotification } = useNotifier();
  const [balanceVisible, setBalanceVisible] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [activeSection, setActiveSection] = useState<DashboardSection>(
    isSparkOnly ? "spark" : "custodial"
  );
  const t = useTranslation();
  const { language } = useLanguage();
  const locale = language === "es" ? "es-ES" : "en-US";
  const refreshLock = useRef(false);
  const requestsRefreshRef = useRef<(() => Promise<void>) | null>(null);

  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSparkOnboardingOpen, setIsSparkOnboardingOpen] = useState(false);
  const [sparkOnboardingMode, setSparkOnboardingMode] = useState<
    "create" | "restore"
  >("create");
  const [isSparkUnlockOpen, setIsSparkUnlockOpen] = useState(false);

  const spark = useSpark();

  const registerRequestsRefresh = useCallback(
    (fn: (() => Promise<void>) | null) => {
      requestsRefreshRef.current = fn;
    },
    []
  );

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
    if (isSparkOnly) return;
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
  }, [isSparkOnly, t]);

  const handleRefresh = async () => {
    if (isRefreshing || refreshLock.current) return;
    refreshLock.current = true;

    const startTime = Date.now();
    setIsRefreshing(true);

    await Promise.all([
      isSparkOnly ? spark.refresh() : fetchAllData(),
      refreshBtcPrice(),
      isSparkOnly
        ? Promise.resolve()
        : (requestsRefreshRef.current?.() ?? Promise.resolve()),
      isSparkOnly ? Promise.resolve() : spark.refresh(),
    ]);

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
    if (isSparkOnly) {
      setLoading(false);
      return;
    }
    const loadData = async () => {
      setLoading(true);
      setError("");
      await fetchAllData();
      setLoading(false);
    };
    loadData();
  }, [fetchAllData, isSparkOnly]);

  const formatSparkBalance = () => {
    if (!isClient || !balanceVisible) return "•••••••";
    const sats = spark.balance?.available ?? null;
    if (sats === null) return "•••••••";
    switch (displayUnit) {
      case "sats":
        return formatSats(sats, locale);
      case "btc":
        return formatBtc(sats);
      case "fiat": {
        if (!btcPrice) return "N/A";
        return formatFiatAmount((sats / 1e8) * btcPrice.price, locale);
      }
      default:
        return formatSats(sats, locale);
    }
  };

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
    if (isSparkOnly) return;
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
            void requestsRefreshRef.current?.();
          } else if (eventType === "payment_sent") {
            void fetchAllDataRef.current();
            void refreshBtcPriceRef.current();
            void requestsRefreshRef.current?.();
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
  }, [isSparkOnly]);

  useEffect(() => {
    const storedVisibility = localStorage.getItem("balanceVisible");
    if (storedVisibility !== null) {
      setBalanceVisible(JSON.parse(storedVisibility));
    }
    setIsClient(true);
  }, []);

  const logout = async () => {
    // Clear in-memory Spark secrets on any exit from the shell; keep device meta.
    if (spark.status === "unlocked") {
      try {
        await spark.lock();
      } catch {
        // best effort — still leave the shell
      }
    }
    if (isSparkOnly) {
      onSignIn?.();
      return;
    }
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
      // Intentionally leave aratiri_spark_wallet_v1 intact.
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
  const walletKind: WalletKind =
    activeSection === "spark" ? "spark" : "custodial";

  const openSparkCreate = () => {
    setSparkOnboardingMode("create");
    setIsSparkOnboardingOpen(true);
  };
  const openSparkRestore = () => {
    setSparkOnboardingMode("restore");
    setIsSparkOnboardingOpen(true);
  };

  const sectionTabClass = (section: DashboardSection) =>
    `min-h-11 px-4 text-sm font-semibold border-b-2 transition-colors touch-manipulation ${
      activeSection === section
        ? "border-accent text-foreground"
        : "border-transparent text-muted hover:text-foreground"
    }`;

  return (
    <div className="min-h-dvh bg-background text-foreground font-sans flex flex-col">
      {isSendModalOpen && (
        <SendModal
          onClose={() => setIsSendModalOpen(false)}
          onPaymentSent={() => {
            setIsSendModalOpen(false);
            void fetchAllData();
            void refreshBtcPrice();
            void spark.refresh();
          }}
          walletKind={walletKind}
        />
      )}
      {isReceiveModalOpen && (
        <ReceiveModal
          account={account}
          onClose={() => setIsReceiveModalOpen(false)}
          walletKind={walletKind}
        />
      )}
      {isSparkOnboardingOpen && (
        <SparkOnboarding
          initialMode={sparkOnboardingMode}
          onClose={() => setIsSparkOnboardingOpen(false)}
          onComplete={() => {
            setIsSparkOnboardingOpen(false);
            setActiveSection("spark");
            void spark.refresh();
          }}
        />
      )}
      {isSparkUnlockOpen && (
        <SparkUnlockModal onClose={() => setIsSparkUnlockOpen(false)} />
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
          {(spark.status === "unlocked" || spark.status === "locked") && (
            <div className="mt-8 pt-6 border-t border-panel-edge">
              <h3 className="text-lg font-semibold mb-4">
                {t("Self-custody")}
              </h3>
              <SparkSecurityPanel />
            </div>
          )}
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
              <IconButton
                label={isSparkOnly ? t("Sign In") : t("Log out")}
                onClick={logout}
              >
                {isSparkOnly ? (
                  <LogIn className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <LogOut className="w-5 h-5" aria-hidden="true" />
                )}
              </IconButton>
            </div>
          </div>
        </div>
      </header>

      {!isSparkOnly && (
        <nav
          className="border-b border-panel-edge bg-panel"
          aria-label={t("Dashboard sections")}
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6 flex gap-1">
            <button
              type="button"
              onClick={() => setActiveSection("custodial")}
              aria-current={activeSection === "custodial" ? "page" : undefined}
              className={sectionTabClass("custodial")}
            >
              {t("Custodial")}
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("spark")}
              aria-current={activeSection === "spark" ? "page" : undefined}
              className={sectionTabClass("spark")}
            >
              {t("Self-custody")}
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("requests")}
              aria-current={activeSection === "requests" ? "page" : undefined}
              className={sectionTabClass("requests")}
            >
              {t("Requests")}
            </button>
          </div>
        </nav>
      )}

      <main className="flex-grow max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {error && activeSection === "custodial" && (
          <Alert variant="danger" className="mb-6">
            {error}
          </Alert>
        )}

        {activeSection === "requests" ? (
          <RequestCenter
            balanceVisible={balanceVisible}
            onToggleBalanceVisibility={toggleBalanceVisibility}
            registerRefresh={registerRequestsRefresh}
          />
        ) : activeSection === "custodial" ? (
          <>
            <section
              className="text-center mb-8"
              aria-labelledby="balance-heading"
            >
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
                    aria-label={t(
                      "Change display unit. Current unit: {unit}",
                      { unit: getDisplayUnitLabel() }
                    )}
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
                      price: formatFiat(
                        btcPrice.price,
                        btcPrice.currency,
                        locale
                      ),
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
          </>
        ) : spark.status === "loading" ? (
          <div
            className="text-center py-16 text-muted"
            role="status"
            aria-live="polite"
          >
            {t("Loading...")}
          </div>
        ) : spark.status === "not-created" ? (
          <SparkGetStarted
            onCreate={openSparkCreate}
            onRestore={openSparkRestore}
          />
        ) : spark.status === "locked" && spark.meta?.privacy_enabled ? (
          <SparkHiddenState onUnlock={() => setIsSparkUnlockOpen(true)} />
        ) : (
          <>
            <section
              className="text-center mb-8"
              aria-labelledby="spark-balance-heading"
            >
              <h2 id="spark-balance-heading" className="sr-only">
                {t("Balance")}
              </h2>
              <div className="flex justify-center items-center gap-2 flex-wrap">
                <p className="text-4xl sm:text-5xl font-semibold tracking-tighter font-amount">
                  {formatSparkBalance()}
                </p>
                {isBalanceVisible && (
                  <button
                    type="button"
                    onClick={toggleDisplayUnit}
                    aria-label={t(
                      "Change display unit. Current unit: {unit}",
                      { unit: getDisplayUnitLabel() }
                    )}
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
                      price: formatFiat(
                        btcPrice.price,
                        btcPrice.currency,
                        locale
                      ),
                    })
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </p>
              )}
            </section>

            {spark.status === "locked" && (
              <p className="text-xs text-muted text-center mb-2">
                {t(
                  "Balance as of last sync. Unlock for live data and signing."
                )}
              </p>
            )}

            {spark.status === "unlocked" ? (
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
            ) : (
              <div className="flex justify-center mb-8">
                <button
                  type="button"
                  onClick={() => setIsSparkUnlockOpen(true)}
                  className="min-h-12 bg-accent-subtle text-accent font-semibold py-3 px-6 rounded-lg border border-accent/30 hover:bg-accent/25 transition touch-manipulation"
                >
                  {t("Unlock wallet")}
                </button>
              </div>
            )}

            <TransactionsTab
              transactions={transactions}
              currency={selectedCurrency}
              balanceVisible={balanceVisible}
              displayUnit={displayUnit}
              walletKind="spark"
              sparkRows={spark.transactions}
            />
          </>
        )}
      </main>
    </div>
  );
};
