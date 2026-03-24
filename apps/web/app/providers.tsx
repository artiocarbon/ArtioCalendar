"use client";

import { TrpcProvider } from "app/_trpc/trpc-provider";
import { SessionProvider } from "next-auth/react";
import CacheProvider from "react-inlinesvg/provider";
import { ToastProvider } from "@coss/ui/components/toast";

import { WebPushProvider } from "@calcom/web/modules/notifications/components/WebPushContext";

import { GeoProvider } from "./GeoContext";

type ProvidersProps = {
  isEmbed: boolean;
  children: React.ReactNode;
  nonce: string | undefined;
  country: string;
};
export function Providers({ isEmbed, children, country }: ProvidersProps) {
  return (
    <GeoProvider country={country}>
      <SessionProvider>
        <TrpcProvider>
          <ToastProvider position="bottom-center">
            {/* @ts-expect-error FIXME remove this comment when upgrading typescript to v5 */}
            <CacheProvider>
              <WebPushProvider>{children}</WebPushProvider>
            </CacheProvider>
          </ToastProvider>
        </TrpcProvider>
      </SessionProvider>
    </GeoProvider>
  );
}
