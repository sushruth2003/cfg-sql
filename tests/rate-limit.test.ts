import { describe, expect, it, vi } from "vitest";

describe("enforceRateLimit", () => {
  it("allows requests until the configured limit and then blocks", async () => {
    vi.resetModules();
    vi.stubEnv("RATE_LIMIT_QUERY_MAX_REQUESTS", "2");
    vi.stubEnv("RATE_LIMIT_QUERY_WINDOW_SECONDS", "3600");

    const { enforceRateLimit } = await import("@/lib/rate-limit");

    const request = new Request("http://local/api/query", {
      headers: { "x-forwarded-for": "203.0.113.5" },
    });

    const first = enforceRateLimit(request, "query");
    const second = enforceRateLimit(request, "query");
    const third = enforceRateLimit(request, "query");

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);

    vi.unstubAllEnvs();
  });

  it("resets allowance after the window elapses", async () => {
    vi.resetModules();
    vi.stubEnv("RATE_LIMIT_EVAL_MAX_REQUESTS", "1");
    vi.stubEnv("RATE_LIMIT_EVAL_WINDOW_SECONDS", "1");

    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(1000);

    const { enforceRateLimit } = await import("@/lib/rate-limit");

    const request = new Request("http://local/api/evals", {
      headers: { "x-forwarded-for": "203.0.113.9" },
    });

    const first = enforceRateLimit(request, "evals");
    const blocked = enforceRateLimit(request, "evals");

    nowSpy.mockReturnValue(2500);
    const afterWindow = enforceRateLimit(request, "evals");

    expect(first.allowed).toBe(true);
    expect(blocked.allowed).toBe(false);
    expect(afterWindow.allowed).toBe(true);

    nowSpy.mockRestore();
    vi.unstubAllEnvs();
  });
});
