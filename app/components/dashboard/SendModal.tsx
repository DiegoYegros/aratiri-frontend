"use client";
import { Bitcoin, Edit, QrCode, X } from "lucide-react";
import { useState } from "react";
import {
  apiCall,
  DecodedInvoice,
  DecodedResponse,
  LnurlParams,
} from "../../lib/api";
import { QrScanner } from "./QrScanner";

interface SendModalProps {
  onClose: () => void;
  onPaymentSent: () => void;
}

export const SendModal = ({ onClose, onPaymentSent }: SendModalProps) => {
  const [inputValue, setInputValue] = useState("");
  const [decoded, setDecoded] = useState<DecodedResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [lnurlAmount, setLnurlAmount] = useState("");
  const [lnurlComment, setLnurlComment] = useState("");
  const handleDecode = async (valueToDecode: string) => {
    if (!valueToDecode) return;
    setLoading(true);
    setError("");
    setDecoded(null);
    setSuccess("");
    setLnurlAmount("");
    setLnurlComment("");

    try {
      const data: DecodedResponse = await apiCall(
        `/decoder?input=${encodeURIComponent(valueToDecode)}`
      );

      if (data.type === "error") {
        throw new Error(data.error || "Unsupported or invalid format");
      }

      setDecoded(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onScanSuccess = (data: string) => {
    setInputValue(data);
    setIsScanning(false);
    handleDecode(data);
  };

  const handlePay = async () => {
    if (!decoded || !decoded.data) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      let data;
      if (decoded.type === "lightning_invoice") {
        data = await apiCall("/payments/invoice", {
          method: "POST",
          body: JSON.stringify({ invoice: inputValue }),
        });
      } else if (decoded.type === "lnurl_params" || decoded.type === "alias") {
        const params = decoded.data as LnurlParams;
        const amountMsat = parseInt(lnurlAmount) * 1000;
        if (
          amountMsat < params.minSendable ||
          amountMsat > params.maxSendable
        ) {
          throw new Error(
            `Amount must be between ${params.minSendable / 1000} and ${
              params.maxSendable / 1000
            } sats.`
          );
        }

        data = await apiCall("/lnurl/pay", {
          method: "POST",
          body: JSON.stringify({
            callback: params.callback,
            amount_msat: amountMsat,
            comment: lnurlComment,
          }),
        });
      } else {
        throw new Error("Payment type not supported yet.");
      }

      setSuccess(`Payment initiated! Status: ${data.status}.`);
      setInputValue("");
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

  const renderDecodedContent = () => {
    if (!decoded || !decoded.data) return null;

    switch (decoded.type) {
      case "lightning_invoice":
        const invoice = decoded.data as DecodedInvoice;
        return (
          <div className="mt-6 bg-gray-900/50 p-4 rounded-lg space-y-3 animate-fade-in">
            <h3 className="font-bold text-lg">Invoice Details</h3>
            <div>
              <span className="font-semibold text-gray-400">Amount:</span>{" "}
              {invoice.num_satoshis.toLocaleString()} sats
            </div>
            <div className="truncate">
              <span className="font-semibold text-gray-400">Description:</span>{" "}
              {invoice.description || "N/A"}
            </div>
            <button
              onClick={handlePay}
              disabled={loading}
              className="w-full bg-yellow-400 text-gray-900 font-bold py-3 px-4 rounded-lg hover:bg-yellow-500 disabled:opacity-50 transition"
            >
              {loading
                ? "Paying..."
                : `Pay ${invoice.num_satoshis.toLocaleString()} sats`}
            </button>
          </div>
        );

      case "alias":
      case "lnurl_params":
        const params = decoded.data as LnurlParams;
        const metadata = JSON.parse(params.metadata);
        const description =
          metadata.find((m: any) => m[0] === "text/plain")?.[1] ||
          "LNURL Payment";

        return (
          <div className="mt-6 bg-gray-900/50 p-4 rounded-lg space-y-4 animate-fade-in">
            <h3 className="font-bold text-lg">{description}</h3>
            <div className="relative">
              <Bitcoin
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="number"
                value={lnurlAmount}
                onChange={(e) => setLnurlAmount(e.target.value)}
                placeholder={`Amount (${(
                  params.minSendable / 1000
                ).toLocaleString()} - ${(
                  params.maxSendable / 1000
                ).toLocaleString()} sats)`}
                className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
            {params.commentAllowed && params.commentAllowed > 0 && (
              <div className="relative">
                <Edit
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="text"
                  value={lnurlComment}
                  onChange={(e) => setLnurlComment(e.target.value)}
                  placeholder={`Comment (optional, max ${params.commentAllowed} chars)`}
                  maxLength={params.commentAllowed}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
            )}
            <button
              onClick={handlePay}
              disabled={loading || !lnurlAmount}
              className="w-full bg-yellow-400 text-gray-900 font-bold py-3 px-4 rounded-lg hover:bg-yellow-500 disabled:opacity-50 transition"
            >
              {loading ? "Processing..." : "Pay"}
            </button>
          </div>
        );

      case "bitcoin_address":
        return (
          <div className="mt-6 text-center text-gray-400">
            On-chain payments coming soon!
          </div>
        );

      default:
        return null;
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
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Paste Invoice, LNURL, Address, or Alias"
            className="w-full h-32 px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 font-mono text-sm"
          />
          <div className="flex space-x-2">
            <button
              onClick={() => handleDecode(inputValue)}
              disabled={loading || !inputValue}
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
        {renderDecodedContent()}
      </div>
    </div>
  );
};
