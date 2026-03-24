import { sendEmailVerification } from "@calcom/features/auth/lib/verifyEmail";
import { checkRateLimitAndThrowError } from "@calcom/lib/checkRateLimitAndThrowError";
import logger from "@calcom/lib/logger";

import { TRPCError } from "@trpc/server";

import type { TrpcSessionUser } from "../../../types";

type ResendEmailOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
};

const log = logger.getSubLogger({ prefix: [`[Auth] `] });

export const sendSenderEmailVerificationHandler = async ({ ctx }: ResendEmailOptions) => {
  const { user } = ctx;

  if (!user.senderEmail) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Sender email not set" });
  }

  await checkRateLimitAndThrowError({
    rateLimitingType: "core",
    identifier: `sendSenderEmailVerification:${user.id}`,
  });

  if (user.senderEmailVerified) {
    log.info(`User ${user.id} already verified sender email`);
    return { ok: true, skipped: true };
  }

  const email = await sendEmailVerification({
    email: user.senderEmail,
    username: user.username ?? undefined,
    language: user.locale,
    extraParams: { purpose: "senderEmail" },
  });

  return email;
};
