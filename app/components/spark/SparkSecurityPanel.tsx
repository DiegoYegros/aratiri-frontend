"use client";

import { Lock, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { Alert } from "../ui/Alert";
import { useSpark } from "./SparkProvider";
import { SPARK_ACCOUNT_INDEX, SPARK_NETWORK } from "../../lib/spark/network";

export const SparkSecurityPanel = () => {
  const t = useTranslation();
  const {
    meta,
    mnemonic,
    lock,
    setBackupVerified,
    setPrivacy,
    forget,
  } = useSpark();

  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [lockBusy, setLockBusy] = useState(false);
  const [forgetMode, setForgetMode] = useState(false);
  const [forgetText, setForgetText] = useState("");
  const [forgetBusy, setForgetBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!meta) return null;

  const shortAddress = meta.spark_address
    ? `${meta.spark_address.slice(0, 6)}…${meta.spark_address.slice(-4)}`
    : "";

  const togglePrivacy = async () => {
    setError(null);
    setMessage(null);
    setPrivacyBusy(true);
    try {
      await setPrivacy(!meta.privacy_enabled);
      setMessage(
        meta.privacy_enabled
          ? t("Privacy mode off. Your balance is visible in the locked view.")
          : t(
              "Privacy mode on. Your balance is hidden until you unlock this wallet."
            )
      );
    } catch (err: any) {
      setError(err?.message ?? t("Failed to update privacy mode."));
    } finally {
      setPrivacyBusy(false);
    }
  };

  const handleLock = async () => {
    setError(null);
    setLockBusy(true);
    try {
      await lock();
      setMessage(t("Wallet locked. The mnemonic was cleared from memory."));
    } catch (err: any) {
      setError(err?.message ?? t("Failed to lock wallet."));
    } finally {
      setLockBusy(false);
    }
  };

  const handleForget = async () => {
    setError(null);
    setForgetBusy(true);
    try {
      await forget();
      setForgetMode(false);
      setForgetText("");
    } catch (err: any) {
      setError(err?.message ?? t("Failed to forget wallet."));
    } finally {
      setForgetBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {error && (
        <Alert variant="danger">
          {error}
        </Alert>
      )}
      {message && (
        <p className="text-sm text-success" role="status">
          {message}
        </p>
      )}

      <div>
        <p className="text-sm font-semibold mb-1">{t("Network & account")}</p>
        <p className="text-sm text-muted font-mono">
          {SPARK_NETWORK} · account {SPARK_ACCOUNT_INDEX}
        </p>
        <p className="text-sm text-muted font-mono break-all mt-1">
          {meta.spark_address}
        </p>
      </div>

      <div>
        <p className="text-sm font-semibold mb-1">{t("Backup status")}</p>
        {meta.backup_verified ? (
          <p className="text-sm text-success">
            {t("Backup verified — you have a written copy of your phrase.")}
          </p>
        ) : (
          <>
            <p className="text-sm text-accent">
              {t("Not backed up yet. Your phrase has not been verified.")}
            </p>
            <button
              type="button"
              onClick={() => void setBackupVerified(true)}
              className="mt-2 min-h-11 px-4 text-sm font-semibold rounded-lg border border-accent/30 bg-accent-subtle text-accent hover:bg-accent/25 transition touch-manipulation"
            >
              {t("Mark as backed up")}
            </button>
          </>
        )}
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{t("Privacy mode")}</p>
          <p className="text-sm text-muted mt-1">
            {meta.privacy_enabled
              ? t(
                  "Your balance isn't visible to third parties or in the locked view. It shows only after you unlock this wallet."
                )
              : t(
                  "When locked, your balance stays readable on this device. Turning privacy on hides it until you unlock."
                )}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={meta.privacy_enabled}
          aria-label={t("Privacy mode")}
          onClick={togglePrivacy}
          disabled={privacyBusy}
          className={`relative shrink-0 inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-50 ${
            meta.privacy_enabled
              ? "bg-accent"
              : "bg-panel-elevated border border-panel-edge"
          }`}
        >
          <span
            aria-hidden="true"
            className={`inline-block h-5 w-5 transform rounded-full bg-foreground transition-transform ${
              meta.privacy_enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <div>
        <button
          type="button"
          onClick={handleLock}
          disabled={lockBusy || !mnemonic}
          className="inline-flex items-center gap-2 min-h-11 px-4 text-sm font-semibold rounded-lg border border-panel-edge text-muted hover:text-foreground hover:bg-panel-elevated transition disabled:opacity-50 disabled:pointer-events-none touch-manipulation"
        >
          <Lock className="w-4 h-4" aria-hidden="true" />
          {lockBusy ? t("Locking...") : t("Lock wallet")}
        </button>
      </div>

      <div className="border-t border-panel-edge pt-5">
        <p className="text-sm font-semibold mb-1">
          {t("Remove from this device")}
        </p>
        <p className="text-sm text-muted mb-3">
          {t(
            "Forgetting is not a backup. If you lose your phrase, your funds are gone forever."
          )}
        </p>
        {!forgetMode ? (
          <button
            type="button"
            onClick={() => setForgetMode(true)}
            className="inline-flex items-center gap-2 min-h-11 px-4 text-sm font-semibold rounded-lg border border-panel-edge text-muted hover:text-foreground hover:bg-panel-elevated transition touch-manipulation"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            {t("Forget this wallet")}
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              {t("Type {address} to confirm.", { address: shortAddress })}
            </p>
            <input
              value={forgetText}
              onChange={(e) => setForgetText(e.target.value)}
              autoComplete="off"
              aria-label={t("Confirm address")}
              className="w-full min-h-11 px-3 rounded-lg border border-panel-edge bg-panel font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setForgetMode(false);
                  setForgetText("");
                }}
                className="flex-1 min-h-11 text-sm font-semibold rounded-lg border border-panel-edge text-muted hover:text-foreground hover:bg-panel-elevated transition touch-manipulation"
              >
                {t("Cancel")}
              </button>
              <button
                type="button"
                onClick={handleForget}
                disabled={
                  forgetBusy ||
                  forgetText.toLowerCase() !== shortAddress.toLowerCase()
                }
                className="flex-1 min-h-11 text-sm font-semibold rounded-lg border border-danger/40 text-danger hover:bg-danger/10 transition disabled:opacity-50 disabled:pointer-events-none touch-manipulation"
              >
                {forgetBusy ? t("Forgetting...") : t("Confirm forget")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
