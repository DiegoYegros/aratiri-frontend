"use client";
import { Check, ClipboardCopy, X } from "lucide-react";
import { useState } from "react";
import { Account, apiCall } from "../../lib/api";

interface ReceiveModalProps {
  account: Account | null;
  onClose: () => void;
}

export const ReceiveModal = ({ account, onClose }: ReceiveModalProps) => {
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [invoice, setInvoice] = useState<{ payment_request: string } | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

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

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(""), 2000);
  };

  const displayQrCode = invoice
    ? `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${invoice.payment_request}`
    : `data:image/png;base64,${account?.qr_code}`;

  const displayText = invoice
    ? invoice.payment_request
    : account?.alias || "loading...";

  const textToCopy = invoice ? invoice.payment_request : account?.lnurl || "";

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-gray-900 p-6 rounded-2xl w-full max-w-lg m-4 border border-slate-700/50 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h2 className="text-2xl font-bold">Receive Payment</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white"
          >
            <X />
          </button>
        </div>

        <div className="overflow-y-auto space-y-6">
          {/* Always-on address and QR */}
          <div className="text-center bg-gray-800 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">
              {invoice
                ? `Invoice for ${amount} sats`
                : "Your Lightning Address"}
            </h3>
            {account?.qr_code || invoice ? (
              <img
                src={displayQrCode}
                alt="QR Code"
                className="mx-auto rounded-lg bg-white p-2 w-full max-w-[200px]"
              />
            ) : (
              <div className="w-full max-w-[200px] aspect-square bg-gray-700 mx-auto rounded-lg animate-pulse" />
            )}
            <div className="mt-3 text-xs font-mono break-all bg-gray-900 p-2 rounded flex items-center justify-between">
              <span className="truncate mr-2">{displayText}</span>
              <button
                onClick={() => copyToClipboard(textToCopy, "address")}
                className="p-1.5 bg-gray-700 rounded-md hover:bg-gray-600 flex-shrink-0"
              >
                {copied === "address" ? (
                  <Check className="text-sky-400" size={16} />
                ) : (
                  <ClipboardCopy size={16} />
                )}
              </button>
            </div>
          </div>

          {/* Specific Invoice section */}
          <div className="space-y-4 bg-gray-800 p-4 rounded-lg">
            <h3 className="font-semibold text-center">
              Or, Create a Specific Invoice
            </h3>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount (sats)"
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Memo (optional)"
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
            <button
              onClick={handleGenerate}
              disabled={loading || !amount}
              className="w-full bg-slate-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-600 disabled:opacity-50 transition"
            >
              {loading ? "Generating..." : "Generate Invoice"}
            </button>
            {error && (
              <div className="text-rose-400 text-center mt-2">{error}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
