"use client";
import { QrCode, X } from "lucide-react";
import { useState } from "react";
import { apiCall, DecodedInvoice } from "../../lib/api";
import { QrScanner } from "./QrScanner";

interface SendModalProps {
  onClose: () => void;
  onPaymentSent: () => void;
}

export const SendModal = ({ onClose, onPaymentSent }: SendModalProps) => {
  const [invoice, setInvoice] = useState("");
  const [decoded, setDecoded] = useState<DecodedInvoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isScanning, setIsScanning] = useState(false);

  const handleDecodeWithValue = async (invoiceValue: string) => {
    if (!invoiceValue) return;
    setLoading(true);
    setError("");
    setDecoded(null);
    setSuccess("");
    try {
      const data = await apiCall(
        `/invoices/invoice/decode/${encodeURIComponent(invoiceValue)}`
      );
      setDecoded(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onScanSuccess = (data: string) => {
    setInvoice(data);
    setIsScanning(false);
    handleDecodeWithValue(data);
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
      setSuccess(`Payment initiated! Status: ${data.status}.`);
      setInvoice("");
      setDecoded(null);
      setTimeout(() => {
        onPaymentSent();
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  if (isScanning) {
    return (
      <QrScanner
        onScanSuccess={onScanSuccess}
        onClose={() => setIsScanning(false)}
      />
    );
  }
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-gray-800 p-6 rounded-2xl w-full max-w-md m-4 border border-yellow-500/20">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Send Payment</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white"
          >
            <X />
          </button>
        </div>

        <div className="space-y-4">
          <textarea
            value={invoice}
            onChange={(e) => setInvoice(e.target.value)}
            placeholder="Paste Lightning Invoice or LNURL"
            className="w-full h-32 px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 font-mono text-sm"
          />
          <div className="flex space-x-2">
            <button
              onClick={() => handleDecodeWithValue(invoice)}
              disabled={loading || !invoice}
              className="flex-grow bg-gray-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-500 disabled:opacity-50 transition"
            >
              {loading ? "Decoding..." : "Decode"}
            </button>
            <button
              onClick={() => setIsScanning(true)}
              className="bg-gray-600 text-white p-3 rounded-lg hover:bg-gray-500 disabled:opacity-50 transition"
              title="Scan QR Code"
            >
              <QrCode />
            </button>
          </div>
          {error && <div className="text-red-400 text-center">{error}</div>}
          {success && (
            <div className="text-green-400 text-center">{success}</div>
          )}
        </div>

        {decoded && (
          <div className="mt-6 bg-gray-900/50 p-4 rounded-lg space-y-3 animate-fade-in">
            <h3 className="font-bold text-lg">Invoice Details</h3>
            <div>
              <span className="font-semibold text-gray-400">Amount:</span>{" "}
              {decoded.num_satoshis.toLocaleString()} sats
            </div>
            <div className="truncate">
              <span className="font-semibold text-gray-400">Description:</span>{" "}
              {decoded.description || "N/A"}
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
    </div>
  );
};
