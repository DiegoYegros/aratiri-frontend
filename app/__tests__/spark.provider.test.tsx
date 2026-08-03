import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import {
  SparkProvider,
  useSpark,
  type SparkContextValue,
} from "@/app/components/spark/SparkProvider";
import { LanguageProvider } from "@/app/LanguageProvider";
import { SPARK_WALLET_STORAGE_KEY } from "@/app/lib/spark/storage";

const storageMocks = vi.hoisted(() => ({
  loadSparkWallet: vi.fn(),
  saveSparkWallet: vi.fn(),
  updateSparkWallet: vi.fn(),
  clearSparkWallet: vi.fn(),
}));

const sdkMocks = vi.hoisted(() => ({
  createPublic: vi.fn(),
  getOrCreateWallet: vi.fn(),
  SparkWalletEvent: { BalanceUpdate: "balance-update" },
  WalletConfig: {
    MAINNET: { network: "MAINNET" },
    REGTEST: { network: "REGTEST" },
  },
}));

vi.mock("@/app/lib/spark/storage", async () => {
  const actual = await vi.importActual<typeof import("@/app/lib/spark/storage")>(
    "@/app/lib/spark/storage"
  );
  return {
    ...actual,
    loadSparkWallet: storageMocks.loadSparkWallet,
    saveSparkWallet: storageMocks.saveSparkWallet,
    updateSparkWallet: storageMocks.updateSparkWallet,
    clearSparkWallet: storageMocks.clearSparkWallet,
  };
});

vi.mock("@buildonspark/spark-sdk", () => ({
  SparkReadonlyClient: { createPublic: sdkMocks.createPublic },
  SparkWallet: { getOrCreateWallet: sdkMocks.getOrCreateWallet },
  SparkWalletEvent: sdkMocks.SparkWalletEvent,
  WalletConfig: sdkMocks.WalletConfig,
}));

const IDENTITY = "a".repeat(64);
const SPARK_ADDRESS = "spark1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";
const PHRASE =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

const metaFixture = (overrides: Record<string, unknown> = {}) => ({
  spark_address: SPARK_ADDRESS,
  identity_public_key: IDENTITY,
  network: "MAINNET",
  account_index: 1,
  backup_verified: true,
  privacy_enabled: false,
  ...overrides,
});

const makeWallet = (overrides: Record<string, unknown> = {}) => ({
  getSparkAddress: vi.fn().mockResolvedValue(SPARK_ADDRESS),
  getIdentityPublicKey: vi.fn().mockResolvedValue(IDENTITY),
  getCachedBalance: vi
    .fn()
    .mockResolvedValue({
      satsBalance: { available: "1234", owned: "1234", incoming: "0" },
    }),
  getTransfers: vi.fn().mockResolvedValue({ transfers: [] }),
  on: vi.fn(),
  off: vi.fn(),
  cleanup: vi.fn().mockResolvedValue(undefined),
  setPrivacyEnabled: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const makeReadonly = (overrides: Record<string, unknown> = {}) => ({
  getAvailableBalance: vi.fn().mockResolvedValue(4321),
  getTransfers: vi.fn().mockResolvedValue({ transfers: [] }),
  ...overrides,
});

let ctx: SparkContextValue;

const Probe = () => {
  ctx = useSpark();
  return (
    <div>
      <span data-testid="status">{ctx.status}</span>
      <span data-testid="balance">
        {ctx.balance ? ctx.balance.available : "null"}
      </span>
      <span data-testid="error">{ctx.error ?? ""}</span>
      <span data-testid="wallet">{ctx.wallet ? "yes" : "no"}</span>
      <span data-testid="meta">
        {ctx.meta ? ctx.meta.spark_address : "null"}
      </span>
      <span data-testid="privacy">
        {ctx.meta ? String(ctx.meta.privacy_enabled) : "null"}
      </span>
    </div>
  );
};

const renderProvider = () =>
  render(
    <LanguageProvider>
      <SparkProvider>
        <Probe />
      </SparkProvider>
    </LanguageProvider>
  );

const status = () => screen.getByTestId("status").textContent;
const balance = () => screen.getByTestId("balance").textContent;
const errorText = () => screen.getByTestId("error").textContent;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.removeItem(SPARK_WALLET_STORAGE_KEY);
  storageMocks.saveSparkWallet.mockImplementation((body: unknown) => {
    const meta = metaFixture({ ...(body as object) });
    return meta;
  });
  storageMocks.updateSparkWallet.mockImplementation((patch: unknown) =>
    metaFixture({ ...(patch as object) })
  );
  storageMocks.clearSparkWallet.mockImplementation(() => {});
});

afterEach(() => {
  ctx = undefined as unknown as SparkContextValue;
});

describe("SparkProvider lifecycle", () => {
  it("reports not-created when no wallet is registered", async () => {
    storageMocks.loadSparkWallet.mockReturnValue(null);
    renderProvider();
    await waitFor(() => expect(status()).toBe("not-created"));
    expect(balance()).toBe("null");
    expect(sdkMocks.createPublic).not.toHaveBeenCalled();
  });

  it("reports not-created for incomplete wallet meta (empty {} / missing identity)", async () => {
    storageMocks.loadSparkWallet.mockReturnValue({});
    renderProvider();
    await waitFor(() => expect(status()).toBe("not-created"));
    expect(balance()).toBe("null");
    expect(screen.getByTestId("meta").textContent).toBe("null");
    expect(sdkMocks.createPublic).not.toHaveBeenCalled();
  });

  it("locked + privacy off: balance served from the readonly client", async () => {
    const readonly = makeReadonly();
    sdkMocks.createPublic.mockReturnValue(readonly);
    storageMocks.loadSparkWallet.mockReturnValue(metaFixture());

    renderProvider();
    await waitFor(() => expect(status()).toBe("locked"));
    expect(balance()).toBe("4321");
    expect(sdkMocks.createPublic).toHaveBeenCalledWith(
      sdkMocks.WalletConfig.MAINNET
    );
    expect(readonly.getAvailableBalance).toHaveBeenCalledWith(SPARK_ADDRESS);
  });

  it("locked + privacy on: balance stays hidden, never a false zero", async () => {
    const readonly = makeReadonly();
    sdkMocks.createPublic.mockReturnValue(readonly);
    storageMocks.loadSparkWallet.mockReturnValue(
      metaFixture({ privacy_enabled: true })
    );

    renderProvider();
    await waitFor(() => expect(status()).toBe("locked"));
    expect(screen.getByTestId("privacy").textContent).toBe("true");
    expect(balance()).toBe("null");
    expect(readonly.getAvailableBalance).not.toHaveBeenCalled();
  });

  it("unlock adopts the live wallet and refreshes from it", async () => {
    const readonly = makeReadonly();
    const wallet = makeWallet();
    sdkMocks.createPublic.mockReturnValue(readonly);
    sdkMocks.getOrCreateWallet.mockResolvedValue({ wallet, mnemonic: PHRASE });
    storageMocks.loadSparkWallet.mockReturnValue(metaFixture());

    renderProvider();
    await waitFor(() => expect(status()).toBe("locked"));

    await act(async () => {
      await ctx.unlock(PHRASE);
    });

    expect(status()).toBe("unlocked");
    expect(screen.getByTestId("wallet").textContent).toBe("yes");
    expect(wallet.getCachedBalance).toHaveBeenCalled();
    expect(sdkMocks.getOrCreateWallet).toHaveBeenCalledWith(
      expect.objectContaining({
        mnemonicOrSeed: PHRASE,
        accountNumber: 1,
        forceReinit: true,
      })
    );
  });

  it("unlock rejects a phrase whose identity does not match", async () => {
    const wallet = makeWallet({
      getIdentityPublicKey: vi.fn().mockResolvedValue("b".repeat(64)),
      cleanup: vi.fn().mockResolvedValue(undefined),
    });
    sdkMocks.getOrCreateWallet.mockResolvedValue({ wallet, mnemonic: PHRASE });
    storageMocks.loadSparkWallet.mockReturnValue(metaFixture());

    renderProvider();
    await waitFor(() => expect(status()).toBe("locked"));

    let unlockErr: unknown;
    await act(async () => {
      try {
        await ctx.unlock(PHRASE);
      } catch (e) {
        unlockErr = e;
      }
    });
    expect(unlockErr).toBeInstanceOf(Error);
    expect((unlockErr as Error).message).toMatch(/doesn't match/);
    expect(status()).toBe("locked");
    expect(wallet.cleanup).toHaveBeenCalled();
  });

  it("surfaces the device-clock hint when the SDK hard-fails", async () => {
    sdkMocks.getOrCreateWallet.mockRejectedValue(
      new Error("invalid expiry_time: device clock skew")
    );
    storageMocks.loadSparkWallet.mockReturnValue(metaFixture());

    renderProvider();
    await waitFor(() => expect(status()).toBe("locked"));

    await act(async () => {
      try {
        await ctx.unlock(PHRASE);
      } catch {
        // expected — the SDK hard-fails on a skewed clock
      }
    });
    await waitFor(() => expect(errorText()).toMatch(/clock looks wrong/));
  });

  it("createNew returns the phrase and saves public metadata only", async () => {
    const wallet = makeWallet();
    sdkMocks.getOrCreateWallet.mockResolvedValue({
      wallet,
      mnemonic: PHRASE,
    });
    storageMocks.loadSparkWallet.mockReturnValue(null);

    renderProvider();
    await waitFor(() => expect(status()).toBe("not-created"));

    let phrase = "";
    await act(async () => {
      phrase = await ctx.createNew();
    });

    expect(phrase).toBe(PHRASE);
    expect(storageMocks.saveSparkWallet).toHaveBeenCalledWith({
      identity_public_key: IDENTITY,
      spark_address: SPARK_ADDRESS,
      network: "MAINNET",
      account_index: 1,
      backup_verified: false,
      privacy_enabled: false,
    });
    expect(status()).toBe("unlocked");
  });

  it("restore rejects when a wallet is already linked", async () => {
    storageMocks.loadSparkWallet.mockReturnValue(metaFixture());
    sdkMocks.createPublic.mockReturnValue(makeReadonly());

    renderProvider();
    await waitFor(() => expect(status()).toBe("locked"));

    let restoreErr: unknown;
    await act(async () => {
      try {
        await ctx.restore(PHRASE);
      } catch (e) {
        restoreErr = e;
      }
    });

    expect(restoreErr).toBeInstanceOf(Error);
    expect((restoreErr as Error).message).toMatch(/already set up on this device/);
    expect(sdkMocks.getOrCreateWallet).not.toHaveBeenCalled();
    expect(storageMocks.saveSparkWallet).not.toHaveBeenCalled();
  });

  it("createNew rejects when a wallet is already linked", async () => {
    storageMocks.loadSparkWallet.mockReturnValue(metaFixture());
    sdkMocks.createPublic.mockReturnValue(makeReadonly());

    renderProvider();
    await waitFor(() => expect(status()).toBe("locked"));

    let createErr: unknown;
    await act(async () => {
      try {
        await ctx.createNew();
      } catch (e) {
        createErr = e;
      }
    });

    expect(createErr).toBeInstanceOf(Error);
    expect((createErr as Error).message).toMatch(/already set up on this device/);
    expect(sdkMocks.getOrCreateWallet).not.toHaveBeenCalled();
  });

  it("createNew cleans up the SDK wallet when local save fails", async () => {
    const wallet = makeWallet();
    sdkMocks.getOrCreateWallet.mockResolvedValue({
      wallet,
      mnemonic: PHRASE,
    });
    storageMocks.loadSparkWallet.mockReturnValue(null);
    storageMocks.saveSparkWallet.mockImplementation(() => {
      throw new Error("Identity already registered");
    });

    renderProvider();
    await waitFor(() => expect(status()).toBe("not-created"));

    let createErr: unknown;
    await act(async () => {
      try {
        await ctx.createNew();
      } catch (e) {
        createErr = e;
      }
    });

    expect(createErr).toBeInstanceOf(Error);
    expect((createErr as Error).message).toMatch(/already linked|already set up/);
    expect(wallet.cleanup).toHaveBeenCalled();
    expect(status()).toBe("not-created");
    expect(screen.getByTestId("wallet").textContent).toBe("no");
  });

  it("restore cleans up the SDK wallet when local save fails", async () => {
    const wallet = makeWallet();
    sdkMocks.getOrCreateWallet.mockResolvedValue({
      wallet,
      mnemonic: PHRASE,
    });
    storageMocks.loadSparkWallet.mockReturnValue(null);
    storageMocks.saveSparkWallet.mockImplementation(() => {
      throw new Error("spark identity taken");
    });

    renderProvider();
    await waitFor(() => expect(status()).toBe("not-created"));

    let restoreErr: unknown;
    await act(async () => {
      try {
        await ctx.restore(PHRASE);
      } catch (e) {
        restoreErr = e;
      }
    });

    expect(restoreErr).toBeInstanceOf(Error);
    expect((restoreErr as Error).message).toMatch(/on this device/);
    expect(wallet.cleanup).toHaveBeenCalled();
    expect(status()).toBe("not-created");
    expect(screen.getByTestId("wallet").textContent).toBe("no");
  });

  it("lock clears the mnemonic/wallet but the readonly view still serves", async () => {
    const readonly = makeReadonly();
    const wallet = makeWallet();
    sdkMocks.createPublic.mockReturnValue(readonly);
    sdkMocks.getOrCreateWallet.mockResolvedValue({ wallet, mnemonic: PHRASE });
    storageMocks.loadSparkWallet.mockReturnValue(metaFixture());

    renderProvider();
    await waitFor(() => expect(status()).toBe("locked"));

    await act(async () => {
      await ctx.unlock(PHRASE);
    });
    expect(status()).toBe("unlocked");

    await act(async () => {
      await ctx.lock();
    });
    expect(status()).toBe("locked");
    expect(screen.getByTestId("wallet").textContent).toBe("no");
    expect(wallet.cleanup).toHaveBeenCalled();
    expect(readonly.getAvailableBalance).toHaveBeenCalledWith(SPARK_ADDRESS);
  });

  it("force-logout locks an unlocked wallet without clearing device meta", async () => {
    const wallet = makeWallet();
    sdkMocks.getOrCreateWallet.mockResolvedValue({ wallet, mnemonic: PHRASE });
    storageMocks.loadSparkWallet.mockReturnValue(metaFixture());

    renderProvider();
    await waitFor(() => expect(status()).toBe("locked"));
    await act(async () => {
      await ctx.unlock(PHRASE);
    });
    expect(status()).toBe("unlocked");

    await act(async () => {
      window.dispatchEvent(new Event("force-logout"));
    });

    await waitFor(() => expect(status()).toBe("locked"));
    expect(screen.getByTestId("wallet").textContent).toBe("no");
    expect(wallet.cleanup).toHaveBeenCalled();
    expect(storageMocks.clearSparkWallet).not.toHaveBeenCalled();
  });

  it("setPrivacy on a locked wallet hides the balance once enabled", async () => {
    const readonly = makeReadonly();
    sdkMocks.createPublic.mockReturnValue(readonly);
    storageMocks.loadSparkWallet.mockReturnValue(metaFixture());
    storageMocks.updateSparkWallet.mockReturnValue(
      metaFixture({ privacy_enabled: true })
    );

    renderProvider();
    await waitFor(() => expect(status()).toBe("locked"));
    expect(balance()).toBe("4321");

    await act(async () => {
      await ctx.setPrivacy(true);
    });
    expect(screen.getByTestId("privacy").textContent).toBe("true");
    expect(balance()).toBe("null");
    expect(storageMocks.updateSparkWallet).toHaveBeenCalledWith({
      privacy_enabled: true,
    });
  });

  it("forget removes metadata and returns to not-created", async () => {
    const readonly = makeReadonly();
    sdkMocks.createPublic.mockReturnValue(readonly);
    storageMocks.loadSparkWallet.mockReturnValue(metaFixture());

    renderProvider();
    await waitFor(() => expect(status()).toBe("locked"));

    await act(async () => {
      await ctx.forget();
    });

    expect(status()).toBe("not-created");
    expect(screen.getByTestId("meta").textContent).toBe("null");
    expect(storageMocks.clearSparkWallet).toHaveBeenCalledTimes(1);
  });
});
