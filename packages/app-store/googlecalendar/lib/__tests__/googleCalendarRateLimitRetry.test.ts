import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  GOOGLE_CALENDAR_RATE_LIMIT_RETRY_DELAYS_MS,
  isGoogleCalendarRateLimitError,
  withGoogleCalendarRateLimitRetry,
} from "../googleCalendarRateLimitRetry";

describe("isGoogleCalendarRateLimitError", () => {
  test("detects 403 usageLimits rateLimitExceeded", () => {
    expect(
      isGoogleCalendarRateLimitError({
        code: 403,
        errors: [{ domain: "usageLimits", reason: "rateLimitExceeded", message: "Rate Limit Exceeded" }],
      })
    ).toBe(true);
  });

  test("detects 429", () => {
    expect(isGoogleCalendarRateLimitError({ code: 429 })).toBe(true);
  });

  test("ignores other 403 errors", () => {
    expect(
      isGoogleCalendarRateLimitError({
        code: 403,
        errors: [{ domain: "global", reason: "forbidden", message: "Forbidden" }],
      })
    ).toBe(false);
  });
});

describe("withGoogleCalendarRateLimitRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns result without retry on success", async () => {
    const operation = vi.fn().mockResolvedValue("ok");
    const log = { warn: vi.fn() };

    await expect(withGoogleCalendarRateLimitRetry(operation, log)).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(1);
    expect(log.warn).not.toHaveBeenCalled();
  });

  test("retries after rate limit then succeeds", async () => {
    const rateLimitError = {
      code: 403,
      errors: [{ domain: "usageLimits", reason: "rateLimitExceeded" }],
    };
    const operation = vi.fn().mockRejectedValueOnce(rateLimitError).mockResolvedValueOnce("ok");
    const log = { warn: vi.fn() };

    const promise = withGoogleCalendarRateLimitRetry(operation, log);
    await vi.advanceTimersByTimeAsync(GOOGLE_CALENDAR_RATE_LIMIT_RETRY_DELAYS_MS[0]);

    await expect(promise).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(log.warn).toHaveBeenCalledTimes(1);
  });

  test("does not retry non-rate-limit errors", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("network"));
    const log = { warn: vi.fn() };

    await expect(withGoogleCalendarRateLimitRetry(operation, log)).rejects.toThrow("network");
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
