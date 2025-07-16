"use client";

import {
  AlertCircle,
  Check,
  Copy,
  LogOut,
  QrCode,
  Send,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

const API_BASE_URL = "https://aratiri.diegoyegros.com/v1";

const AratiriFrontend = () => {
  const [token, setToken] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("invoices");
  const [copied, setCopied] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [satsAmount, setSatsAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [generatedInvoice, setGeneratedInvoice] = useState(null);

  const [paymentRequest, setPaymentRequest] = useState("");
  const [decodedInvoice, setDecodedInvoice] = useState(null);

  const [paymentInvoice, setPaymentInvoice] = useState("");
  const [paymentResponse, setPaymentResponse] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedToken = localStorage.getItem("aratiri_token");
      if (storedToken) {
        setToken(storedToken);
        setIsAuthenticated(true);
      }
    }
  }, []);

  const apiCall = async (endpoint, options = {}) => {
    const headers = {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: "Network error" }));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    return response.json();
  };

  const login = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiCall("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      setToken(response.token);
      if (typeof window !== "undefined") {
        localStorage.setItem("aratiri_token", response.token);
      }
      setIsAuthenticated(true);
      setSuccess("Login successful!");
      setUsername("");
      setPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken("");
    if (typeof window !== "undefined") {
      localStorage.removeItem("aratiri_token");
    }
    setIsAuthenticated(false);
    setGeneratedInvoice(null);
    setDecodedInvoice(null);
    setPaymentResponse(null);
  };

  const generateInvoice = async () => {
    setLoading(true);
    setError("");
    setGeneratedInvoice(null);

    try {
      const response = await apiCall("/invoices", {
        method: "POST",
        body: JSON.stringify({
          satsAmount: parseInt(satsAmount),
          memo: memo || undefined,
        }),
      });

      setGeneratedInvoice(response);
      setSuccess("Invoice generated successfully!");
      setSatsAmount("");
      setMemo("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const decodeInvoice = async () => {
    setLoading(true);
    setError("");
    setDecodedInvoice(null);

    try {
      const response = await apiCall(
        `/invoices/invoice/decode/${encodeURIComponent(paymentRequest)}`
      );
      setDecodedInvoice(response);
      setSuccess("Invoice decoded successfully!");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const payInvoice = async () => {
    setLoading(true);
    setError("");
    setPaymentResponse(null);

    try {
      const response = await apiCall("/payments/invoice", {
        method: "POST",
        body: JSON.stringify({ invoice: paymentInvoice }),
      });

      setPaymentResponse(response);
      setSuccess("Payment initiated successfully!");
      setPaymentInvoice("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-400 to-yellow-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <Zap className="w-12 h-12 text-orange-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Aratiri</h1>
            <p className="text-gray-600">Bitcoin Lightning Middleware</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-black"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-black"
                required
              />
            </div>

            <button
              type="button"
              onClick={login}
              disabled={loading}
              className="w-full bg-orange-500 text-white py-2 px-4 rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-md">
              {success}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Zap className="w-8 h-8 text-orange-500 mr-3" />
              <h1 className="text-xl font-bold text-gray-900">
                Aratiri Lightning
              </h1>
            </div>
            <button
              onClick={logout}
              className="flex items-center text-gray-500 hover:text-gray-700 transition-colors"
            >
              <LogOut className="w-5 h-5 mr-2" />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {["invoices", "decode", "payments"].map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  clearMessages();
                }}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors ${
                  activeTab === tab
                    ? "border-orange-500 text-orange-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab === "invoices" && (
                  <QrCode className="w-4 h-4 inline mr-2" />
                )}
                {tab === "decode" && (
                  <AlertCircle className="w-4 h-4 inline mr-2" />
                )}
                {tab === "payments" && <Send className="w-4 h-4 inline mr-2" />}
                {tab}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md flex items-center">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
            {error}
            <button
              onClick={clearMessages}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-md">
            {success}
            <button
              onClick={clearMessages}
              className="ml-auto text-green-500 hover:text-green-700 float-right"
            >
              ×
            </button>
          </div>
        )}

        {/* Invoice Generation */}
        {activeTab === "invoices" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Generate Lightning Invoice
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount (sats)
                  </label>
                  <input
                    type="number"
                    value={satsAmount}
                    onChange={(e) => setSatsAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-black"
                    required
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Memo (optional)
                  </label>
                  <input
                    type="text"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-black"
                    placeholder="Payment description..."
                  />
                </div>
                <button
                  type="button"
                  onClick={generateInvoice}
                  disabled={loading}
                  className="w-full bg-orange-500 text-white py-2 px-4 rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "Generating..." : "Generate Invoice"}
                </button>
              </div>
            </div>

            {generatedInvoice && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Generated Invoice
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Request
                    </label>
                    <div className="flex">
                      <input
                        type="text"
                        value={generatedInvoice.payment_request || ""}
                        readOnly
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md bg-gray-50 text-sm text-black"
                      />
                      <button
                        onClick={() =>
                          copyToClipboard(generatedInvoice.payment_request)
                        }
                        className="px-3 py-2 bg-gray-200 border border-l-0 border-gray-300 rounded-r-md hover:bg-gray-300 transition-colors"
                      >
                        {copied ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  {generatedInvoice.amount && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Amount
                      </label>
                      <p className="text-sm text-gray-900">
                        {generatedInvoice.amount} sats
                      </p>
                    </div>
                  )}
                  {generatedInvoice.description && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                      </label>
                      <p className="text-sm text-gray-900">
                        {generatedInvoice.description}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Invoice Decoding */}
        {activeTab === "decode" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Decode Lightning Invoice
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Request
                  </label>
                  <textarea
                    value={paymentRequest}
                    onChange={(e) => setPaymentRequest(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 h-32 text-black"
                    placeholder="Paste Lightning invoice here..."
                    required
                  />
                </div>
                <button
                  type="button"
                  onClick={decodeInvoice}
                  disabled={loading}
                  className="w-full bg-orange-500 text-white py-2 px-4 rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "Decoding..." : "Decode Invoice"}
                </button>
              </div>
            </div>

            {decodedInvoice && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Decoded Invoice
                </h3>
                <div className="space-y-4">
                  {Object.entries(decodedInvoice).map(([key, value]) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </label>
                      <p className="text-sm text-gray-900 break-all">
                        {String(value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Payments */}
        {activeTab === "payments" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Pay Lightning Invoice
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Request
                  </label>
                  <textarea
                    value={paymentInvoice}
                    onChange={(e) => setPaymentInvoice(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 h-32 text-black"
                    placeholder="Paste Lightning invoice to pay..."
                    required
                  />
                </div>
                <button
                  type="button"
                  onClick={payInvoice}
                  disabled={loading}
                  className="w-full bg-orange-500 text-white py-2 px-4 rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "Processing..." : "Pay Invoice"}
                </button>
              </div>
            </div>

            {paymentResponse && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Payment Response
                </h3>
                <div className="space-y-4">
                  {Object.entries(paymentResponse).map(([key, value]) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </label>
                      <p className="text-sm text-gray-900 break-all">
                        {String(value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default AratiriFrontend;
