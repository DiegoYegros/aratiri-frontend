import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { LocalQrCode } from "@/app/components/ui/LocalQrCode";

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn(
      async (value: string): Promise<string> =>
        `data:image/png;base64,${value}`
    ),
  },
}));

describe("LocalQrCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a local data URL QR without third-party services", async () => {
    render(<LocalQrCode value="lnbc1test" alt="Invoice QR Code" size={128} />);

    const img = await screen.findByRole("img", { name: "Invoice QR Code" });
    expect(img).toHaveAttribute("src", "data:image/png;base64,lnbc1test");
    expect(img.getAttribute("src")).not.toContain("http");
  });

  it("shows a loading placeholder before the QR resolves", async () => {
    const QRCode = await import("qrcode");
    let resolve!: (value: string) => void;
    vi.mocked(QRCode.default.toDataURL).mockImplementationOnce(
      () =>
        new Promise<string>((r) => {
          resolve = r;
        })
    );

    render(<LocalQrCode value="pending" alt="Invoice QR Code" />);
    expect(
      screen.getByRole("status", { name: "Invoice QR Code" })
    ).toBeInTheDocument();

    resolve("data:image/png;base64,done");
    await waitFor(() =>
      expect(
        screen.getByRole("img", { name: "Invoice QR Code" })
      ).toHaveAttribute("src", "data:image/png;base64,done")
    );
  });
});
