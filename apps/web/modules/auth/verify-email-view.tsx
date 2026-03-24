"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { useEffect } from "react";

import { APP_NAME } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import useEmailVerifyCheck from "@calcom/trpc/react/hooks/useEmailVerifyCheck";
import { Button } from "@calcom/ui/components/button";
import { EmptyScreen } from "@calcom/ui/components/empty-screen";
import { showToast } from "@calcom/ui/components/toast";

const GMAIL_INBOX_HREF =
  "https://mail.google.com/mail/u/0/#search/%22api%2Fauth%2Fverify-email%22";

function VerifyEmailPage() {
  const { data } = useEmailVerifyCheck();
  const { data: session } = useSession();
  const router = useRouter();
  const { t, isLocaleReady } = useLocale();
  const mutation = trpc.viewer.auth.resendVerifyEmail.useMutation();
  useEffect(() => {
    if (data?.isVerified) {
      posthog.capture("verify_email_already_verified", {});
      router.replace("/event-types");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.isVerified]);
  if (!isLocaleReady) {
    return null;
  }
  return (
    <div className="h-screen w-full ">
      <div className="flex h-full w-full flex-col items-center justify-center">
        <div className="max-w-3xl">
          <EmptyScreen
            border
            dashedBorder={false}
            Icon="mail-open"
            headline={t("check_your_email")}
            description={t("verify_email_page_body", { email: session?.user?.email, appName: APP_NAME })}
            className="bg-default"
            buttonRaw={
              <>
                <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
                  <Button
                    color="secondary"
                    href={GMAIL_INBOX_HREF}
                    target="_blank"
                    rel="noopener noreferrer">
                    <img src="/email-clients/gmail.svg" alt="Gmail" className="me-1 h-4 w-4" /> Gmail
                  </Button>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Button
                    color="minimal"
                    loading={mutation.isPending}
                    onClick={() => {
                      posthog.capture("verify_email_resend_clicked");
                      mutation.mutate(undefined, {
                        onSuccess: () => {
                          showToast(t("send_email"), "success");
                        },
                        onError: () => {
                          showToast(t("error"), "error");
                        },
                      });
                    }}>
                    {t("resend_email")}
                  </Button>
                  <Button
                    color="minimal"
                    onClick={() => {
                      signOut({ callbackUrl: "/signup" });
                    }}>
                    {t("use_different_email")}
                  </Button>
                </div>
              </>
            }
          />
        </div>
      </div>
    </div>
  );
}

export default VerifyEmailPage;
