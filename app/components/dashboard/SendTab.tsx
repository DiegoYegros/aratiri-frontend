"use client";
import { QrCode } from "lucide-react";
import { useState } from "react";
import { apiCall, DecodedInvoice } from "../../lib/api";
import { QrScanner } from "./QrScanner";

export const SendTab = () => {
  const [invoice, setInvoice] = useState("");
  const [decoded, setDecoded] = useState<DecodedInvoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isScanning, setIsScanning] = useState(false);

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
  const onScanSuccess = (data: string) => {
    setInvoice(data);
    setIsScanning(false);
    handleDecodeWithValue(data);
  };
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
  return (
    <div>
      {isScanning && (
        <QrScanner
          onScanSuccess={onScanSuccess}
          onClose={() => setIsScanning(false)}
        />
      )}

      <h2 className="text-2xl font-bold mb-6">Send Payment</h2>
      <div className="space-y-4">
        <textarea
          value={invoice}
          onChange={(e) => setInvoice(e.target.value)}
          placeholder="Paste Lightning Invoice (BOLT11)"
          className="w-full h-32 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 font-mono text-sm"
        />
        {/* Container for buttons */}
        <div className="flex space-x-2">
          <button
            onClick={handleDecode}
            disabled={loading || !invoice}
            className="flex-grow bg-gray-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-500 disabled:opacity-50 transition"
          >
            {loading ? "Decoding..." : "Decode Invoice"}
          </button>
          <button
            onClick={() => setIsScanning(true)}
            className="bg-gray-600 text-white p-3 rounded-lg hover:bg-gray-500 disabled:opacity-50 transition"
            title="Scan QR Code"
          >
            <QrCode />
          </button>
        </div>
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
