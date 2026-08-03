import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/app/LanguageProvider";
import { MnemonicVerify } from "@/app/components/spark/MnemonicVerify";
import { SparkSpeedChooser } from "@/app/components/spark/SparkSpeedChooser";
import { SparkFeeLine } from "@/app/components/spark/SparkFeeLine";
import { SparkHiddenState } from "@/app/components/spark/SparkHiddenState";
import { WalletSwitcher } from "@/app/components/spark/WalletSwitcher";
import { SparkDeposit } from "@/app/components/spark/SparkDeposit";
import { SparkSecurityPanel } from "@/app/components/spark/SparkSecurityPanel";

const mocks = vi.hoisted(() => ({ useSpark: vi.fn() }));

vi.mock("@/app/components/spark/SparkProvider", () => ({
  useSpark: mocks.useSpark,
}));

const renderWithLang = (node: React.ReactNode) =>
  render(<LanguageProvider>{node}</LanguageProvider>);

const PHRASE =
  "abandon ability able about above absent absorb abstract absurd abuse access accident";

describe("MnemonicVerify", () => {
  it("challenges positions 4, 7, 10 and advances on correct answers", async () => {
    const user = userEvent.setup();
    const onVerified = vi.fn();
    const words = PHRASE.split(" ");
    renderWithLang(
      <MnemonicVerify mnemonic={PHRASE} onVerified={onVerified} />
    );

    // Position 4
    expect(
      screen.getByText(/Pick the word at position 4/)
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: words[3] }));

    // Position 7
    expect(
      screen.getByText(/Pick the word at position 7/)
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: words[6] }));

    // Position 10
    expect(
      screen.getByText(/Pick the word at position 10/)
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: words[9] }));

    expect(onVerified).toHaveBeenCalledTimes(1);
  });

  it("shows an error for a wrong answer and recovers on the next try", async () => {
    const user = userEvent.setup();
    const onVerified = vi.fn();
    const words = PHRASE.split(" ");
    renderWithLang(
      <MnemonicVerify mnemonic={PHRASE} onVerified={onVerified} />
    );

    const options = screen
      .getAllByRole("button")
      .map((b) => b.textContent) as string[];
    const wrong = options.find((w) => w !== words[3]) as string;

    await user.click(screen.getByRole("button", { name: wrong }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(onVerified).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: words[3] }));
    expect(
      screen.getByText(/Pick the word at position 7/)
    ).toBeInTheDocument();
  });
});

const QUOTE = {
  userFeeFast: { originalValue: 250 },
  userFeeMedium: { originalValue: 120 },
  userFeeSlow: { originalValue: 10 },
  l1BroadcastFeeFast: { originalValue: 300 },
  l1BroadcastFeeMedium: { originalValue: 280 },
  l1BroadcastFeeSlow: { originalValue: 250 },
};

describe("SparkSpeedChooser", () => {
  it("renders all three speeds with summed fee totals", () => {
    renderWithLang(
      <SparkSpeedChooser quote={QUOTE} speed="FAST" onChange={vi.fn()} />
    );
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /550 sats/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /400 sats/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /260 sats/ })).toBeInTheDocument();
  });

  it("marks the active speed checked and fires onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithLang(
      <SparkSpeedChooser quote={QUOTE} speed="FAST" onChange={onChange} />
    );
    const fast = screen.getByRole("radio", { name: /550 sats/ });
    expect(fast).toHaveAttribute("aria-checked", "true");

    const slow = screen.getByRole("radio", { name: /260 sats/ });
    expect(slow).toHaveAttribute("aria-checked", "false");
    await user.click(slow);
    expect(onChange).toHaveBeenCalledWith("SLOW");
  });
});

describe("SparkFeeLine", () => {
  it("shows busy while estimating", () => {
    renderWithLang(
      <SparkFeeLine estimateSats={null} maxFeeSats={10} onMaxFeeChange={vi.fn()} busy />
    );
    expect(screen.getByText("Estimating...")).toBeInTheDocument();
  });

  it("shows the estimate and warns when it exceeds the cap", () => {
    renderWithLang(
      <SparkFeeLine estimateSats={1500} maxFeeSats={1000} onMaxFeeChange={vi.fn()} />
    );
    expect(screen.getByText("≈ 1,500 sats")).toBeInTheDocument();
    expect(
      screen.getByText(/The estimated fee exceeds your cap/)
    ).toBeInTheDocument();
  });

  it("does not warn when within cap and emits changes", async () => {
    const onChange = vi.fn();
    renderWithLang(
      <SparkFeeLine estimateSats={500} maxFeeSats={1000} onMaxFeeChange={onChange} />
    );
    expect(
      screen.queryByText(/The estimated fee exceeds your cap/)
    ).not.toBeInTheDocument();
    const input = screen.getByLabelText("Maximum fee cap");
    fireEvent.change(input, { target: { value: "750" } });
    expect(onChange).toHaveBeenCalledWith(750);
  });
});

describe("SparkHiddenState", () => {
  it("renders the locked privacy copy and unlocks on click", async () => {
    const user = userEvent.setup();
    const onUnlock = vi.fn();
    renderWithLang(<SparkHiddenState onUnlock={onUnlock} />);
    expect(
      screen.getByText("Balance hidden while locked — unlock to view.")
    ).toBeInTheDocument();
    expect(screen.getByText("Privacy on")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Unlock wallet" }));
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });
});

describe("WalletSwitcher", () => {
  it("shows the get-started card only when no wallet exists", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    const onRestore = vi.fn();
    const onChange = vi.fn();

    renderWithLang(
      <WalletSwitcher
        active="spark"
        onChange={onChange}
        sparkStatus="not-created"
        onCreate={onCreate}
        onRestore={onRestore}
      />
    );

    expect(screen.getByText("Keep your keys with Spark")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Create a Spark wallet" })
    );
    await user.click(screen.getByRole("button", { name: "Restore a wallet" }));
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it("hides the get-started card once a wallet exists", () => {
    renderWithLang(
      <WalletSwitcher
        active="spark"
        onChange={vi.fn()}
        sparkStatus="locked"
        onCreate={vi.fn()}
        onRestore={vi.fn()}
      />
    );
    expect(
      screen.queryByText("Keep your keys with Spark")
    ).not.toBeInTheDocument();
  });

  it("switches wallet kinds via the segmented control", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithLang(
      <WalletSwitcher
        active="spark"
        onChange={onChange}
        sparkStatus="locked"
        onCreate={vi.fn()}
        onRestore={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: "Custodial" }));
    expect(onChange).toHaveBeenCalledWith("custodial");
  });
});

describe("SparkDeposit", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  it("warns when the wallet is locked", () => {
    mocks.useSpark.mockReturnValue({ wallet: null });
    renderWithLang(<SparkDeposit />);
    expect(
      screen.getByText("Unlock your wallet to generate a deposit address.")
    ).toBeInTheDocument();
  });

  it("defaults to single-use and can switch to a reusable address", async () => {
    const user = userEvent.setup();
    const getSingleUse = vi.fn().mockResolvedValue("bc1qsingle");
    const getStatic = vi.fn().mockResolvedValue("bc1qstatic");
    mocks.useSpark.mockReturnValue({ wallet: { getSingleUseDepositAddress: getSingleUse, getStaticDepositAddress: getStatic } });
    renderWithLang(<SparkDeposit />);

    await waitFor(() =>
      expect(screen.getByText("bc1qsingle")).toBeInTheDocument()
    );
    expect(getSingleUse).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(/A fresh address for each deposit/)
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reusable" }));
    await waitFor(() =>
      expect(screen.getByText("bc1qstatic")).toBeInTheDocument()
    );
    expect(getStatic).toHaveBeenCalledTimes(1);
    // Honest copy: the static key is shared with the payment operator.
    expect(
      screen.getByText(/Its key is shared with the payment operator/)
    ).toBeInTheDocument();
  });
});

describe("SparkSecurityPanel", () => {
  const baseMeta = {
    spark_address: "spark1qabcdef1234wxyz",
    identity_public_key: "0".repeat(64),
    network: "MAINNET",
    account_index: 1,
    backup_verified: false,
    privacy_enabled: false,
  };

  beforeEach(() => {
    mocks.useSpark.mockReturnValue({
      meta: baseMeta,
      mnemonic: null,
      lock: vi.fn().mockResolvedValue(undefined),
      setBackupVerified: vi.fn().mockResolvedValue(undefined),
      setPrivacy: vi.fn().mockResolvedValue(undefined),
      forget: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("marks backup as verified and shows the network line", async () => {
    const user = userEvent.setup();
    const setBackupVerified = vi.fn().mockResolvedValue(undefined);
    mocks.useSpark.mockReturnValue({
      meta: baseMeta,
      mnemonic: null,
      lock: vi.fn(),
      setBackupVerified,
      setPrivacy: vi.fn(),
      forget: vi.fn(),
    });
    renderWithLang(<SparkSecurityPanel />);
    expect(screen.getByText(/Not backed up yet/)).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /I've written it down/ })
    );
    expect(setBackupVerified).toHaveBeenCalledWith(true);
    expect(screen.getByText(/MAINNET · account 1/)).toBeInTheDocument();
  });

  it("requires matching short address before forgetting", async () => {
    const user = userEvent.setup();
    const forget = vi.fn().mockResolvedValue(undefined);
    mocks.useSpark.mockReturnValue({
      meta: baseMeta,
      mnemonic: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
      lock: vi.fn(),
      setBackupVerified: vi.fn(),
      setPrivacy: vi.fn(),
      forget,
    });
    renderWithLang(<SparkSecurityPanel />);

    const shortAddress = `${baseMeta.spark_address.slice(0, 6)}…${baseMeta.spark_address.slice(-4)}`;

    await user.click(screen.getByRole("button", { name: "Forget this wallet" }));
    const confirm = screen.getByRole("button", { name: "Confirm forget" });
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText("Confirm address"), "spark1q");
    expect(confirm).toBeDisabled();
    await user.clear(screen.getByLabelText("Confirm address"));
    await user.type(screen.getByLabelText("Confirm address"), shortAddress);
    await waitFor(() => expect(confirm).toBeEnabled());
    await user.click(confirm);
    expect(forget).toHaveBeenCalledTimes(1);
  });
});
