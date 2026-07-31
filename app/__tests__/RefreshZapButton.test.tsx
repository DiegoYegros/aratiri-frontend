import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RefreshZapButton } from "@/app/components/dashboard/RefreshZapButton";

describe("RefreshZapButton", () => {
  it("is the only control that invokes refresh and exposes busy semantics", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();

    const { rerender } = render(
      <div>
        <RefreshZapButton
          isRefreshing={false}
          onRefresh={onRefresh}
          label="Refresh wallet data"
          busyLabel="Refreshing wallet data"
        />
        <span data-testid="brand-wordmark">Aratiri</span>
      </div>
    );

    const zap = screen.getByRole("button", { name: "Refresh wallet data" });
    expect(zap).toHaveAttribute("data-testid", "refresh-zap");
    expect(zap).not.toBeDisabled();
    expect(zap).toHaveAttribute("aria-busy", "false");
    expect(zap.textContent).not.toMatch(/refresh/i);
    expect(screen.queryByText(/refresh/i)).not.toBeInTheDocument();

    await user.click(zap);
    expect(onRefresh).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTestId("brand-wordmark"));
    expect(onRefresh).toHaveBeenCalledTimes(1);

    rerender(
      <div>
        <RefreshZapButton
          isRefreshing={true}
          onRefresh={onRefresh}
          label="Refresh wallet data"
          busyLabel="Refreshing wallet data"
        />
        <span data-testid="brand-wordmark">Aratiri</span>
      </div>
    );

    const busyZap = screen.getByRole("button", {
      name: "Refreshing wallet data",
    });
    expect(busyZap).toBeDisabled();
    expect(busyZap).toHaveAttribute("aria-busy", "true");
    expect(busyZap.querySelector(".animate-spin-smooth")).toBeTruthy();
    expect(busyZap.querySelector(".is-busy")).toBeTruthy();

    await user.click(busyZap);
    expect(onRefresh).toHaveBeenCalledTimes(1);

    await user.keyboard("{Enter}");
    // Disabled buttons do not fire; reentry rejected
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("supports keyboard activation when idle", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();

    render(
      <RefreshZapButton
        isRefreshing={false}
        onRefresh={onRefresh}
        label="Refresh wallet data"
        busyLabel="Refreshing wallet data"
      />
    );

    const zap = screen.getByRole("button", { name: "Refresh wallet data" });
    zap.focus();
    await user.keyboard("{Enter}");
    expect(onRefresh).toHaveBeenCalledTimes(1);

    zap.focus();
    await user.keyboard(" ");
    expect(onRefresh).toHaveBeenCalledTimes(2);
  });
});

describe("reduced-motion CSS contract", () => {
  it("disables spin and keeps a calm busy animation under prefers-reduced-motion", () => {
    const css = readFileSync(
      resolve(__dirname, "../globals.css"),
      "utf8"
    );

    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toMatch(
      /prefers-reduced-motion:\s*reduce[\s\S]*\.animate-spin-smooth\s*\{\s*animation:\s*none;/
    );
    expect(css).toMatch(
      /prefers-reduced-motion:\s*reduce[\s\S]*button\[aria-busy="true"\]\s*\.refresh-zap-icon[\s\S]*calm-busy/
    );
    expect(css).toContain("@keyframes calm-busy");
    expect(css).toContain("animation: spin 1.5s");
  });
});
