import { passwordResetRequest } from "@calcom/features/auth/lib/passwordResetRequest";
import { checkRateLimitAndThrowError } from "@calcom/lib/checkRateLimitAndThrowError";
import { emailSchema } from "@calcom/lib/emailSchema";
import getIP from "@calcom/lib/getIP";
import { HttpError } from "@calcom/lib/http-error";
import { piiHasher } from "@calcom/lib/server/PiiHasher";
import prisma from "@calcom/prisma";
import { defaultResponderForAppDir } from "app/api/defaultResponderForAppDir";
import { parseRequestData } from "app/api/parseRequestData";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const forgotPasswordSuccessResponse = () =>
  NextResponse.json({ message: "password_reset_email_sent" }, { status: 201 });

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, timeoutLabel: string): Promise<T> => {
  let timeoutRef: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutRef = setTimeout(() => reject(new Error(timeoutLabel)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutRef) clearTimeout(timeoutRef);
  }
};

async function handler(req: NextRequest) {
  const body = await parseRequestData(req);
  const email = emailSchema.transform((val) => val.toLowerCase()).safeParse(body?.email);

  if (!email.success) {
    return NextResponse.json({ message: "email is required" }, { status: 400 });
  }

  const ip = getIP(req) ?? email.data;

  try {
    await withTimeout(
      checkRateLimitAndThrowError({
        rateLimitingType: "core",
        identifier: `forgotPassword:${piiHasher.hash(ip)}`,
      }),
      1500,
      "FORGOT_PASSWORD_RATE_LIMIT_TIMEOUT"
    );
  } catch (error) {
    if (error instanceof HttpError && error.statusCode === 429) {
      throw error;
    }
    console.error("FORGOT_PASSWORD_RATE_LIMIT_ERROR", error);
  }

  try {
    const user = await withTimeout(
      prisma.user.findUnique({
        where: { email: email.data },
        select: { name: true, email: true, locale: true },
      }),
      3000,
      "FORGOT_PASSWORD_USER_LOOKUP_TIMEOUT"
    );

    // Don't leak info about whether the user exists
    if (user) {
      void passwordResetRequest(user).catch((error) => {
        console.error("FORGOT_PASSWORD_SEND_EMAIL_ERROR", error);
      });
    }

    return forgotPasswordSuccessResponse();
  } catch (reason) {
    console.error("FORGOT_PASSWORD_ROUTE_ERROR", reason);
    return forgotPasswordSuccessResponse();
  }
}

export const POST = defaultResponderForAppDir(handler);
