"use client";

import {
  SparkReadonlyClient,
  SparkWallet,
  SparkWalletEvent,
} from "@buildonspark/spark-sdk";
import type { SparkWallet as SparkWalletInstance } from "@buildonspark/spark-sdk";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import {
  SPARK_ACCOUNT_INDEX,
  SPARK_CONFIG,
  SPARK_NETWORK,
} from "../../lib/spark/network";
import {
  describeSparkError,
  isCoopExitTerminal,
  isLightningSendTerminal,
  SPARK_ALREADY_LINKED_MESSAGE,
  toTransferRows,
  type SparkTransferRow,
} from "../../lib/spark/mapping";
import {
  clearSparkWallet,
  loadSparkWallet,
  saveSparkWallet,
  updateSparkWallet,
  type SparkWalletMeta,
} from "../../lib/spark/storage";

export type { SparkTransferRow, SparkTransferKind } from "../../lib/spark/mapping";

export interface SparkBalance {
  available: number;
  owned: number;
  incoming: number;
}

export type SparkStatus = "loading" | "not-created" | "locked" | "unlocked";

export interface SparkContextValue {
  available: boolean;
  status: SparkStatus;
  meta: SparkWalletMeta | null;
  error: string | null;
  mnemonic: string | null;
  /** Live SDK wallet instance — present only while unlocked. */
  wallet: SparkWalletInstance | null;
  balance: SparkBalance | null;
  transactions: SparkTransferRow[] | null;
  refresh: () => Promise<void>;
  /** Generate a fresh mnemonic + save local metadata. Returns the phrase. */
  createNew: () => Promise<string>;
  /** Restore an existing wallet from a mnemonic + save local metadata. */
  restore: (mnemonic: string) => Promise<void>;
  /** Derive the spark address for a phrase WITHOUT saving (restore confirm step). */
  deriveSparkAddress: (mnemonic: string) => Promise<string>;
  /** Unlock the saved wallet; rejects on a phrase that doesn't match metadata. */
  unlock: (mnemonic: string) => Promise<void>;
  lock: () => Promise<void>;
  setBackupVerified: (verified: boolean) => Promise<void>;
  setPrivacy: (enabled: boolean) => Promise<void>;
  forget: () => Promise<void>;
  clearError: () => void;
  /**
   * Begin polling an async outgoing operation (lightning send / coop-exit
   * withdrawal) until it reaches a terminal state, then refresh. Single
   * active poller — re-entry replaces the previous one.
   */
  trackOutgoing: (kind: "lightning" | "withdrawal", id: string) => void;
}

/**
 * Inert default: without a provider (e.g. existing tests rendering Dashboard
 * directly) every Spark surface is simply unavailable.
 */
const DEFAULT_SPARK_CONTEXT: SparkContextValue = {
  available: false,
  status: "loading",
  meta: null,
  error: null,
  mnemonic: null,
  wallet: null,
  balance: null,
  transactions: null,
  refresh: async () => {},
  createNew: async () => {
    throw new Error("Spark is not available");
  },
  restore: async () => {
    throw new Error("Spark is not available");
  },
  deriveSparkAddress: async () => {
    throw new Error("Spark is not available");
  },
  unlock: async () => {
    throw new Error("Spark is not available");
  },
  lock: async () => {},
  setBackupVerified: async () => {},
  setPrivacy: async () => {},
  forget: async () => {},
  clearError: () => {},
  trackOutgoing: () => {},
};

const SparkContext = createContext<SparkContextValue>(DEFAULT_SPARK_CONTEXT);

export const SparkProvider = ({ children }: PropsWithChildren) => {
  const [meta, setMeta] = useState<SparkWalletMeta | null>(null);
  const [status, setStatus] = useState<SparkStatus>("loading");
  const [error, setErrorState] = useState<string | null>(null);
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [wallet, setWallet] = useState<SparkWalletInstance | null>(null);
  const [balance, setBalance] = useState<SparkBalance | null>(null);
  const [transactions, setTransactions] = useState<SparkTransferRow[] | null>(
    null
  );

  const walletRef = useRef<SparkWalletInstance | null>(null);
  const readonlyRef = useRef<SparkReadonlyClient | null>(null);
  const metaRef = useRef<SparkWalletMeta | null>(null);
  const balanceBindingRef = useRef<{
    wallet: SparkWalletInstance;
    handler: () => void;
  } | null>(null);
  const outgoingPollRef = useRef<{
    id: string;
    timer: ReturnType<typeof setInterval>;
  } | null>(null);

  const setError = useCallback((message: string | null) => {
    setErrorState(message);
  }, []);

  const clearError = useCallback(() => setErrorState(null), []);

  const buildReadonly = useCallback(() => {
    const client = SparkReadonlyClient.createPublic<SparkReadonlyClient>(
      SPARK_CONFIG
    );
    readonlyRef.current = client;
    return client;
  }, []);

  const syncWalletEvents = useCallback(
    (w: SparkWalletInstance, onChange: () => void) => {
      const prev = balanceBindingRef.current;
      if (prev) {
        prev.wallet.off(SparkWalletEvent.BalanceUpdate, prev.handler);
      }
      const handler = () => onChange();
      w.on(SparkWalletEvent.BalanceUpdate, handler);
      balanceBindingRef.current = { wallet: w, handler };
    },
    []
  );

  const refresh = useCallback(async () => {
    const current = walletRef.current;
    const client = readonlyRef.current;
    const currentMeta = metaRef.current;
    if (!currentMeta) {
      setBalance(null);
      setTransactions([]);
      return;
    }
    if (current) {
      try {
        const b = await current.getCachedBalance();
        setBalance({
          available: Number(b.satsBalance.available),
          owned: Number(b.satsBalance.owned),
          incoming: Number(b.satsBalance.incoming),
        });
        const { transfers } = await current.getTransfers(50, 0);
        setTransactions(
          toTransferRows(transfers as Parameters<typeof toTransferRows>[0])
        );
        return;
      } catch {
        // fall through to the readonly path if the live stream is unavailable
      }
    }
    if (client) {
      if (currentMeta.privacy_enabled) {
        // Privacy-on wallets are hidden from createPublic: never render zeros.
        setBalance(null);
        setTransactions(null);
        return;
      }
      try {
        const available = await client.getAvailableBalance(
          currentMeta.spark_address
        );
        setBalance({
          available: Number(available),
          owned: Number(available),
          incoming: 0,
        });
        const { transfers } = await client.getTransfers({
          sparkAddress: currentMeta.spark_address,
          limit: 50,
          offset: 0,
        });
        setTransactions(
          toTransferRows(
            transfers as Parameters<typeof toTransferRows>[0],
            currentMeta.identity_public_key
          )
        );
        return;
      } catch {
        setBalance(null);
        setTransactions(null);
      }
    }
  }, []);

  const registerWallet = useCallback(async (w: SparkWalletInstance) => {
    const address = await w.getSparkAddress();
    const identityPublicKey = await w.getIdentityPublicKey();
    const createdMeta = saveSparkWallet({
      identity_public_key: identityPublicKey,
      spark_address: address,
      network: SPARK_NETWORK,
      account_index: SPARK_ACCOUNT_INDEX,
      backup_verified: false,
      privacy_enabled: false,
    });
    metaRef.current = createdMeta;
    setMeta(createdMeta);
    return createdMeta;
  }, []);

  const adoptWallet = useCallback(
    (w: SparkWalletInstance) => {
      walletRef.current = w;
      setWallet(w);
      syncWalletEvents(w, () => {
        void refresh();
      });
      setStatus("unlocked");
      void refresh();
    },
    [refresh, syncWalletEvents]
  );

  const createNew = useCallback(async (): Promise<string> => {
    clearError();
    if (metaRef.current) {
      setError(SPARK_ALREADY_LINKED_MESSAGE);
      throw new Error(SPARK_ALREADY_LINKED_MESSAGE);
    }
    let w: SparkWalletInstance | null = null;
    let adopted = false;
    try {
      const { wallet, mnemonic: generated } =
        await SparkWallet.getOrCreateWallet({
          accountNumber: SPARK_ACCOUNT_INDEX,
          options: SPARK_CONFIG,
          forceReinit: true,
        });
      w = wallet;
      await registerWallet(w);
      const phrase = generated as string;
      setMnemonic(phrase);
      adoptWallet(w);
      adopted = true;
      return phrase;
    } catch (err) {
      if (w && !adopted) {
        try {
          await w.cleanup();
        } catch {
          // best effort — do not leave an orphan SDK wallet
        }
      }
      const message = describeSparkError(
        err,
        "Failed to create wallet",
        "Failed to create wallet: your device clock looks wrong. Check that the time and timezone are correct, then try again."
      );
      setError(message);
      throw new Error(message);
    }
  }, [adoptWallet, clearError, registerWallet, setError]);

  const restore = useCallback(
    async (phrase: string) => {
      clearError();
      if (metaRef.current) {
        setError(SPARK_ALREADY_LINKED_MESSAGE);
        throw new Error(SPARK_ALREADY_LINKED_MESSAGE);
      }
      let w: SparkWalletInstance | null = null;
      let adopted = false;
      try {
        const { wallet } = await SparkWallet.getOrCreateWallet({
          mnemonicOrSeed: phrase,
          accountNumber: SPARK_ACCOUNT_INDEX,
          options: SPARK_CONFIG,
          forceReinit: true,
        });
        w = wallet;
        await registerWallet(w);
        setMnemonic(phrase);
        adoptWallet(w);
        adopted = true;
      } catch (err) {
        if (w && !adopted) {
          try {
            await w.cleanup();
          } catch {
            // best effort — do not leave an orphan SDK wallet
          }
        }
        const message = describeSparkError(
          err,
          "Failed to restore wallet",
          "Failed to restore wallet: your device clock looks wrong. Check that the time and timezone are correct, then try again."
        );
        setError(message);
        throw new Error(message);
      }
    },
    [adoptWallet, clearError, registerWallet, setError]
  );

  const deriveSparkAddress = useCallback(async (phrase: string) => {
    const { wallet: w } = await SparkWallet.getOrCreateWallet({
      mnemonicOrSeed: phrase,
      accountNumber: SPARK_ACCOUNT_INDEX,
      options: SPARK_CONFIG,
      forceReinit: true,
    });
    try {
      return await w.getSparkAddress();
    } finally {
      await w.cleanup();
    }
  }, []);

  const unlock = useCallback(
    async (phrase: string) => {
      clearError();
      const currentMeta = metaRef.current;
      if (!currentMeta) throw new Error("No Spark wallet is registered");
      const expectedIdentity = currentMeta.identity_public_key;
      if (
        typeof expectedIdentity !== "string" ||
        !expectedIdentity.trim()
      ) {
        throw new Error("Spark wallet metadata is incomplete");
      }
      try {
        const { wallet: w } = await SparkWallet.getOrCreateWallet({
          mnemonicOrSeed: phrase,
          accountNumber: SPARK_ACCOUNT_INDEX,
          options: SPARK_CONFIG,
          forceReinit: true,
        });
        const identityPublicKey = await w.getIdentityPublicKey();
        if (
          identityPublicKey.toLowerCase() !== expectedIdentity.toLowerCase()
        ) {
          await w.cleanup();
          throw new Error("That recovery phrase doesn't match this wallet.");
        }
        setMnemonic(phrase);
        adoptWallet(w);
      } catch (err) {
        setError(
          describeSparkError(
            err,
            "Failed to unlock wallet",
            "Failed to unlock wallet: your device clock looks wrong. Check that the time and timezone are correct, then try again."
          )
        );
        throw err;
      }
    },
    [adoptWallet, clearError, setError]
  );

  const lock = useCallback(async () => {
    const binding = balanceBindingRef.current;
    if (binding) {
      binding.wallet.off(SparkWalletEvent.BalanceUpdate, binding.handler);
      balanceBindingRef.current = null;
    }
    const current = walletRef.current;
    if (current) {
      try {
        await current.cleanup();
      } catch {
        // best effort — the readonly path still serves the locked view
      }
    }
    walletRef.current = null;
    setWallet(null);
    setMnemonic(null);
    // Keep localStorage meta; only clear in-memory secrets.
    if (metaRef.current) {
      setStatus("locked");
      void refresh();
    } else {
      setStatus("not-created");
    }
  }, [refresh]);

  const setBackupVerified = useCallback(async (verified: boolean) => {
    const updated = updateSparkWallet({ backup_verified: verified });
    metaRef.current = updated;
    setMeta(updated);
  }, []);

  const setPrivacy = useCallback(
    async (enabled: boolean) => {
      const current = walletRef.current;
      if (current) {
        await current.setPrivacyEnabled(enabled);
      }
      const updated = updateSparkWallet({ privacy_enabled: enabled });
      metaRef.current = updated;
      setMeta(updated);
      void refresh();
    },
    [refresh]
  );

  const forget = useCallback(async () => {
    if (outgoingPollRef.current) {
      clearInterval(outgoingPollRef.current.timer);
      outgoingPollRef.current = null;
    }
    const binding = balanceBindingRef.current;
    if (binding) {
      binding.wallet.off(SparkWalletEvent.BalanceUpdate, binding.handler);
      balanceBindingRef.current = null;
    }
    const current = walletRef.current;
    if (current) {
      try {
        await current.cleanup();
      } catch {
        // proceed with metadata removal regardless
      }
    }
    clearSparkWallet();
    walletRef.current = null;
    readonlyRef.current = null;
    setWallet(null);
    setMnemonic(null);
    setMeta(null);
    setBalance(null);
    setTransactions(null);
    setStatus("not-created");
  }, []);

  const trackOutgoing = useCallback(
    (kind: "lightning" | "withdrawal", id: string) => {
      if (outgoingPollRef.current) {
        clearInterval(outgoingPollRef.current.timer);
      }
      const timer = setInterval(() => {
        const w = walletRef.current;
        if (!w) {
          clearInterval(timer);
          if (outgoingPollRef.current?.timer === timer) {
            outgoingPollRef.current = null;
          }
          return;
        }
        void (async () => {
          try {
            const result =
              kind === "lightning"
                ? await w.getLightningSendRequest(id)
                : await w.getCoopExitRequest(id);
            const status = (result as { status?: string } | null)?.status ?? "";
            const terminal =
              kind === "lightning"
                ? isLightningSendTerminal(status)
                : isCoopExitTerminal(status);
            if (terminal) {
              clearInterval(timer);
              if (outgoingPollRef.current?.timer === timer) {
                outgoingPollRef.current = null;
              }
            }
            void refresh();
          } catch {
            // transient network error — keep polling
          }
        })();
      }, 4000);
      outgoingPollRef.current = { id, timer };
    },
    [refresh]
  );

  useEffect(() => {
    try {
      const stored = loadSparkWallet();
      if (
        stored &&
        stored.identity_public_key?.trim() &&
        stored.spark_address?.trim()
      ) {
        metaRef.current = stored;
        setMeta(stored);
        buildReadonly();
        setStatus("locked");
        void refresh();
      } else {
        setStatus("not-created");
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to load Spark wallet");
      setStatus("not-created");
    }
  }, [buildReadonly, refresh, setError]);

  // Custodial force-logout must clear in-memory mnemonic/wallet without wiping
  // device meta — SparkProvider now stays mounted across auth transitions.
  useEffect(() => {
    const onForceLogout = () => {
      void lock();
    };
    window.addEventListener("force-logout", onForceLogout);
    return () => window.removeEventListener("force-logout", onForceLogout);
  }, [lock]);

  const value = useMemo<SparkContextValue>(
    () => ({
      available: true,
      status,
      meta,
      error,
      mnemonic,
      wallet,
      balance,
      transactions,
      refresh,
      createNew,
      restore,
      deriveSparkAddress,
      unlock,
      lock,
      setBackupVerified,
      setPrivacy,
      forget,
      clearError,
      trackOutgoing,
    }),
    [
      status,
      meta,
      error,
      mnemonic,
      wallet,
      balance,
      transactions,
      refresh,
      createNew,
      restore,
      deriveSparkAddress,
      unlock,
      lock,
      setBackupVerified,
      setPrivacy,
      forget,
      clearError,
      trackOutgoing,
    ]
  );

  return <SparkContext.Provider value={value}>{children}</SparkContext.Provider>;
};

export const useSpark = (): SparkContextValue => useContext(SparkContext);
