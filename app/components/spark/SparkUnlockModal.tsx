"use client";

import { useState } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { Alert } from "../ui/Alert";
import { Modal } from "../ui/Modal";
import { MnemonicEntry } from "./MnemonicEntry";
import { useSpark } from "./SparkProvider";

export const SparkUnlockModal = ({ onClose }: { onClose: () => void }) => {
  const t = useTranslation();
  const { unlock } = useSpark();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnlock = async (phrase: string) => {
    setError(null);
    setBusy(true);
    try {
      await unlock(phrase);
      onClose();
    } catch (err: any) {
      setError(err?.message ?? t("Failed to unlock wallet."));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={t("Unlock Spark wallet")}
      onClose={onClose}
      labelledBy="spark-unlock-title"
    >
      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}
      <MnemonicEntry onContinue={handleUnlock} busy={busy} />
    </Modal>
  );
};
