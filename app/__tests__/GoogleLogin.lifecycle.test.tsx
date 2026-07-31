import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginScreen } from "@/app/components/auth/LoginScreen";
import { LanguageProvider } from "@/app/LanguageProvider";

vi.mock("@/app/lib/api", () => ({
  apiCall: vi.fn(),
}));

describe("GoogleLogin GSI lifecycle", () => {
  const initialize = vi.fn();
  const renderButton = vi.fn((container: HTMLElement) => {
    const btn = document.createElement("div");
    btn.setAttribute("data-testid", "gsi-button");
    container.appendChild(btn);
  });

  beforeEach(() => {
    localStorage.clear();
    initialize.mockClear();
    renderButton.mockClear();

    (window as unknown as { google: unknown }).google = {
      accounts: {
        id: {
          initialize,
          renderButton,
        },
      },
    };

    const appendChild = document.body.appendChild.bind(document.body);
    vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
      const result = appendChild(node as Node);
      if (node instanceof HTMLScriptElement) {
        queueMicrotask(() => {
          node.onload?.(new Event("load"));
        });
      }
      return result;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as unknown as { google?: unknown }).google;
  });

  it("does not re-initialize or stack GSI buttons when login inputs churn", async () => {
    const user = userEvent.setup();

    render(
      <LanguageProvider>
        <LoginScreen
          setToken={vi.fn()}
          setIsAuthenticated={vi.fn()}
          setShowRegister={vi.fn()}
          setShowForgotPassword={vi.fn()}
        />
      </LanguageProvider>
    );

    await waitFor(() => expect(initialize).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(renderButton).toHaveBeenCalledTimes(1));

    const username = screen.getByLabelText("Username");
    const password = screen.getByLabelText("Password");

    await user.type(username, "alice");
    await user.type(password, "secret");

    expect(initialize).toHaveBeenCalledTimes(1);
    expect(renderButton).toHaveBeenCalledTimes(1);
    expect(screen.getAllByTestId("gsi-button")).toHaveLength(1);
  });
});
