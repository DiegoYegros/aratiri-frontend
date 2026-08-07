import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("apiCall public-auth 401", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  async function loadApiCall() {
    const mod = await import("@/app/lib/api");
    return mod.apiCall;
  }

  it("login 401 with tokens present does not force-logout and rejects with status 401", async () => {
    localStorage.setItem("aratiri_accessToken", "access-token");
    localStorage.setItem("aratiri_refreshToken", "refresh-token");

    const onForceLogout = vi.fn();
    window.addEventListener("force-logout", onForceLogout);

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: "Invalid credentials" }),
    } as Response);

    const apiCall = await loadApiCall();

    await expect(
      apiCall("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: "alice", password: "bad" }),
      })
    ).rejects.toMatchObject({
      message: "Invalid credentials",
      status: 401,
    });

    expect(onForceLogout).not.toHaveBeenCalled();
    expect(localStorage.getItem("aratiri_accessToken")).toBe("access-token");
    expect(localStorage.getItem("aratiri_refreshToken")).toBe("refresh-token");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0][0]).toEqual(
      expect.stringMatching(/\/auth\/login$/)
    );

    window.removeEventListener("force-logout", onForceLogout);
  });

  it("forgot-password 401 does not enter refresh or force-logout", async () => {
    localStorage.setItem("aratiri_accessToken", "access-token");
    localStorage.setItem("aratiri_refreshToken", "refresh-token");

    const onForceLogout = vi.fn();
    window.addEventListener("force-logout", onForceLogout);

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: "Unauthorized" }),
    } as Response);

    const apiCall = await loadApiCall();

    await expect(
      apiCall("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: "alice@example.com" }),
      })
    ).rejects.toMatchObject({ status: 401 });

    expect(onForceLogout).not.toHaveBeenCalled();
    expect(localStorage.getItem("aratiri_accessToken")).toBe("access-token");
    expect(localStorage.getItem("aratiri_refreshToken")).toBe("refresh-token");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0][0]).toEqual(
      expect.stringMatching(/\/auth\/forgot-password$/)
    );

    window.removeEventListener("force-logout", onForceLogout);
  });

  it("protected route 401 without refresh token still force-logouts", async () => {
    localStorage.setItem("aratiri_accessToken", "access-token");

    const onForceLogout = vi.fn();
    window.addEventListener("force-logout", onForceLogout);

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: "Unauthorized" }),
    } as Response);

    const apiCall = await loadApiCall();

    await expect(apiCall("/accounts/account")).rejects.toThrow(
      "Session expired."
    );

    expect(onForceLogout).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("aratiri_accessToken")).toBeNull();
    expect(localStorage.getItem("aratiri_refreshToken")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0][0]).toEqual(
      expect.stringMatching(/\/accounts\/account$/)
    );

    window.removeEventListener("force-logout", onForceLogout);
  });
});
