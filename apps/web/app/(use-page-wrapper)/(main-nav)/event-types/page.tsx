import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { getTeamsFiltersFromQuery } from "@calcom/features/filters/lib/getTeamsFiltersFromQuery";
import type { RouterOutputs } from "@calcom/trpc/react";
import { eventTypesRouter } from "@calcom/trpc/server/routers/viewer/eventTypes/_router";
import { buildLegacyRequest } from "@lib/buildLegacyCtx";
import { createRouterCaller, getTRPCContext } from "app/_trpc/context";
import type { PageProps } from "app/_types";
import { _generateMetadata } from "app/_utils";
import { unstable_cache } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactElement } from "react";
import { EventTypesWrapper } from "./EventTypesWrapper";

const Page = async ({ searchParams }: PageProps): Promise<ReactElement> => {
  const _searchParams = await searchParams;
  const _headers = await headers();
  const _cookies = await cookies();

  const session = await getServerSession({
    req: buildLegacyRequest(_headers, _cookies),
  });
  if (!session?.user?.id) {
    return redirect("/auth/login");
  }

  const filters = getTeamsFiltersFromQuery(_searchParams);
  let filtersKey = "all";
  if (filters) {
    filtersKey = JSON.stringify({
      teamIds: filters.teamIds,
      userIds: filters.userIds,
      upIds: filters.upIds,
    });
  }

  // Speed knob #1: server-side caching keyed by the signed-in user + filters.
  const userEventGroupsData = await unstable_cache(
    async (): Promise<RouterOutputs["viewer"]["eventTypes"]["getUserEventGroups"]> => {
      const eventTypesCaller = await createRouterCaller(
        eventTypesRouter,
        await getTRPCContext(_headers, _cookies)
      );
      return await eventTypesCaller.getUserEventGroups({ filters });
    },
    ["viewer.eventTypes.getUserEventGroups", session.user.id, filtersKey],
    { revalidate: 300 } // seconds (5 minutes)
  )();

  return <EventTypesWrapper userEventGroupsData={userEventGroupsData} user={session.user} />;
};

export const generateMetadata = async (): Promise<ReturnType<typeof _generateMetadata>> =>
  await _generateMetadata(
    (t) => t("event_types_page_title"),
    (t) => t("event_types_page_subtitle"),
    undefined,
    undefined,
    "/event-types"
  );

export default Page;
