/**
 * Sends transactional email via Resend's HTTPS API (port 443).
 * Prefer this over SMTP to smtp.resend.com:465 when outbound SMTP is blocked or slow.
 */
import { getResendApiKey } from "@calcom/lib/serverConfig";

const RESEND_API_URL = "https://api.resend.com/emails";

function extractEmailAddress(displayOrRaw: string): string {
  const trimmed = displayOrRaw.trim();
  const angle = trimmed.match(/<([^>]+)>/);
  if (angle?.[1]) return angle[1].trim();
  return trimmed;
}

type ResendEmailPayload = {
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
};

export async function sendEmailViaResendHttpApi(
  payload: ResendEmailPayload,
  options?: { apiKey?: string }
): Promise<void> {
  const apiKey = options?.apiKey?.trim() ?? getResendApiKey();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }

  const toEmail = extractEmailAddress(payload.to);
  if (!toEmail) {
    throw new Error("Resend email send failed: missing recipient");
  }

  const body: Record<string, unknown> = {
    from: payload.from,
    to: [toEmail],
    subject: payload.subject,
  };

  if (payload.html) body.html = payload.html;
  if (payload.text) body.text = payload.text;
  if (payload.replyTo) body.reply_to = payload.replyTo;
  if (payload.headers && Object.keys(payload.headers).length > 0) {
    body.headers = payload.headers;
  }

  if (!payload.html && !payload.text) {
    throw new Error("Resend email send failed: html or text is required");
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  let message: string | undefined;
  try {
    const json = (await response.json()) as { message?: string };
    message = json.message;
  } catch {
    // non-JSON body
  }

  if (!response.ok) {
    throw new Error(message ?? `Resend API error (${response.status}): ${response.statusText || "unknown"}`);
  }
}
