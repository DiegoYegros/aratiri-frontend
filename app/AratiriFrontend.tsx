"use client";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardCopy,
  Copy,
  Eye,
  EyeOff,
  History,
  Loader,
  LogOut,
  QrCode,
  ShieldAlert,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface Account {
  id: string;
  balance: number;
  alias: string;
  lnurl: string;
  qr_code: string;
}

interface Transaction {
  id: string;
  type: "DEBIT" | "CREDIT";
  amount: number;
  date: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
}

interface DecodedInvoice {
  destination: string;
  payment_hash: string;
  num_satoshis: number;
  description: string;
  expiry: number;
}

interface Notification {
  id: number;
  title: string;
  message: string;
  type: "success" | "error";
}
interface GoogleLoginProps {
  onSuccess: (token: string) => void;
  onError: (error: string) => void;
}
const API_BASE_URL = "https://aratiri.diegoyegros.com/v1";
//const API_BASE_URL = "http://localhost:2100/v1";
const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem("aratiri_token");
  const headers = new Headers(options.headers || {});

  if (
    options.body &&
    typeof options.body === "string" &&
    options.body.startsWith("ey")
  ) {
    headers.set("Content-Type", "text/plain");
  } else if (options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: "An unknown error occurred." }));
    throw new Error(errorData.message || `HTTP Error: ${response.status}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    return response.json();
  }
  return {};
};

declare global {
  interface Window {
    google: any;
  }
}

const NotificationToast = ({
  notification,
  onClose,
}: {
  notification: Notification;
  onClose: (id: number) => void;
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(notification.id);
    }, 5000);

    return () => clearTimeout(timer);
  }, [notification.id, onClose]);

  const bgColor =
    notification.type === "success" ? "bg-green-500/20" : "bg-red-500/20";
  const borderColor =
    notification.type === "success" ? "border-green-400" : "border-red-400";
  const iconColor =
    notification.type === "success" ? "text-green-400" : "text-red-400";

  return (
    <div
      className={`w-full max-w-sm rounded-lg shadow-lg pointer-events-auto overflow-hidden border ${borderColor} ${bgColor} backdrop-blur-sm animate-fade-in-right`}
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {notification.type === "success" ? (
              <Zap className={iconColor} />
            ) : (
              <X className={iconColor} />
            )}
          </div>
          <div className="ml-3 w-0 flex-1 pt-0.5">
            <p className="text-sm font-bold text-white">{notification.title}</p>
            <p className="mt-1 text-sm text-gray-300">{notification.message}</p>
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={() => onClose(notification.id)}
              className="inline-flex text-gray-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
const GoogleLogin = ({ onSuccess, onError }: GoogleLoginProps) => {
  const buttonDiv = useRef<HTMLDivElement>(null);

  const initializeGoogleButton = useCallback(() => {
    if (typeof window.google !== "undefined" && buttonDiv.current) {
      try {
        window.google.accounts.id.initialize({
          client_id:
            "254642422573-4l9v69dl2km5c9gqj7m7hr2gli059vk8.apps.googleusercontent.com",
          callback: (response: any) => {
            if (response.credential) {
              onSuccess(response.credential);
            } else {
              onError("No se recibió la credencial de Google.");
            }
          },
        });

        window.google.accounts.id.renderButton(buttonDiv.current, {
          theme: "filled_black",
          size: "large",
          type: "standard",
          shape: "pill",
          text: "continue_with",
        });
      } catch (e) {
        console.error("Error initializing Google Button:", e);
        onError("Could not initialize Google Sign-In.");
      }
    }
  }, [onSuccess, onError]);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogleButton;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [initializeGoogleButton]);

  return <div ref={buttonDiv} className="flex justify-center"></div>;
};

const LoginScreen = ({ setToken, setIsAuthenticated }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await apiCall("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      localStorage.setItem("aratiri_token", response.token);
      setToken(response.token);
      setIsAuthenticated(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (googleToken: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await apiCall("/auth/sso/google", {
        method: "POST",
        body: googleToken,
        headers: {
          "Content-Type": "text/plain",
        },
      });

      localStorage.setItem("aratiri_token", response.token);
      setToken(response.token);
      setIsAuthenticated(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-gray-800 rounded-2xl shadow-lg p-8 space-y-6 border border-yellow-500/20">
        <div className="text-center">
          <Zap className="w-16 h-16 text-yellow-400 mx-auto mb-4 animate-pulse" />
          <h1 className="text-4xl font-bold">Aratiri</h1>
          <p className="text-gray-400">Bitcoin Lightning Wallet</p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-400 text-gray-900 font-bold py-3 px-4 rounded-lg hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 transition"
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-600" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-gray-800 px-2 text-gray-500">OR</span>
          </div>
        </div>

        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={(errorMsg) => setError(errorMsg)}
        />
        <div className="absolute bottom-4 right-4 text-xs text-gray-500">
          v0.1.0
        </div>
      </div>
    </div>
  );
};

const Dashboard = ({ setIsAuthenticated, setToken }) => {
  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("account");
  const { notifications, addNotification, removeNotification } = useNotifier();

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
      await fetchAccountData();
      await fetchTransactions();
      setLoading(false);
    };
    loadData();
  }, [fetchAccountData, fetchTransactions]);

  useEffect(() => {
    const token = localStorage.getItem("aratiri_token");
    if (!token) return;

    console.log("Setting up SSE connection...");
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

            if (eventData) {
              console.log(`Received SSE event: ${eventName}`, eventData);
              if (eventName === "payment_received") {
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
        }
      } catch (error: any) {
        if (error.name !== "AbortError") {
          console.error("SSE connection error:", error);
        }
      }
    };

    connectSse();

    return () => {
      console.log("Closing SSE connection.");
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
        return <TransactionsTab transactions={transactions} />;
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

const AccountTab = ({ account }) => {
  const [copied, setCopied] = useState("");
  const [balanceVisible, setBalanceVisible] = useState(true);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(""), 2000);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Account Details</h2>
      <div className="space-y-6">
        <div className="bg-gray-700/50 p-4 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Total Balance</span>
            <button
              onClick={() => setBalanceVisible(!balanceVisible)}
              className="text-gray-400 hover:text-white"
            >
              {balanceVisible ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <div className="text-4xl font-bold mt-2">
            {balanceVisible
              ? `${account?.balance.toLocaleString() || 0} sats`
              : "••••••••••"}
          </div>
        </div>
        <div className="bg-gray-700/50 p-4 rounded-lg">
          <label className="text-sm text-gray-400">Lightning Address</label>
          <div className="flex items-center mt-1">
            <p className="text-lg font-mono flex-grow truncate">
              {account?.alias || "loading..."}
            </p>
            <button
              onClick={() => copyToClipboard(account?.alias || "", "alias")}
              className="ml-4 p-2 rounded-md hover:bg-gray-600"
            >
              {copied === "alias" ? (
                <Check className="text-green-400" size={20} />
              ) : (
                <ClipboardCopy size={20} />
              )}
            </button>
          </div>
        </div>
        <div className="bg-gray-700/50 p-4 rounded-lg text-center">
          <h3 className="text-lg font-semibold mb-4">Your LNURL QR Code</h3>
          {account?.qr_code ? (
            <img
              src={`data:image/png;base64,${account.qr_code}`}
              alt="LNURL QR Code"
              className="mx-auto rounded-lg bg-white p-2"
            />
          ) : (
            <div className="w-48 h-48 bg-gray-600 mx-auto rounded-lg animate-pulse" />
          )}
          <button
            onClick={() => copyToClipboard(account?.lnurl || "", "lnurl")}
            className="mt-4 w-full bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-500 transition-colors flex items-center justify-center"
          >
            {copied === "lnurl" ? (
              <>
                <Check className="mr-2" /> Copied!
              </>
            ) : (
              <>
                <ClipboardCopy className="mr-2" /> Copy LNURL
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const ReceiveTab = () => {
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setInvoice(null);
    try {
      const data = await apiCall("/invoices", {
        method: "POST",
        body: JSON.stringify({ sats_amount: parseInt(amount), memo }),
      });
      setInvoice(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Receive Payment</h2>
      {!invoice ? (
        <div className="space-y-4">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (sats)"
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Memo (optional)"
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
          <button
            onClick={handleGenerate}
            disabled={loading || !amount}
            className="w-full bg-yellow-400 text-gray-900 font-bold py-3 px-4 rounded-lg hover:bg-yellow-500 disabled:opacity-50 transition"
          >
            {loading ? "Generating..." : "Generate Invoice"}
          </button>
          {error && (
            <div className="text-red-400 text-center mt-2">{error}</div>
          )}
        </div>
      ) : (
        <div className="text-center space-y-4">
          <h3 className="text-lg">Scan to Pay {amount} sats</h3>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${invoice.payment_request}`}
            alt="Invoice QR Code"
            className="mx-auto rounded-lg bg-white p-2"
          />
          <div className="relative">
            <textarea
              readOnly
              value={invoice.payment_request}
              className="w-full h-24 p-2 bg-gray-900 rounded-lg font-mono text-xs break-all"
            />
            <button
              onClick={() => copyToClipboard(invoice.payment_request)}
              className="absolute top-2 right-2 p-1.5 bg-gray-700 rounded-md hover:bg-gray-600"
            >
              {copied ? (
                <Check className="text-green-400" size={16} />
              ) : (
                <Copy size={16} />
              )}
            </button>
          </div>
          <button
            onClick={() => setInvoice(null)}
            className="w-full bg-gray-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-500 transition"
          >
            Create New Invoice
          </button>
        </div>
      )}
    </div>
  );
};

const SendTab = () => {
  const [invoice, setInvoice] = useState("");
  const [decoded, setDecoded] = useState<DecodedInvoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleDecode = async () => {
    if (!invoice) return;
    setLoading(true);
    setError("");
    setDecoded(null);
    setSuccess("");
    try {
      const data = await apiCall(
        `/invoices/invoice/decode/${encodeURIComponent(invoice)}`
      );
      setDecoded(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async () => {
    if (!invoice) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const data = await apiCall("/payments/invoice", {
        method: "POST",
        body: JSON.stringify({ invoice }),
      });
      setSuccess(
        `Payment initiated! Status: ${data.status}. Tx ID: ${data.transactionId}`
      );
      setInvoice("");
      setDecoded(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Send Payment</h2>
      <div className="space-y-4">
        <textarea
          value={invoice}
          onChange={(e) => setInvoice(e.target.value)}
          placeholder="Paste Lightning Invoice (BOLT11)"
          className="w-full h-32 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 font-mono text-sm"
        />
        <button
          onClick={handleDecode}
          disabled={loading || !invoice}
          className="w-full bg-gray-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-500 disabled:opacity-50 transition"
        >
          {loading ? "Decoding..." : "Decode Invoice"}
        </button>
        {error && <div className="text-red-400 text-center mt-2">{error}</div>}
        {success && (
          <div className="text-green-400 text-center mt-2">{success}</div>
        )}
      </div>

      {decoded && (
        <div className="mt-6 bg-gray-700/50 p-4 rounded-lg space-y-3">
          <h3 className="font-bold text-lg">Invoice Details</h3>
          <div>
            <span className="font-semibold text-gray-400">Amount:</span>{" "}
            {decoded.num_satoshis.toLocaleString()} sats
          </div>
          <div>
            <span className="font-semibold text-gray-400">Description:</span>{" "}
            {decoded.description || "N/A"}
          </div>
          <div className="truncate">
            <span className="font-semibold text-gray-400">Destination:</span>{" "}
            {decoded.destination}
          </div>
          <button
            onClick={handlePay}
            disabled={loading}
            className="w-full bg-yellow-400 text-gray-900 font-bold py-3 px-4 rounded-lg hover:bg-yellow-500 disabled:opacity-50 transition"
          >
            {loading
              ? "Paying..."
              : `Pay ${decoded.num_satoshis.toLocaleString()} sats`}
          </button>
        </div>
      )}
    </div>
  );
};

const getTransactionProperties = (tx: Transaction) => {
  const isCredit = tx.type.includes("CREDIT") || tx.type.includes("DEPOSIT");

  switch (tx.status) {
    case "PENDING":
      return {
        color: "text-yellow-400",
        bgColor: "bg-yellow-500/20",
        icon: <Loader className="animate-spin text-yellow-400" size={20} />,
        text: `${isCredit ? "+" : "-"} ${tx.amount.toLocaleString()} sats`,
        statusText: "Pending...",
      };
    case "FAILED":
      return {
        color: "text-gray-400",
        bgColor: "bg-gray-500/20",
        icon: <ShieldAlert className="text-gray-400" size={20} />,
        text: (
          <span className="line-through">
            {isCredit ? "+" : "-"} {tx.amount.toLocaleString()} sats
          </span>
        ),
        statusText: "Failed",
      };
    case "COMPLETED":
    default:
      return {
        color: isCredit ? "text-green-400" : "text-red-400",
        bgColor: isCredit ? "bg-green-500/20" : "bg-red-500/20",
        icon: isCredit ? (
          <ArrowLeft className="text-green-400" size={20} />
        ) : (
          <ArrowRight className="text-red-400" size={20} />
        ),
        text: `${isCredit ? "+" : "-"} ${tx.amount.toLocaleString()} sats`,
        statusText: new Date(tx.date).toLocaleString(),
      };
  }
};

const TransactionsTab = ({ transactions }: { transactions: Transaction[] }) => {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Recent Transactions</h2>
      <div className="space-y-3">
        {transactions.length > 0 ? (
          transactions.map((tx) => {
            const { color, bgColor, icon, text, statusText } =
              getTransactionProperties(tx);
            return (
              <div
                key={tx.id}
                className="bg-gray-700/50 p-4 rounded-lg flex justify-between items-center"
              >
                <div>
                  <p className={`font-bold ${color}`}>{text}</p>
                  <p className="text-sm text-gray-400">{statusText}</p>
                </div>
                <div className={`p-2 rounded-full ${bgColor}`}>{icon}</div>
              </div>
            );
          })
        ) : (
          <p className="text-gray-400 text-center py-8">
            No transactions found in the last 30 days.
          </p>
        )}
      </div>
    </div>
  );
};

const useNotifier = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback(
    (title: string, message: string, type: "success" | "error" = "success") => {
      const newNotification: Notification = {
        id: new Date().getTime(),
        title,
        message,
        type,
      };
      setNotifications((prev) => [...prev, newNotification]);
    },
    []
  );

  const removeNotification = useCallback((id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return { notifications, addNotification, removeNotification };
};

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem("aratiri_token");
    if (storedToken) {
      setToken(storedToken);
      setIsAuthenticated(true);
    }
  }, []);

  return (
    <>
      {!isAuthenticated ? (
        <LoginScreen
          setToken={setToken}
          setIsAuthenticated={setIsAuthenticated}
        />
      ) : (
        <Dashboard
          setToken={setToken}
          setIsAuthenticated={setIsAuthenticated}
        />
      )}
    </>
  );
}
