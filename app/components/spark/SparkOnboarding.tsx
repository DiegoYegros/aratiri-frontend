"use client";

import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { Alert } from "../ui/Alert";
import { IconButton } from "../ui/IconButton";
import { Modal } from "../ui/Modal";
import { useSpark } from "./SparkProvider";
import { MnemonicEntry } from "./MnemonicEntry";
import { MnemonicGrid } from "./MnemonicGrid";
import { MnemonicVerify } from "./MnemonicVerify";

type CreateStep = "explain" | "generate" | "verify" | "ready";
type RestoreStep = "import" | "confirm" | "done";

export const SparkOnboarding = ({
  initialMode = "create",
  onClose,
  onComplete,
}: {
  initialMode?: "create" | "restore";
  onClose: () => void;
  onComplete: () => void;
}) => {
  const t = useTranslation();
  const {
    createNew,
    restore,
    deriveSparkAddress,
    setBackupVerified,
    meta,
  } = useSpark();

  const [mode, setMode] = useState<"create" | "restore">(initialMode);
  const [createStep, setCreateStep] = useState<CreateStep>("explain");
  const [restoreStep, setRestoreStep] = useState<RestoreStep>("import");
  const [phrase, setPhrase] = useState<string | null>(null);
  const [derivedAddress, setDerivedAddress] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title =
    mode === "create"
      ? t("Create a Spark wallet")
      : t("Restore a Spark wallet");

  const handleBack = () => {
    setError(null);
    if (mode === "create") {
      if (createStep === "generate") setCreateStep("explain");
      else if (createStep === "verify") setCreateStep("generate");
    } else if (restoreStep === "confirm") setRestoreStep("import");
  };

  const showBack =
    (mode === "create" && createStep !== "ready") ||
    (mode === "restore" && restoreStep === "confirm");

  const handleCreate = async () => {
    setError(null);
    if (phrase) {
      setCreateStep("generate");
      return;
    }
    setBusy(true);
    try {
      const generated = await createNew();
      setPhrase(generated);
      setCreateStep("generate");
    } catch (err: any) {
      setError(err?.message ?? t("Failed to create wallet."));
    } finally {
      setBusy(false);
    }
  };

  const handleVerified = async () => {
    try {
      await setBackupVerified(true);
    } catch {
      // metadata flag is best-effort; the local checkpoint still passes
    }
    setCreateStep("ready");
  };

  const handleRestoreImport = async (imported: string) => {
    setError(null);
    setBusy(true);
    try {
      const address = await deriveSparkAddress(imported);
      setPhrase(imported);
      setDerivedAddress(address);
      setRestoreStep("confirm");
    } catch (err: any) {
      setError(
        err?.message ??
          t("That doesn't look like a valid backup phrase. Check each word.")
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRestoreConfirm = async () => {
    if (!phrase) return;
    setError(null);
    setBusy(true);
    try {
      await restore(phrase);
      setRestoreStep("done");
    } catch (err: any) {
      setError(err?.message ?? t("Failed to restore wallet."));
      setBusy(false);
    }
  };

  const sparkAddress = derivedAddress ?? meta?.spark_address ?? null;

  return (
    <Modal
      title={title}
      onClose={onClose}
      labelledBy="spark-onboarding-title"
      leading={
        showBack ? (
          <IconButton label={t("Back")} onClick={handleBack}>
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </IconButton>
        ) : undefined
      }
    >
      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {mode === "create" && createStep === "explain" && (
        <div className="space-y-5">
          <div className="space-y-3 text-sm leading-relaxed">
            <p>{t("This wallet is yours alone.")}</p>
            <p>
              {t(
                "Your 12-word backup phrase is the only way to access it. If you lose it, no one — not even Aratiri — can help you recover it."
              )}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm rounded-lg border border-panel-edge divide-x divide-panel-edge">
            <div className="p-3">
              <p className="font-semibold mb-1">{t("Custodial")}</p>
              <p className="text-muted">{t("Aratiri holds your keys.")}</p>
            </div>
            <div className="p-3 bg-accent-subtle/40">
              <p className="font-semibold mb-1 text-accent">
                {t("Self-custody")}
              </p>
              <p className="text-muted">
                {t("You hold your keys. Aratiri can't recover them.")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy}
            className="w-full min-h-12 bg-accent-subtle text-accent font-semibold py-3 px-4 rounded-lg border border-accent/30 hover:bg-accent/25 transition disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 touch-manipulation"
          >
            <KeyRound className="w-5 h-5" aria-hidden="true" />
            {busy ? t("Generating...") : t("Create a Spark wallet")}
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode("restore");
              setRestoreStep("import");
            }}
            className="w-full min-h-12 text-sm font-semibold text-muted hover:text-foreground transition touch-manipulation"
          >
            {t("Restore a wallet")}
          </button>
        </div>
      )}

      {mode === "create" && createStep === "generate" && phrase && (
        <div className="space-y-5">
          <Alert variant="danger">
            {t(
              "Don't screenshot. Don't paste into chat. Write it down now."
            )}
          </Alert>
          <p className="text-sm text-muted">
            {t("Write down your backup phrase in order. Keep it offline.")}
          </p>
          <MnemonicGrid mnemonic={phrase} />
          <button
            type="button"
            onClick={() => setCreateStep("verify")}
            className="w-full min-h-12 bg-accent-subtle text-accent font-semibold py-3 px-4 rounded-lg border border-accent/30 hover:bg-accent/25 transition touch-manipulation"
          >
            {t("I've written it down")}
          </button>
        </div>
      )}

      {mode === "create" && createStep === "verify" && phrase && (
        <MnemonicVerify mnemonic={phrase} onVerified={handleVerified} />
      )}

      {mode === "create" && createStep === "ready" && (
        <div className="space-y-5 text-center">
          <div className="flex justify-center">
            <ShieldCheck className="w-10 h-10 text-success" aria-hidden="true" />
          </div>
          <p className="font-semibold">{t("Your backup is verified.")}</p>
          <p className="text-sm text-muted">
            {t("Your Spark wallet is ready. Here is your address:")}
          </p>
          {sparkAddress ? (
            <p className="font-mono text-sm break-all bg-panel-elevated border border-panel-edge rounded-lg p-3">
              {sparkAddress}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onComplete}
            className="w-full min-h-12 bg-accent-subtle text-accent font-semibold py-3 px-4 rounded-lg border border-accent/30 hover:bg-accent/25 transition touch-manipulation"
          >
            {t("Deposit Bitcoin")}
          </button>
        </div>
      )}

      {mode === "restore" && restoreStep === "import" && (
        <MnemonicEntry onContinue={handleRestoreImport} busy={busy} />
      )}

      {mode === "restore" && restoreStep === "confirm" && (
        <div className="space-y-5">
          <p className="text-sm text-muted">
            {t("This is the wallet you're restoring:")}
          </p>
          {derivedAddress ? (
            <p className="font-mono text-sm break-all bg-panel-elevated border border-panel-edge rounded-lg p-3">
              {derivedAddress}
            </p>
          ) : null}
          <p className="text-sm text-muted">
            {t(
              "Check it matches the address you expect before continuing. A wrong phrase opens a different wallet."
            )}
          </p>
          <button
            type="button"
            onClick={handleRestoreConfirm}
            disabled={busy}
            className="w-full min-h-12 bg-accent-subtle text-accent font-semibold py-3 px-4 rounded-lg border border-accent/30 hover:bg-accent/25 transition disabled:opacity-50 disabled:pointer-events-none touch-manipulation"
          >
            {busy ? t("Restoring...") : t("Restore this wallet")}
          </button>
        </div>
      )}

      {mode === "restore" && restoreStep === "done" && (
        <div className="space-y-5 text-center">
          <div className="flex justify-center">
            <ShieldCheck className="w-10 h-10 text-success" aria-hidden="true" />
          </div>
          <p className="font-semibold">{t("Wallet restored.")}</p>
          <button
            type="button"
            onClick={onComplete}
            className="w-full min-h-12 bg-accent-subtle text-accent font-semibold py-3 px-4 rounded-lg border border-accent/30 hover:bg-accent/25 transition touch-manipulation"
          >
            {t("Continue")}
          </button>
        </div>
      )}
    </Modal>
  );
};
