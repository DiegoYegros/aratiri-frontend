"use client";
import {
  ArrowLeft,
  Bitcoin,
  Check,
  ClipboardCopy,
  Edit,
  Share2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
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
  const [activeTab, setActiveTab] = useState("lightning");
  const [showShareButton, setShowShareButton] = useState(false);

  useEffect(() => {
    if (navigator.share) {
      setShowShareButton(true);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

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

  const handleShare = async (title: string, text: string) => {
    const shareData = {
      title: title,
      text: text,
    };
    try {
      await navigator.share(shareData);
    } catch (err) {
      console.error("Error sharing:", err);
    }
  };

  const handleBackToRequest = () => {
    setInvoice(null);
    setAmount("");
    setMemo("");
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-secondary rounded-2xl w-full max-w-md m-4 border border-border flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-border">
          {invoice && activeTab === "request" ? (
            <button
              onClick={handleBackToRequest}
              className="p-2 text-secondary-foreground hover:text-foreground rounded-full"
            >
              <ArrowLeft size={20} />
            </button>
          ) : (
            <div style={{ width: "2.5rem" }} />
          )}
          <h2 className="text-xl font-bold">Receive</h2>
          <button
            onClick={onClose}
            className="p-2 text-secondary-foreground hover:text-foreground rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex p-2 bg-background/50 rounded-t-xl">
          <div className="flex w-full bg-accent/20 rounded-lg p-1 space-x-1">
            <button
              onClick={() => setActiveTab("lightning")}
              className={`w-1/3 py-2 text-sm font-semibold rounded-md transition-colors ${
                activeTab === "lightning"
                  ? "bg-accent text-white"
                  : "text-secondary-foreground hover:bg-accent/50"
              }`}
            >
              Lightning
            </button>
            <button
              onClick={() => setActiveTab("bitcoin")}
              className={`w-1/3 py-2 text-sm font-semibold rounded-md transition-colors ${
                activeTab === "bitcoin"
                  ? "bg-accent text-white"
                  : "text-secondary-foreground hover:bg-accent/50"
              }`}
            >
              Bitcoin
            </button>
            <button
              onClick={() => setActiveTab("request")}
              className={`w-1/3 py-2 text-sm font-semibold rounded-md transition-colors ${
                activeTab === "request"
                  ? "bg-accent text-white"
                  : "text-secondary-foreground hover:bg-accent/50"
              }`}
            >
              Request Amount
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto">
          {activeTab === "lightning" && (
            <div className="text-center">
              <div className="bg-white p-4 rounded-lg inline-block">
                <img
                  src={`data:image/png;base64,${account?.lnurl_qr_code}`}
                  alt="LNURL QR Code"
                  className="w-48 h-48"
                />
              </div>
              <div className="mt-4">
                <p className="text-secondary-foreground text-sm mb-2">
                  Lightning Address
                </p>
                <div className="bg-background rounded-lg px-4 py-3 flex items-center justify-between">
                  <span className="font-mono text-sm truncate">
                    {account?.alias}
                  </span>
                  <button
                    onClick={() => copyToClipboard(account?.lnurl || "")}
                    className="p-2 text-secondary-foreground hover:text-foreground rounded-full"
                    title="Copy LNURL"
                  >
                    {copied ? (
                      <Check size={18} className="text-success" />
                    ) : (
                      <ClipboardCopy size={18} />
                    )}
                  </button>
                </div>
              </div>
              {showShareButton && (
                <button
                  onClick={() =>
                    handleShare(
                      "My Lightning Address",
                      `You can send me Bitcoin on the Lightning Network using this address: ${account?.alias}`
                    )
                  }
                  className="mt-6 w-full bg-accent text-white font-bold py-3 px-4 rounded-lg hover:bg-accent/80 transition flex items-center justify-center"
                >
                  <Share2 size={18} className="mr-2" />
                  Share
                </button>
              )}
            </div>
          )}

          {activeTab === "bitcoin" && (
            <div className="text-center">
              <div className="bg-white p-4 rounded-lg inline-block">
                <img
                  src={`data:image/png;base64,${account?.bitcoin_address_qr_code}`}
                  alt="Bitcoin Address QR Code"
                  className="w-48 h-48"
                />
              </div>
              <div className="mt-4">
                <p className="text-secondary-foreground text-sm mb-2">
                  Bitcoin Address
                </p>
                <div className="bg-background rounded-lg px-4 py-3 flex items-center justify-between">
                  <span className="font-mono text-sm break-all">
                    {account?.bitcoin_address}
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(account?.bitcoin_address || "")
                    }
                    className="p-2 text-secondary-foreground hover:text-foreground rounded-full"
                    title="Copy Bitcoin Address"
                  >
                    {copied ? (
                      <Check size={18} className="text-success" />
                    ) : (
                      <ClipboardCopy size={18} />
                    )}
                  </button>
                </div>
              </div>
              {showShareButton && (
                <button
                  onClick={() =>
                    handleShare(
                      "My Bitcoin Address",
                      `You can send me Bitcoin On Chain using this address: ${account?.bitcoin_address}`
                    )
                  }
                  className="mt-6 w-full bg-accent text-white font-bold py-3 px-4 rounded-lg hover:bg-accent/80 transition flex items-center justify-center"
                >
                  <Share2 size={18} className="mr-2" />
                  Share
                </button>
              )}
            </div>
          )}

          {activeTab === "request" && (
            <div>
              {invoice ? (
                <div className="mt-4 p-4 bg-background rounded-lg">
                  <div className="text-center">
                    <div className="bg-white p-4 rounded-lg inline-block">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${invoice.payment_request}`}
                        alt="Invoice QR Code"
                        className="w-48 h-48"
                      />
                    </div>
                  </div>
                  <div className="mt-4 bg-zinc-900 rounded-lg px-4 py-3 flex items-center justify-between">
                    <span className="font-mono text-xs break-all">
                      {invoice.payment_request}
                    </span>
                    <button
                      onClick={() => copyToClipboard(invoice.payment_request)}
                      className="p-2 text-secondary-foreground hover:text-foreground rounded-full"
                    >
                      {copied ? (
                        <Check size={18} className="text-success" />
                      ) : (
                        <ClipboardCopy size={18} />
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <Bitcoin
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-foreground"
                      size={20}
                    />
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Amount (sats)"
                      className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="relative">
                    <Edit
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-foreground"
                      size={20}
                    />
                    <input
                      type="text"
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                      placeholder="Memo (optional)"
                      className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <button
                    onClick={handleGenerate}
                    disabled={loading || !amount}
                    className="w-full bg-primary text-primary-foreground font-bold py-3 px-4 rounded-lg hover:bg-primary/80 disabled:opacity-50 transition"
                  >
                    {loading ? "Generating..." : "Generate Invoice"}
                  </button>
                  {error && (
                    <div className="text-destructive text-center text-sm mt-2">
                      {error}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
