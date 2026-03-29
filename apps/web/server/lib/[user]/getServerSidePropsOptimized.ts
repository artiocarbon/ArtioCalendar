import { encode } from "node:querystring";
import { orgDomainConfig } from "@calcom/features/ee/organizations/lib/orgDomains";
import { getUsernameList } from "@calcom/features/eventtypes/lib/defaultEvents";
import { getEventTypesPublicOptimized } from "@calcom/features/eventtypes/lib/getEventTypesPublicOptimized";
import { getBrandingForUser } from "@calcom/features/profile/lib/getBranding";
import { UserRepository } from "@calcom/features/users/repositories/UserRepository";
import { DEFAULT_DARK_BRAND_COLOR, DEFAULT_LIGHT_BRAND_COLOR, SINGLE_ORG_SLUG } from "@calcom/lib/constants";
import { getUserAvatarUrl } from "@calcom/lib/getAvatarUrl";
import logger from "@calcom/lib/logger";
import { markdownToSafeHTML } from "@calcom/lib/markdownToSafeHTML";
import { safeStringify } from "@calcom/lib/safeStringify";
import { stripMarkdown } from "@calcom/lib/stripMarkdown";
import { prisma } from "@calcom/prisma";
import type { EventType, User } from "@calcom/prisma/client";
import { RedirectType } from "@calcom/prisma/enums";
import type { EventTypeMetaDataSchema } from "@calcom/prisma/zod-utils";
import type { UserProfile } from "@calcom/types/UserProfile";
import { handleOrgRedirect } from "@lib/handleOrgRedirect";
import type { EmbedProps } from "app/WithEmbedSSR";
import type { GetServerSideProps } from "next";
import type { z } from "zod";

const log = logger.getSubLogger({ prefix: ["[[pages/[user]] Optimized]"] });

type UserPageProps = {
  profile: {
    name: string;
    image: string;
    theme: string | null;
    brandColor: string;
    darkBrandColor: string;
    organization: {
      requestedSlug: string | null;
      slug: string | null;
      id: number | null;
      brandColor: string | null;
      darkBrandColor: string | null;
      theme: string | null;
    } | null;
    allowSEOIndexing: boolean;
    username: string | null;
  };
  users: (Pick<User, "name" | "username" | "bio" | "verified" | "avatarUrl"> & {
    profile: UserProfile;
  })[];
  themeBasis: string | null;
  markdownStrippedBio: string;
  safeBio: string;
  entity: {
    logoUrl?: string | null;
    considerUnpublished: boolean;
    orgSlug?: string | null;
    name?: string | null;
    teamSlug?: string | null;
  };
  eventTypes: ({
    descriptionAsSafeHTML: string;
    metadata: z.infer<typeof EventTypeMetaDataSchema>;
  } & Pick<
    EventType,
    | "id"
    | "title"
    | "slug"
    | "length"
    | "hidden"
    | "lockTimeZoneToggleOnBookingPage"
    | "lockedTimeZone"
    | "requiresConfirmation"
    | "canSendCalVideoTranscriptionEmails"
    | "requiresBookerEmailVerification"
    | "price"
    | "currency"
    | "recurringEvent"
    | "seatsPerTimeSlot"
    | "schedulingType"
  >)[];
  isOrgSEOIndexable: boolean | undefined;
} & EmbedProps;

export const getServerSidePropsOptimized: GetServerSideProps<UserPageProps> = async (context) => {
  const { currentOrgDomain, isValidOrgDomain } = orgDomainConfig(context.req, context.params?.orgSlug);
  const usernameList = getUsernameList(context.query.user as string);
  const isARedirectFromNonOrgLink = context.query.orgRedirection === "true";
  const dataFetchStart = Date.now();

  const redirect = await handleOrgRedirect({
    slugs: usernameList,
    redirectType: RedirectType.User,
    eventTypeSlug: null,
    context,
    currentOrgDomain: isValidOrgDomain ? currentOrgDomain : null,
  });

  if (redirect) {
    return redirect;
  }

  // Optimized: Combine all user lookup queries into parallel operations
  const userRepo = new UserRepository(prisma);
  
  const [
    usersInOrgContext,
    platformMembers,
    personalUsers
  ] = await Promise.all([
    // Primary user lookup
    userRepo.findUsersByUsername({
      usernameList,
      orgSlug: isValidOrgDomain ? currentOrgDomain : null,
    }),
    
    // Platform members lookup (fallback)
    userRepo.findPlatformMembersByUsernames({
      usernameList,
    }),
    
    // Personal users lookup (conditional fallback)
    (isValidOrgDomain && SINGLE_ORG_SLUG)
      ? userRepo.findUsersByUsername({
          usernameList,
          orgSlug: null,
        })
      : Promise.resolve([]),
  ]);

  // Use first successful result
  const finalUsers = usersInOrgContext.length 
    ? usersInOrgContext 
    : platformMembers.length 
      ? platformMembers 
      : personalUsers;

  const isDynamicGroup = finalUsers.length > 1;
  log.debug(safeStringify({ finalUsers, isValidOrgDomain, currentOrgDomain, isDynamicGroup }));

  if (isDynamicGroup) {
    const destinationUrl = encodeURI(`/${usernameList.join("+")}/dynamic`);
    const originalQueryString = new URLSearchParams(context.query as Record<string, string>).toString();
    const destinationWithQuery = `${destinationUrl}?${originalQueryString}`;
    log.debug(`Dynamic group detected, redirecting to ${destinationUrl}`);
    return {
      redirect: {
        permanent: false,
        destination: destinationWithQuery,
      },
    } as const;
  }

  const isNonOrgUser = (user: { profile: UserProfile }) => !user.profile?.organization;
  const isThereAnyNonOrgUser = finalUsers.some(isNonOrgUser);

  if (!finalUsers.length || (!isValidOrgDomain && !isThereAnyNonOrgUser)) {
    return {
      notFound: true,
    } as const;
  }

  const [user] = finalUsers;

  // Parallel fetch event types and prepare profile data
  const [eventTypes, branding] = await Promise.all([
    getEventTypesPublicOptimized(user.id),
    Promise.resolve(getBrandingForUser({ user })),
  ]);

  const profile = {
    name: user.name || user.username || "",
    image: getUserAvatarUrl({
      avatarUrl: user.avatarUrl,
    }),
    theme: branding.theme,
    brandColor: branding.brandColor ?? DEFAULT_LIGHT_BRAND_COLOR,
    avatarUrl: user.avatarUrl,
    darkBrandColor: branding.darkBrandColor ?? DEFAULT_DARK_BRAND_COLOR,
    allowSEOIndexing: user.allowSEOIndexing ?? true,
    username: user.username,
    organization: user.profile.organization,
  };

  const dataFetchEnd = Date.now();
  if (context.query.log === "1") {
    context.res.setHeader("X-Data-Fetch-Time", `${dataFetchEnd - dataFetchStart}ms`);
  }

  // if profile only has one public event-type, redirect to it
  if (eventTypes.length === 1 && context.query.redirect !== "false") {
    const urlDestination = `/${user.profile.username}/${eventTypes[0].slug}`;
    const { query } = context;
    const urlQuery = new URLSearchParams(encode(query));

    return {
      redirect: {
        permanent: false,
        destination: `${encodeURI(urlDestination)}?${urlQuery}`,
      },
    };
  }

  const safeBio = markdownToSafeHTML(user.bio) || "";
  const markdownStrippedBio = stripMarkdown(user?.bio || "");
  const org = finalUsers[0].profile.organization;

  return {
    props: {
      users: finalUsers.map((user) => ({
        name: user.name,
        username: user.username,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        verified: user.verified,
        profile: user.profile,
      })),
      entity: {
        ...(org?.logoUrl ? { logoUrl: org?.logoUrl } : {}),
        considerUnpublished: !isARedirectFromNonOrgLink && org?.slug === null,
        orgSlug: currentOrgDomain,
        name: org?.name ?? null,
      },
      eventTypes,
      safeBio,
      profile,
      themeBasis: user.username,
      markdownStrippedBio,
      isOrgSEOIndexable: org?.organizationSettings?.allowSEOIndexing ?? false,
    },
  };
};
