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
  LogOut,
  QrCode,
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
  type: "CREDIT" | "DEBIT";
  amount: number;
  date: string;
}

interface DecodedInvoice {
  destination: string;
  payment_hash: string;
  num_satoshis: number;
  description: string;
  expiry: number;
}

const API_BASE_URL = "https://aratiri.diegoyegros.com/v1";

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

interface GoogleLoginProps {
  onSuccess: (token: string) => void;
  onError: (error: string) => void;
}

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

const TransactionsTab = ({ transactions }) => {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Recent Transactions</h2>
      <div className="space-y-3">
        {transactions.length > 0 ? (
          transactions.map((tx) => (
            <div
              key={tx.id}
              className="bg-gray-700/50 p-4 rounded-lg flex justify-between items-center"
            >
              <div>
                <p
                  className={`font-bold ${
                    tx.type === "CREDIT" ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {tx.type === "CREDIT" ? "+" : "-"}{" "}
                  {tx.amount.toLocaleString()} sats
                </p>
                <p className="text-sm text-gray-400">
                  {new Date(tx.date).toLocaleString()}
                </p>
              </div>
              <div
                className={`p-2 rounded-full ${
                  tx.type === "CREDIT" ? "bg-green-500/20" : "bg-red-500/20"
                }`}
              >
                {tx.type === "CREDIT" ? (
                  <ArrowLeft className="text-green-400" size={20} />
                ) : (
                  <ArrowRight className="text-red-400" size={20} />
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-400 text-center py-8">
            No transactions found in the last 30 days.
          </p>
        )}
      </div>
    </div>
  );
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
