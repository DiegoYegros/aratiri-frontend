"use client";
import { ArrowLeft, Bitcoin, Edit, QrCode, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  apiCall,
  DecodedInvoice,
  DecodedResponse,
  EstimateFeeResponse,
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
  const [onChainAmount, setOnChainAmount] = useState("");
  const [fee, setFee] = useState<EstimateFeeResponse | null>(null);
  const [showFee, setShowFee] = useState(false);

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

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (!decoded) {
        handleDecode(inputValue);
      } else if (decoded.type === "bitcoin_address" && !showFee) {
        handleEstimateFee();
      } else {
        handlePay();
      }
    }
  };

  const handleDecode = async (valueToDecode: string) => {
    if (!valueToDecode) return;
    setLoading(true);
    setError("");
    setDecoded(null);
    setSuccess("");
    setLnurlAmount("");
    setLnurlComment("");
    setOnChainAmount("");
    setFee(null);
    setShowFee(false);

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

  const handleEstimateFee = async () => {
    if (!decoded || decoded.type !== "bitcoin_address" || !onChainAmount)
      return;
    setLoading(true);
    setError("");
    try {
      const data: EstimateFeeResponse = await apiCall(
        "/payments/onchain/estimate-fee",
        {
          method: "POST",
          body: JSON.stringify({
            address: decoded.data,
            sats_amount: parseInt(onChainAmount),
          }),
        }
      );
      setFee(data);
      setShowFee(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
      } else if (decoded.type === "bitcoin_address") {
        data = await apiCall("/payments/onchain", {
          method: "POST",
          body: JSON.stringify({
            address: decoded.data,
            sats_amount: parseInt(onChainAmount),
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

  const handleBack = () => {
    setDecoded(null);
    setError("");
    setSuccess("");
  };

  const renderDecodedContent = () => {
    if (!decoded || !decoded.data) return null;

    switch (decoded.type) {
      case "lightning_invoice":
        const invoice = decoded.data as DecodedInvoice;
        return (
          <div className="mt-6 bg-secondary/50 p-4 rounded-lg space-y-3 animate-fade-in">
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
              className="w-full bg-primary text-primary-foreground font-bold py-3 px-4 rounded-lg hover:bg-primary/80 disabled:opacity-50 transition"
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
          <div className="mt-6 bg-secondary/50 p-4 rounded-lg space-y-4 animate-fade-in">
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
                onKeyDown={handleKeyDown}
                placeholder={`Amount (${(
                  params.minSendable / 1000
                ).toLocaleString()} - ${(
                  params.maxSendable / 1000
                ).toLocaleString()} sats)`}
                className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
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
                  onKeyDown={handleKeyDown}
                  placeholder={`Comment (optional, max ${params.commentAllowed} chars)`}
                  maxLength={params.commentAllowed}
                  className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}
            <button
              onClick={handlePay}
              disabled={loading || !lnurlAmount}
              className="w-full bg-primary text-primary-foreground font-bold py-3 px-4 rounded-lg hover:bg-primary/80 disabled:opacity-50 transition"
            >
              {loading ? "Processing..." : "Pay"}
            </button>
          </div>
        );

      case "bitcoin_address":
        return (
          <div className="mt-6 bg-secondary/50 p-4 rounded-lg space-y-4 animate-fade-in">
            <div className="relative">
              <Bitcoin
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="number"
                value={onChainAmount}
                onChange={(e) => setOnChainAmount(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Amount (sats)"
                className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={showFee}
              />
            </div>
            {showFee && fee ? (
              <div className="text-center">
                <p>Fee: {fee.fee_sat.toLocaleString()} sats</p>
                <p>
                  Total:{" "}
                  {(parseInt(onChainAmount) + fee.fee_sat).toLocaleString()}{" "}
                  sats
                </p>
                <button
                  onClick={handlePay}
                  disabled={loading}
                  className="w-full mt-4 bg-primary text-primary-foreground font-bold py-3 px-4 rounded-lg hover:bg-primary/80 disabled:opacity-50 transition"
                >
                  {loading ? "Sending..." : "Confirm and Send"}
                </button>
              </div>
            ) : (
              <button
                onClick={handleEstimateFee}
                disabled={loading || !onChainAmount}
                className="w-full bg-primary text-primary-foreground font-bold py-3 px-4 rounded-lg hover:bg-primary/80 disabled:opacity-50 transition"
              >
                {loading ? "Estimating Fee..." : "Continue"}
              </button>
            )}
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
      <div className="bg-secondary p-6 rounded-2xl w-full max-w-md m-4 border border-border">
        <div className="flex justify-between items-center mb-6">
          {decoded ? (
            <button
              onClick={handleBack}
              className="p-2 text-secondary-foreground hover:text-foreground"
            >
              <ArrowLeft />
            </button>
          ) : (
            <div className="w-8" />
          )}
          <h2 className="text-2xl font-bold">
            {decoded ? "Details" : "Send Payment"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-secondary-foreground hover:text-foreground"
          >
            <X />
          </button>
        </div>

        {!decoded && (
          <div className="space-y-4">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste Invoice, LNURL, Address, or Alias"
              className="w-full h-32 px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
            />
            <div className="flex space-x-2">
              <button
                onClick={() => handleDecode(inputValue)}
                disabled={loading || !inputValue}
                className="flex-grow bg-accent text-white font-bold py-3 px-4 rounded-lg hover:bg-accent/80 disabled:opacity-50 transition"
              >
                {loading ? "Decoding..." : "Decode"}
              </button>
              <button
                onClick={() => setIsScanning(true)}
                className="bg-accent text-white p-3 rounded-lg hover:bg-accent/80 disabled:opacity-50 transition"
                title="Scan QR Code"
              >
                <QrCode />
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="text-destructive text-center mt-4">{error}</div>
        )}
        {success && (
          <div className="text-success text-center mt-4">{success}</div>
        )}

        {renderDecodedContent()}
      </div>
    </div>
  );
};
