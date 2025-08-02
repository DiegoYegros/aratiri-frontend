"use client";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { apiCall } from "../../lib/api";

export const ReceiveTab = () => {
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [invoice, setInvoice] = useState<{ payment_request: string } | null>(
    null
  );
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
