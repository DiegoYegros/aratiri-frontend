import { describe, expect, it } from "vitest";
import {
  AUTH_EMAIL_UNAVAILABLE_MESSAGE,
  describeAuthEmailError,
} from "@/app/lib/authErrors";

describe("describeAuthEmailError", () => {
  it("maps HTTP 503 to the stable email-unavailable copy", () => {
    const err = Object.assign(new Error("Service unavailable"), {
      status: 503,
    });
    expect(describeAuthEmailError(err)).toBe(AUTH_EMAIL_UNAVAILABLE_MESSAGE);
  });

  it("maps the fail-closed Email delivery message without requiring status", () => {
    expect(
      describeAuthEmailError(new Error("Email delivery is not configured"))
    ).toBe(AUTH_EMAIL_UNAVAILABLE_MESSAGE);
  });

  it("maps 503 plus Email delivery message", () => {
    const err = Object.assign(
      new Error("Email delivery is not configured"),
      { status: 503 }
    );
    expect(describeAuthEmailError(err)).toBe(AUTH_EMAIL_UNAVAILABLE_MESSAGE);
  });

  it("uses a custom friendly message when provided", () => {
    const err = Object.assign(new Error("Email delivery is not configured"), {
      status: 503,
    });
    expect(describeAuthEmailError(err, "Use Google instead")).toBe(
      "Use Google instead"
    );
  });

  it("passes through unrelated errors", () => {
    expect(describeAuthEmailError(new Error("Alias already taken"))).toBe(
      "Alias already taken"
    );
    const err = Object.assign(new Error("Too many requests"), { status: 429 });
    expect(describeAuthEmailError(err)).toBe("Too many requests");
  });
});
