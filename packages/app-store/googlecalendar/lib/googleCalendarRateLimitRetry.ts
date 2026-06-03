import { safeStringify } from "@calcom/lib/safeStringify";

/** First retry after 30s, second after 2 minutes (Google quota windows are often per-minute). */
export const GOOGLE_CALENDAR_RATE_LIMIT_RETRY_DELAYS_MS = [30_000, 120_000] as const;

type GoogleApiErrorShape = {
  code?: number;
  errors?: Array<{ domain?: string; reason?: string }>;
};

export function isGoogleCalendarRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const { code, errors } = error as GoogleApiErrorShape;
  if (code === 429) return true;

  if (code === 403) {
    return errors?.some((e) => e.domain === "usageLimits" && e.reason === "rateLimitExceeded") ?? false;
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type RetryLogger = {
  warn: (message: string, data?: string) => void;
};

/**
 * Retries Google Calendar API calls when Google returns usage rate limits.
 * The official google-api-nodejs-client does not retry PATCH requests or 403 rateLimitExceeded.
 */
export async function withGoogleCalendarRateLimitRetry<T>(
  operation: () => Promise<T>,
  log: RetryLogger
): Promise<T> {
  const maxAttempts = GOOGLE_CALENDAR_RATE_LIMIT_RETRY_DELAYS_MS.length + 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const delayMs = GOOGLE_CALENDAR_RATE_LIMIT_RETRY_DELAYS_MS[attempt];

      if (!isGoogleCalendarRateLimitError(error) || delayMs === undefined) {
        throw error;
      }

      log.warn(
        `Google Calendar rate limit exceeded, retrying in ${delayMs / 1000}s`,
        safeStringify({
          attempt: attempt + 1,
          maxAttempts: maxAttempts - 1,
        })
      );
      await sleep(delayMs);
    }
  }

  throw lastError;
}
