"use client";
import {
  ArrowLeft,
  Bitcoin,
  Check,
  ClipboardCopy,
  Edit,
  Share2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Account, apiCall } from "../../lib/api";
import { useTranslation } from "@/app/hooks/useTranslation";
import { Modal } from "../ui/Modal";
import { IconButton } from "../ui/IconButton";
import { Alert } from "../ui/Alert";

interface ReceiveModalProps {
  account: Account | null;
  onClose: () => void;
}

const fieldClass =
  "w-full pl-10 pr-4 py-3 bg-input border border-panel-edge rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent text-foreground";

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
  const t = useTranslation();

  useEffect(() => {
    if (typeof navigator.share === "function") {
      setShowShareButton(true);
    }
  }, []);

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
    } catch {
      // User cancelled share sheet
    }
  };

  const handleBackToRequest = () => {
    setInvoice(null);
    setAmount("");
    setMemo("");
  };

  const tabClass = (id: string) =>
    `flex-1 min-h-11 py-2 text-sm font-semibold rounded-md transition-colors ${
      activeTab === id
        ? "bg-panel-elevated text-foreground border border-panel-edge"
        : "text-muted hover:text-foreground"
    }`;

  return (
    <Modal
      title={t("Receive")}
      onClose={onClose}
      labelledBy="receive-modal-title"
      padded={false}
      leading={
        invoice && activeTab === "request" ? (
          <IconButton label={t("Back")} onClick={handleBackToRequest}>
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </IconButton>
        ) : undefined
      }
    >
      <div
        role="tablist"
        aria-label={t("Receive options")}
        className="flex gap-1 p-2 border-b border-panel-edge bg-panel"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "lightning"}
          id="tab-lightning"
          onClick={() => setActiveTab("lightning")}
          className={tabClass("lightning")}
        >
          {t("Lightning")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "bitcoin"}
          id="tab-bitcoin"
          onClick={() => setActiveTab("bitcoin")}
          className={tabClass("bitcoin")}
        >
          {t("Bitcoin")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "request"}
          id="tab-request"
          onClick={() => setActiveTab("request")}
          className={tabClass("request")}
        >
          {t("Request Amount")}
        </button>
      </div>

      <div className="p-4 sm:p-6 overflow-y-auto">
        {activeTab === "lightning" && (
          <div
            role="tabpanel"
            aria-labelledby="tab-lightning"
            className="text-center"
          >
            <div className="bg-white p-4 rounded-lg inline-block">
              <img
                src={`data:image/png;base64,${account?.lnurl_qr_code}`}
                alt={t("Lightning Address")}
                className="w-48 h-48"
              />
            </div>
            <div className="mt-4">
              <p className="text-muted text-sm mb-2">{t("Lightning Address")}</p>
              <div className="bg-input border border-panel-edge rounded-lg px-4 py-2 flex items-center justify-between gap-2">
                <span className="font-address text-sm truncate">
                  {account?.alias}
                </span>
                <IconButton
                  label={t("Copy LNURL")}
                  onClick={() => copyToClipboard(account?.lnurl || "")}
                >
                  {copied ? (
                    <Check size={18} className="text-success" aria-hidden="true" />
                  ) : (
                    <ClipboardCopy size={18} aria-hidden="true" />
                  )}
                </IconButton>
              </div>
            </div>
            {showShareButton && (
              <button
                type="button"
                onClick={() =>
                  handleShare(
                    t("My Lightning Address"),
                    t(
                      "You can send me Bitcoin on the Lightning Network using this address: {address}",
                      { address: account?.alias || "" }
                    )
                  )
                }
                className="mt-6 w-full min-h-11 bg-panel-elevated border border-panel-edge text-foreground font-semibold py-3 px-4 rounded-lg hover:bg-input transition flex items-center justify-center"
              >
                <Share2 size={18} className="mr-2" aria-hidden="true" />
                {t("Share")}
              </button>
            )}
          </div>
        )}

        {activeTab === "bitcoin" && (
          <div
            role="tabpanel"
            aria-labelledby="tab-bitcoin"
            className="text-center"
          >
            <div className="bg-white p-4 rounded-lg inline-block">
              <img
                src={`data:image/png;base64,${account?.bitcoin_address_qr_code}`}
                alt={t("Bitcoin Address")}
                className="w-48 h-48"
              />
            </div>
            <div className="mt-4">
              <p className="text-muted text-sm mb-2">{t("Bitcoin Address")}</p>
              <div className="bg-input border border-panel-edge rounded-lg px-4 py-2 flex items-center justify-between gap-2">
                <span className="font-address text-sm break-all text-left">
                  {account?.bitcoin_address}
                </span>
                <IconButton
                  label={t("Copy Bitcoin Address")}
                  onClick={() =>
                    copyToClipboard(account?.bitcoin_address || "")
                  }
                >
                  {copied ? (
                    <Check size={18} className="text-success" aria-hidden="true" />
                  ) : (
                    <ClipboardCopy size={18} aria-hidden="true" />
                  )}
                </IconButton>
              </div>
            </div>
            {showShareButton && (
              <button
                type="button"
                onClick={() =>
                  handleShare(
                    t("My Bitcoin Address"),
                    t(
                      "You can send me Bitcoin On Chain using this address: {address}",
                      { address: account?.bitcoin_address || "" }
                    )
                  )
                }
                className="mt-6 w-full min-h-11 bg-panel-elevated border border-panel-edge text-foreground font-semibold py-3 px-4 rounded-lg hover:bg-input transition flex items-center justify-center"
              >
                <Share2 size={18} className="mr-2" aria-hidden="true" />
                {t("Share")}
              </button>
            )}
          </div>
        )}

        {activeTab === "request" && (
          <div role="tabpanel" aria-labelledby="tab-request">
            {invoice ? (
              <div className="p-4 bg-input border border-panel-edge rounded-lg">
                <div className="text-center">
                  <div className="bg-white p-4 rounded-lg inline-block">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${invoice.payment_request}`}
                      alt={t("Invoice QR Code")}
                      className="w-48 h-48"
                    />
                  </div>
                </div>
                <div className="mt-4 bg-panel border border-panel-edge rounded-lg px-4 py-2 flex items-center justify-between gap-2">
                  <span className="font-address text-xs break-all text-left">
                    {invoice.payment_request}
                  </span>
                  <IconButton
                    label={t("Copy invoice")}
                    onClick={() => copyToClipboard(invoice.payment_request)}
                  >
                    {copied ? (
                      <Check size={18} className="text-success" aria-hidden="true" />
                    ) : (
                      <ClipboardCopy size={18} aria-hidden="true" />
                    )}
                  </IconButton>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <label htmlFor="request-amount" className="sr-only">
                    {t("Amount (sats)")}
                  </label>
                  <Bitcoin
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                    size={20}
                    aria-hidden="true"
                  />
                  <input
                    id="request-amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={t("Amount (sats)")}
                    className={fieldClass}
                  />
                </div>
                <div className="relative">
                  <label htmlFor="request-memo" className="sr-only">
                    {t("Memo (optional)")}
                  </label>
                  <Edit
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                    size={20}
                    aria-hidden="true"
                  />
                  <input
                    id="request-memo"
                    type="text"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder={t("Memo (optional)")}
                    className={fieldClass}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={loading || !amount}
                  className="w-full min-h-11 bg-accent text-accent-fg font-semibold py-3 px-4 rounded-lg hover:bg-accent-hover disabled:opacity-50 transition"
                >
                  {loading ? t("Generating...") : t("Generate Invoice")}
                </button>
                {error && <Alert variant="danger">{error}</Alert>}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
