import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import {
  SparkProvider,
  useSpark,
  type SparkContextValue,
} from "@/app/components/spark/SparkProvider";
import { LanguageProvider } from "@/app/LanguageProvider";

const apiMocks = vi.hoisted(() => ({
  getSparkWallet: vi.fn(),
  registerSparkWallet: vi.fn(),
  setSparkBackupVerified: vi.fn(),
  setSparkPrivacy: vi.fn(),
  forgetSparkWallet: vi.fn(),
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

vi.mock("@/app/lib/api", () => ({
  getSparkWallet: apiMocks.getSparkWallet,
  registerSparkWallet: apiMocks.registerSparkWallet,
  setSparkBackupVerified: apiMocks.setSparkBackupVerified,
  setSparkPrivacy: apiMocks.setSparkPrivacy,
  forgetSparkWallet: apiMocks.forgetSparkWallet,
}));

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
  apiMocks.registerSparkWallet.mockImplementation((body: unknown) =>
    Promise.resolve(metaFixture({ ...(body as object) }))
  );
  apiMocks.setSparkBackupVerified.mockImplementation((v: boolean) =>
    Promise.resolve(metaFixture({ backup_verified: v }))
  );
  apiMocks.setSparkPrivacy.mockImplementation((v: boolean) =>
    Promise.resolve(metaFixture({ privacy_enabled: v }))
  );
  apiMocks.forgetSparkWallet.mockResolvedValue({});
});

afterEach(() => {
  ctx = undefined as unknown as SparkContextValue;
});

describe("SparkProvider lifecycle", () => {
  it("reports not-created when no wallet is registered", async () => {
    apiMocks.getSparkWallet.mockResolvedValue(null);
    renderProvider();
    await waitFor(() => expect(status()).toBe("not-created"));
    expect(balance()).toBe("null");
    expect(sdkMocks.createPublic).not.toHaveBeenCalled();
  });

  it("reports not-created for incomplete wallet meta (empty {} / missing identity)", async () => {
    apiMocks.getSparkWallet.mockResolvedValue({});
    renderProvider();
    await waitFor(() => expect(status()).toBe("not-created"));
    expect(balance()).toBe("null");
    expect(screen.getByTestId("meta").textContent).toBe("null");
    expect(sdkMocks.createPublic).not.toHaveBeenCalled();
  });

  it("locked + privacy off: balance served from the readonly client", async () => {
    const readonly = makeReadonly();
    sdkMocks.createPublic.mockReturnValue(readonly);
    apiMocks.getSparkWallet.mockResolvedValue(metaFixture());

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
    apiMocks.getSparkWallet.mockResolvedValue(
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
    apiMocks.getSparkWallet.mockResolvedValue(metaFixture());

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
    apiMocks.getSparkWallet.mockResolvedValue(metaFixture());

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
    apiMocks.getSparkWallet.mockResolvedValue(metaFixture());

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

  it("createNew returns the phrase and registers public metadata only", async () => {
    const wallet = makeWallet();
    sdkMocks.getOrCreateWallet.mockResolvedValue({
      wallet,
      mnemonic: PHRASE,
    });
    apiMocks.getSparkWallet.mockResolvedValue(null);

    renderProvider();
    await waitFor(() => expect(status()).toBe("not-created"));

    let phrase = "";
    await act(async () => {
      phrase = await ctx.createNew();
    });

    expect(phrase).toBe(PHRASE);
    expect(apiMocks.registerSparkWallet).toHaveBeenCalledWith({
      identity_public_key: IDENTITY,
      spark_address: SPARK_ADDRESS,
      network: "MAINNET",
      account_index: 1,
    });
    expect(status()).toBe("unlocked");
  });

  it("lock clears the mnemonic/wallet but the readonly view still serves", async () => {
    const readonly = makeReadonly();
    const wallet = makeWallet();
    sdkMocks.createPublic.mockReturnValue(readonly);
    sdkMocks.getOrCreateWallet.mockResolvedValue({ wallet, mnemonic: PHRASE });
    apiMocks.getSparkWallet.mockResolvedValue(metaFixture());

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

  it("setPrivacy on a locked wallet hides the balance once enabled", async () => {
    const readonly = makeReadonly();
    sdkMocks.createPublic.mockReturnValue(readonly);
    apiMocks.getSparkWallet.mockResolvedValue(metaFixture());

    renderProvider();
    await waitFor(() => expect(status()).toBe("locked"));
    expect(balance()).toBe("4321");

    await act(async () => {
      await ctx.setPrivacy(true);
    });
    expect(screen.getByTestId("privacy").textContent).toBe("true");
    expect(balance()).toBe("null");
    expect(apiMocks.setSparkPrivacy).toHaveBeenCalledWith(true);
  });

  it("forget removes metadata and returns to not-created", async () => {
    const readonly = makeReadonly();
    sdkMocks.createPublic.mockReturnValue(readonly);
    apiMocks.getSparkWallet.mockResolvedValue(metaFixture());

    renderProvider();
    await waitFor(() => expect(status()).toBe("locked"));

    await act(async () => {
      await ctx.forget();
    });

    expect(status()).toBe("not-created");
    expect(screen.getByTestId("meta").textContent).toBe("null");
    expect(apiMocks.forgetSparkWallet).toHaveBeenCalledTimes(1);
  });
});
