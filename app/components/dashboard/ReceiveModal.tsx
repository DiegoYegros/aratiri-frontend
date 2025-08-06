"use client";
import { Bitcoin, Check, ClipboardCopy, Edit, Share2, X } from "lucide-react";
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
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("address");

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

  const handleShare = async () => {
    const shareData = {
      title: "My Lightning Address",
      text: `You can send me Bitcoin sats on the Lightning Network using this address: ${account?.alias}`,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      copyToClipboard(account?.alias || "");
      alert(
        "Web Share API not supported in your browser. Username copied to clipboard instead."
      );
    }
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
      <div className="bg-gray-900 rounded-2xl w-full max-w-md m-4 border border-slate-700/50 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-slate-800">
          <h2 className="text-xl font-bold">Receive</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex p-2 bg-gray-800/50">
          <button
            onClick={() => setActiveTab("address")}
            className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-colors ${
              activeTab === "address"
                ? "bg-slate-700 text-white"
                : "text-gray-400 hover:bg-slate-800"
            }`}
          >
            Lightning Address
          </button>
          <button
            onClick={() => setActiveTab("request")}
            className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-colors ${
              activeTab === "request"
                ? "bg-slate-700 text-white"
                : "text-gray-400 hover:bg-slate-800"
            }`}
          >
            Request Amount
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {activeTab === "address" && (
            <div className="text-center">
              <div className="bg-white p-4 rounded-lg inline-block">
                <img src={displayQrCode} alt="QR Code" className="w-48 h-48" />
              </div>
              <div className="mt-4">
                <p className="text-gray-400 text-sm mb-2">Your Username</p>
                <div className="bg-gray-800 rounded-lg px-4 py-3 flex items-center justify-between">
                  <span className="font-mono text-sm truncate">
                    {account?.alias}
                  </span>
                  <button
                    onClick={() => copyToClipboard(account?.lnurl || "")}
                    className="p-2 text-gray-400 hover:text-white rounded-full"
                  >
                    {copied ? (
                      <Check size={18} className="text-green-500" />
                    ) : (
                      <ClipboardCopy size={18} />
                    )}
                  </button>
                </div>
              </div>
              <button
                onClick={handleShare}
                className="mt-6 w-full bg-slate-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-600 transition flex items-center justify-center"
              >
                <Share2 size={18} className="mr-2" />
                Share
              </button>
            </div>
          )}

          {activeTab === "request" && (
            <div className="space-y-4">
              <div className="relative">
                <Bitcoin
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Amount (sats)"
                  className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <div className="relative">
                <Edit
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Memo (optional)"
                  className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <button
                onClick={handleGenerate}
                disabled={loading || !amount}
                className="w-full bg-slate-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-600 disabled:opacity-50 transition"
              >
                {loading ? "Generating..." : "Generate Invoice"}
              </button>
              {error && (
                <div className="text-red-400 text-center text-sm mt-2">
                  {error}
                </div>
              )}
              {invoice && (
                <div className="mt-4 p-4 bg-gray-800 rounded-lg">
                  <div className="text-center">
                    <div className="bg-white p-4 rounded-lg inline-block">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${invoice.payment_request}`}
                        alt="Invoice QR Code"
                        className="w-48 h-48"
                      />
                    </div>
                  </div>
                  <div className="mt-4 bg-gray-900 rounded-lg px-4 py-3 flex items-center justify-between">
                    <span className="font-mono text-xs break-all">
                      {invoice.payment_request}
                    </span>
                    <button
                      onClick={() => copyToClipboard(invoice.payment_request)}
                      className="p-2 text-gray-400 hover:text-white rounded-full"
                    >
                      {copied ? (
                        <Check size={18} className="text-green-500" />
                      ) : (
                        <ClipboardCopy size={18} />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
