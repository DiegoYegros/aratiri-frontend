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

  it("forceLogout attempts logout when refresh present", async () => {
    localStorage.setItem("aratiri_accessToken", "access-token");
    localStorage.setItem("aratiri_refreshToken", "refresh-token");

    const onForceLogout = vi.fn();
    window.addEventListener("force-logout", onForceLogout);

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: "Unauthorized" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: "Invalid refresh token" }),
      } as Response)
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response);

    const apiCall = await loadApiCall();

    await expect(apiCall("/accounts/account")).rejects.toBeTruthy();

    const logoutCall = vi
      .mocked(fetch)
      .mock.calls.find(
        (call) =>
          typeof call[0] === "string" && /\/auth\/logout$/.test(call[0])
      );
    expect(logoutCall).toBeDefined();
    expect(logoutCall![1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ refreshToken: "refresh-token" }),
    });
    expect(onForceLogout).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("aratiri_accessToken")).toBeNull();
    expect(localStorage.getItem("aratiri_refreshToken")).toBeNull();

    window.removeEventListener("force-logout", onForceLogout);
  });

  it("revokeRefreshToken posts logout without Authorization and does not refresh", async () => {
    localStorage.setItem("aratiri_accessToken", "access-token");
    localStorage.setItem("aratiri_refreshToken", "refresh-token");

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);

    const { revokeRefreshToken } = await import("@/app/lib/api");
    revokeRefreshToken();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0][0]).toEqual(
      expect.stringMatching(/\/auth\/logout$/)
    );
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ refreshToken: "refresh-token" }));
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBeNull();
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(
          (call) =>
            typeof call[0] === "string" && /\/auth\/refresh$/.test(call[0])
        )
    ).toBe(false);
    // Helper does not clear storage — callers clear after revoke.
    expect(localStorage.getItem("aratiri_refreshToken")).toBe("refresh-token");
  });

  it("auth/logout 401 via apiCall does not enter refresh", async () => {
    localStorage.setItem("aratiri_accessToken", "access-token");
    localStorage.setItem("aratiri_refreshToken", "refresh-token");

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: "Unauthorized" }),
    } as Response);

    const apiCall = await loadApiCall();

    await expect(
      apiCall("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken: "refresh-token" }),
      })
    ).rejects.toMatchObject({ status: 401 });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0][0]).toEqual(
      expect.stringMatching(/\/auth\/logout$/)
    );
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(
          (call) =>
            typeof call[0] === "string" && /\/auth\/refresh$/.test(call[0])
        )
    ).toBe(false);
    expect(localStorage.getItem("aratiri_refreshToken")).toBe("refresh-token");
  });
});
