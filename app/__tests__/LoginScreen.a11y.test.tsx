import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoginScreen } from "@/app/components/auth/LoginScreen";
import { LanguageProvider } from "@/app/LanguageProvider";

vi.mock("@/app/components/auth/GoogleLogin", () => ({
  default: () => <div data-testid="google-login-stub" />,
}));

vi.mock("@/app/lib/api", () => ({
  apiCall: vi.fn(),
}));

function renderLogin() {
  return render(
    <LanguageProvider>
      <LoginScreen
        setToken={vi.fn()}
        setIsAuthenticated={vi.fn()}
        setShowRegister={vi.fn()}
        setShowForgotPassword={vi.fn()}
      />
    </LanguageProvider>
  );
}

describe("LoginScreen accessibility smoke", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders associated labels, autocomplete, and a static brand Zap", () => {
    renderLogin();

    const username = screen.getByLabelText("Username");
    const password = screen.getByLabelText("Password");

    expect(username).toHaveAttribute("autocomplete", "username");
    expect(password).toHaveAttribute("autocomplete", "current-password");
    expect(password).toHaveAttribute("type", "password");

    expect(screen.getByRole("heading", { name: "Aratiri" })).toBeInTheDocument();
    expect(screen.getByText("Bitcoin Lightning Wallet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Forgot Password?" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create new account" })
    ).toBeInTheDocument();

    // Auth Zap must not pulse
    const brand = document.querySelector(".text-accent");
    expect(brand).toBeTruthy();
    expect(brand?.className).not.toContain("animate-pulse");
  });
});
