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
    <div className="space-y-6">
      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}
      {message && <Alert variant="success">{message}</Alert>}

      <div>
        <p className="text-sm font-semibold mb-1">{t("Backup status")}</p>
        {meta.backup_verified ? (
          <Alert variant="success">
            {t("Backup verified — you have a written copy of your phrase.")}
          </Alert>
        ) : (
          <Alert variant="danger">
            {t("Not backed up yet. Your phrase has not been verified.")}
          </Alert>
        )}
        {!meta.backup_verified && (
          <button
            type="button"
            onClick={() => void setBackupVerified(true)}
            className="mt-2 text-sm font-semibold text-accent hover:underline touch-manipulation"
          >
            {t("I've written it down — mark as backed up")}
          </button>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold">{t("Privacy mode")}</p>
          <button
            type="button"
            role="switch"
            aria-checked={meta.privacy_enabled}
            aria-label={t("Privacy mode")}
            onClick={togglePrivacy}
            disabled={privacyBusy}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-50 ${
              meta.privacy_enabled ? "bg-accent" : "bg-panel-elevated border border-panel-edge"
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
        <p className="text-sm text-muted">
          {meta.privacy_enabled
            ? t(
                "Your balance isn't visible to third parties or in the locked view. It shows only after you unlock this wallet."
              )
            : t(
                "When locked, your balance stays readable on this device. Turning privacy on hides it until you unlock."
              )}
        </p>
      </div>

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

      <div className="border border-danger/30 rounded-lg p-4">
        <p className="text-sm font-semibold text-danger mb-1">
          {t("Forget this wallet")}
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
            className="inline-flex items-center gap-2 min-h-11 px-4 text-sm font-semibold rounded-lg border border-danger/40 text-danger hover:bg-danger/10 transition touch-manipulation"
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
