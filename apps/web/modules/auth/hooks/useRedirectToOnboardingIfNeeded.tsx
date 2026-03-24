"use client";

import dayjs from "@calcom/dayjs";
import useMeQuery from "@calcom/trpc/react/hooks/useMeQuery";

/** @deprecated Kept for any deep imports; onboarding client redirects are disabled. */
export const ONBOARDING_INTRODUCED_AT = dayjs("September 1 2021").toISOString();

/** @deprecated Kept for any deep imports; onboarding client redirects are disabled. */
export const ONBOARDING_NEXT_REDIRECT = {
  redirect: {
    permanent: false,
    destination: "/getting-started",
  },
} as const;

/**
 * Previously redirected incomplete users to /getting-started or /onboarding/getting-started.
 * That is disabled so self-hosted installs without those routes are not looped into 404s.
 * Server-side gating still uses `checkOnboardingRedirect` in `onboardingUtils.ts`.
 */
export function useRedirectToOnboardingIfNeeded() {
  const { isLoading } = useMeQuery();
  return {
    isLoading,
    shouldRedirectToOnboarding: false,
  };
}
