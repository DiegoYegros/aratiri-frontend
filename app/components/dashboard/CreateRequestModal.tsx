"use client";

import { Bitcoin, Edit } from "lucide-react";
import { FormEvent, useRef, useState } from "react";
import { apiCall, PaymentRequest } from "../../lib/api";
import {
  createIdempotencyKey,
  EXPIRY_OPTIONS,
  isValidAmountSats,
  MAX_EXPIRES_IN_SECONDS,
  MAX_MEMO_LENGTH,
  MIN_EXPIRES_IN_SECONDS,
} from "../../lib/paymentRequests";
import { useTranslation } from "@/app/hooks/useTranslation";
import { Modal } from "../ui/Modal";
import { Alert } from "../ui/Alert";

const fieldClass =
  "w-full pl-10 pr-4 py-3 min-h-11 bg-input border border-panel-edge rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent text-foreground";

interface CreateRequestModalProps {
  onClose: () => void;
  onCreated: (request: PaymentRequest) => void;
}

export const CreateRequestModal = ({
  onClose,
  onCreated,
}: CreateRequestModalProps) => {
  const t = useTranslation();
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [expiresInSeconds, setExpiresInSeconds] = useState<number>(86400);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const idempotencyKeyRef = useRef<string | null>(null);
  const lastPayloadFingerprintRef = useRef<string | null>(null);
  const submittingRef = useRef(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submittingRef.current || loading) return;

    if (!isValidAmountSats(amount)) {
      setError(t("Enter a positive integer amount in sats."));
      return;
    }

    const trimmedMemo = memo.trim();
    if (trimmedMemo.length > MAX_MEMO_LENGTH) {
      setError(t("Memo must be 500 characters or fewer."));
      return;
    }

    if (
      expiresInSeconds < MIN_EXPIRES_IN_SECONDS ||
      expiresInSeconds > MAX_EXPIRES_IN_SECONDS
    ) {
      setError(t("Choose a valid expiry."));
      return;
    }

    const body: {
      amount_sats: number;
      expires_in_seconds: number;
      memo?: string;
    } = {
      amount_sats: Number(amount),
      expires_in_seconds: expiresInSeconds,
    };
    if (trimmedMemo) {
      body.memo = trimmedMemo;
    }

    // Preserve Idempotency-Key only for an exact retry of the same payload.
    const payloadFingerprint = JSON.stringify(body);
    if (lastPayloadFingerprintRef.current !== payloadFingerprint) {
      idempotencyKeyRef.current = createIdempotencyKey();
      lastPayloadFingerprintRef.current = payloadFingerprint;
    } else if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = createIdempotencyKey();
    }

    submittingRef.current = true;
    setLoading(true);
    setError("");

    try {
      const created = (await apiCall("/payment-requests", {
        method: "POST",
        headers: {
          "Idempotency-Key": idempotencyKeyRef.current,
        },
        body: JSON.stringify(body),
      })) as PaymentRequest;

      idempotencyKeyRef.current = null;
      lastPayloadFingerprintRef.current = null;
      onCreated(created);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t("Failed to create request.");
      setError(message);
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <Modal
      title={t("New Request")}
      onClose={onClose}
      labelledBy="create-request-title"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="relative">
          <label htmlFor="create-request-amount" className="sr-only">
            {t("Amount (sats)")}
          </label>
          <Bitcoin
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            size={20}
            aria-hidden="true"
          />
          <input
            id="create-request-amount"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
            placeholder={t("Amount (sats)")}
            className={fieldClass}
            required
            aria-required="true"
            autoComplete="off"
          />
        </div>

        <div className="relative">
          <label htmlFor="create-request-memo" className="sr-only">
            {t("Memo (optional)")}
          </label>
          <Edit
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            size={20}
            aria-hidden="true"
          />
          <input
            id="create-request-memo"
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value.slice(0, MAX_MEMO_LENGTH))}
            placeholder={t("Memo (optional)")}
            className={fieldClass}
            maxLength={MAX_MEMO_LENGTH}
            autoComplete="off"
          />
        </div>

        <div>
          <label
            htmlFor="create-request-expiry"
            className="block text-sm text-muted mb-2"
          >
            {t("Expires in")}
          </label>
          <select
            id="create-request-expiry"
            value={expiresInSeconds}
            onChange={(e) => setExpiresInSeconds(Number(e.target.value))}
            className="w-full min-h-11 px-4 py-3 bg-input border border-panel-edge rounded-lg text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {EXPIRY_OPTIONS.map((option) => (
              <option key={option.seconds} value={option.seconds}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        <button
          type="submit"
          disabled={loading || !amount}
          aria-busy={loading}
          className="w-full min-h-11 bg-accent text-accent-fg font-semibold py-3 px-4 rounded-lg hover:bg-accent-hover disabled:opacity-50 transition touch-manipulation"
        >
          {loading ? t("Creating request...") : t("Create Request")}
        </button>
      </form>
    </Modal>
  );
};
