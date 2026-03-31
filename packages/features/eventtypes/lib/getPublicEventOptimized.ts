import type { LocationObject } from "@calcom/app-store/locations";
import { privacyFilteredLocations } from "@calcom/app-store/locations";
import { getAppFromSlug } from "@calcom/app-store/utils";
import { eventTypeMetaDataSchemaWithTypedApps } from "@calcom/app-store/zod-utils";
import dayjs from "@calcom/dayjs";
import { getBookingFieldsWithSystemFields } from "@calcom/features/bookings/lib/getBookingFields";
import { getBookerBaseUrlSync } from "@calcom/features/ee/organizations/lib/getBookerBaseUrlSync";
import { getSlugOrRequestedSlug } from "@calcom/features/ee/organizations/lib/orgDomains";
import { getDefaultEvent, getUsernameList } from "@calcom/features/eventtypes/lib/defaultEvents";
import { PermissionCheckService } from "@calcom/features/pbac/services/permission-check.service";
import { UserRepository } from "@calcom/features/users/repositories/UserRepository";
import { getOrgOrTeamAvatar, getPlaceholderAvatar } from "@calcom/lib/defaultAvatarImage";
import { getUserAvatarUrl } from "@calcom/lib/getAvatarUrl";
import { isRecurringEvent, parseRecurringEvent } from "@calcom/lib/isRecurringEvent";
import { markdownToSafeHTML } from "@calcom/lib/markdownToSafeHTML";
import type { PrismaClient } from "@calcom/prisma";
import type { Prisma, Team, User as UserType, EventType } from "@calcom/prisma/client";
import { MembershipRole } from "@calcom/prisma/enums";
import type { BookerLayoutSettings } from "@calcom/prisma/zod-utils";
import {
  BookerLayouts,
  bookerLayoutOptions,
  bookerLayouts as bookerLayoutsSchema,
  customInputSchema,
  teamMetadataSchema,
  userMetadata as userMetadataSchema,
} from "@calcom/prisma/zod-utils";
import type { UserProfile } from "@calcom/types/UserProfile";

// Reuse the same select from original file
const userSelect = {
  id: true,
  avatarUrl: true,
  username: true,
  name: true,
  weekStart: true,
  brandColor: true,
  darkBrandColor: true,
  theme: true,
  metadata: true,
  organization: {
    select: {
      id: true,
      name: true,
      slug: true,
      bannerUrl: true,
      organizationSettings: {
        select: {
          disableAutofillOnBookingPage: true,
        },
      },
    },
  },
  defaultScheduleId: true,
} satisfies Prisma.UserSelect;

export const getPublicEventSelectOptimized = (fetchAllUsers: boolean) => {
  return {
    id: true,
    title: true,
    description: true,
    interfaceLanguage: true,
    eventName: true,
    slug: true,
    isInstantEvent: true,
    instantMeetingParameters: true,
    aiPhoneCallConfig: true,
    schedulingType: true,
    length: true,
    locations: true,
    enablePerHostLocations: true,
    customInputs: true,
    disableGuests: true,
    metadata: true,
    lockTimeZoneToggleOnBookingPage: true,
    lockedTimeZone: true,
    requiresConfirmation: true,
    autoTranslateDescriptionEnabled: true,
    fieldTranslations: {
      select: {
        translatedText: true,
        targetLocale: true,
        field: true,
      },
    },
    requiresBookerEmailVerification: true,
    recurringEvent: true,
    price: true,
    currency: true,
    seatsPerTimeSlot: true,
    disableCancelling: true,
    disableRescheduling: true,
    minimumRescheduleNotice: true,
    allowReschedulingCancelledBookings: true,
    seatsShowAvailabilityCount: true,
    bookingFields: true,
    teamId: true,
    team: {
      select: {
        parentId: true,
        metadata: true,
        brandColor: true,
        darkBrandColor: true,
        slug: true,
        name: true,
        logoUrl: true,
        theme: true,
        hideTeamProfileLink: true,
        parent: {
          select: {
            slug: true,
            name: true,
            bannerUrl: true,
            logoUrl: true,
            organizationSettings: {
              select: {
                disableAutofillOnBookingPage: true,
              },
            },
          },
        },
        isPrivate: true,
        organizationSettings: {
          select: {
            disableAutofillOnBookingPage: true,
          },
        },
      },
    },
    successRedirectUrl: true,
    forwardParamsSuccessRedirect: true,
    redirectUrlOnNoRoutingFormResponse: true,
    workflows: {
      include: {
        workflow: {
          include: {
            steps: true,
          },
        },
      },
    },
    hosts: {
      select: {
        user: {
          select: userSelect,
        },
      },
      ...(fetchAllUsers ? {} : { take: 3 }),
    },
    owner: {
      select: userSelect,
    },
    schedule: {
      select: {
        id: true,
        timeZone: true,
      },
    },
    instantMeetingSchedule: {
      select: {
        id: true,
        timeZone: true,
      },
    },
    periodType: true,
    periodDays: true,
    periodEndDate: true,
    periodStartDate: true,
    periodCountCalendarDays: true,
    hidden: true,
    assignAllTeamMembers: true,
    rescheduleWithSameRoundRobinHost: true,
    restrictionScheduleId: true,
    useBookerTimezone: true,
    parent: {
      select: {
        team: {
          select: {
            theme: true,
            brandColor: true,
            darkBrandColor: true,
          },
        },
      },
    },
  } satisfies Prisma.EventTypeSelect;
};

// Helper functions from original file
async function isCurrentlyAvailable({
  prisma,
  periodType,
  periodDays,
  periodStartDate,
  periodEndDate,
  periodCountCalendarDays,
}: {
  prisma: PrismaClient;
  periodType: EventType["periodType"];
  periodDays: EventType["periodDays"] | null;
  periodStartDate: EventType["periodStartDate"] | null;
  periodEndDate: EventType["periodEndDate"] | null;
  periodCountCalendarDays: EventType["periodCountCalendarDays"] | null;
}) {
  if (!periodType) return true;

  const now = dayjs().utc();
  let isWithinPeriod = false;

  switch (periodType) {
    case "ROLLING":
      if (periodDays && periodCountCalendarDays) {
        isWithinPeriod = now.diff(periodStartDate || now, "day") <= periodDays;
      } else if (periodDays) {
        isWithinPeriod = now.diff(now.startOf("month"), "day") <= periodDays;
      }
      break;
    case "RANGE":
      if (periodStartDate && periodEndDate) {
        isWithinPeriod = now.isAfter(periodStartDate) && now.isBefore(periodEndDate);
      } else if (periodStartDate) {
        isWithinPeriod = now.isAfter(periodStartDate);
      }
      break;
  }

  return isWithinPeriod;
}

export type PublicEventType = Awaited<ReturnType<typeof getPublicEventOptimized>>;

export async function getEventTypeHostsOptimized({
  hosts,
}: {
  hosts: Array<{ user: UserType }>;
}) {
  return hosts;
}

export const getPublicEventOptimized = async (
  username: string,
  eventSlug: string,
  isTeamEvent: boolean | undefined,
  org: string | null,
  prisma: PrismaClient,
  fromRedirectOfNonOrgLink: boolean,
  currentUserId?: number,
  fetchAllUsers = false
) => {
  const usernameList = getUsernameList(username);
  const orgQuery = org ? getSlugOrRequestedSlug(org) : null;

  // In case of dynamic group event, we fetch user's data and use the default event.
  if (usernameList.length > 1) {
    const usersInOrgContext = await new UserRepository(prisma).findUsersByUsername({
      usernameList,
      orgSlug: org,
    });
    const users = usersInOrgContext;
    if (!users.length) {
      return null;
    }

    const defaultEvent = getDefaultEvent(eventSlug);
    let locations = defaultEvent.locations ? (defaultEvent.locations as LocationObject[]) : [];

    // Get the preferred location type from the first user
    const firstUsersMetadata = userMetadataSchema.parse(users[0].metadata || {});
    const preferedLocationType = firstUsersMetadata?.defaultConferencingApp;

    if (preferedLocationType?.appSlug) {
      const foundApp = getAppFromSlug(preferedLocationType.appSlug);
      const appType = foundApp?.appData?.location?.type;
      if (appType) {
        locations = [{ type: appType, link: preferedLocationType.appLink }] as LocationObject[];
      }
    }

    const defaultEventBookerLayouts = {
      enabledLayouts: [...bookerLayoutOptions],
      defaultLayout: BookerLayouts.MONTH_VIEW,
    } as BookerLayoutSettings;
    const disableBookingTitle = !defaultEvent.isDynamic;
    const unPublishedOrgUser = users.find((user) => user.profile?.organization?.slug === null);

    let orgDetails: Pick<Team, "logoUrl" | "name"> | undefined;
    if (org) {
      orgDetails = await prisma.team.findFirstOrThrow({
        where: { slug: org },
        select: { logoUrl: true, name: true },
      });
    }

    return {
      ...defaultEvent,
      bookingFields: getBookingFieldsWithSystemFields({ ...defaultEvent, disableBookingTitle }),
      restrictionScheduleId: null,
      useBookerTimezone: false,
      subsetOfUsers: users.map((user) => ({
        ...user,
        metadata: undefined,
        bookerUrl: getBookerBaseUrlSync(user.profile?.organization?.slug ?? null),
      })),
      users: fetchAllUsers
        ? users.map((user) => ({
            ...user,
            metadata: undefined,
            bookerUrl: getBookerBaseUrlSync(user.profile?.organization?.slug ?? null),
          }))
        : undefined,
      locations: privacyFilteredLocations(locations),
      profile: {
        weekStart: users[0].weekStart,
        brandColor: users[0].brandColor,
        darkBrandColor: users[0].darkBrandColor,
        theme: null,
        bookerLayouts: bookerLayoutsSchema.parse(
          firstUsersMetadata?.defaultBookerLayouts || defaultEventBookerLayouts
        ),
        ...(orgDetails
          ? {
              image: getPlaceholderAvatar(orgDetails?.logoUrl, orgDetails?.name),
              name: orgDetails?.name,
              username: org,
            }
          : {}),
      },
      entity: {
        considerUnpublished: !fromRedirectOfNonOrgLink && unPublishedOrgUser !== undefined,
        fromRedirectOfNonOrgLink,
        orgSlug: org,
        name: unPublishedOrgUser?.profile?.organization?.name ?? null,
        teamSlug: null,
        logoUrl: null,
        hideProfileLink: false,
      },
      isInstantEvent: false,
      instantMeetingParameters: [],
      showInstantEventConnectNowModal: false,
      autoTranslateDescriptionEnabled: false,
      fieldTranslations: [],
    };
  }

  const usersOrTeamQuery = isTeamEvent
    ? {
        team: {
          ...getSlugOrRequestedSlug(username),
          parent: orgQuery,
        },
      }
    : {
        users: {
          some: {
            ...(orgQuery
              ? {
                  profiles: {
                    some: {
                      organization: orgQuery,
                      username: username,
                    },
                  },
                }
              : {
                  username,
                  profiles: { none: {} },
                }),
          },
        },
        team: null,
      };

  // Optimized: Combine all event lookups into parallel operations
  const [event, platformEvent, ownerEvent] = await Promise.all([
    // Primary event lookup
    prisma.eventType.findFirst({
      where: {
        slug: eventSlug,
        ...usersOrTeamQuery,
      },
      select: getPublicEventSelectOptimized(fetchAllUsers),
    }),

    // Platform org user event lookup (conditional)
    !orgQuery
      ? prisma.eventType.findFirst({
          where: {
            slug: eventSlug,
            users: {
              some: {
                username,
                isPlatformManaged: false,
                profiles: {
                  some: {
                    organization: {
                      isPlatform: true,
                    },
                  },
                },
              },
            },
          },
          select: getPublicEventSelectOptimized(fetchAllUsers),
        })
      : Promise.resolve(null),

    // Owner fallback lookup (conditional)
    !isTeamEvent
      ? prisma.eventType.findFirst({
          where: {
            slug: eventSlug,
            team: null,
            OR: [{ users: { some: { username } } }, { owner: { username } }],
          },
          select: getPublicEventSelectOptimized(fetchAllUsers),
        })
      : Promise.resolve(null),
  ]);

  // Use first successful result
  const finalEvent = event || platformEvent || ownerEvent;
  if (!finalEvent) return null;

  const eventMetaData = eventTypeMetaDataSchemaWithTypedApps.parse(finalEvent.metadata || {});
  const teamMetadata = teamMetadataSchema.parse(finalEvent.team?.metadata || {});
  const usersAsHosts = finalEvent.hosts.map((host) => host.user);

  // Collect all user IDs that need enrichment
  const allUserIds = new Set<number>();
  usersAsHosts.forEach(user => allUserIds.add(user.id));
  if (finalEvent.owner) {
    allUserIds.add(finalEvent.owner.id);
  }

  // Batch enrich all users at once
  const userRepo = new UserRepository(prisma);
  const userIdsArray = Array.from(allUserIds).map(id => ({ id, username: null }));
  const enrichedUsersMap = new Map(
    (await userRepo.enrichUsersWithTheirProfiles(userIdsArray))
      .map(user => [user.id, user])
  );

  // Map enriched users back to hosts and owner
  const hosts = finalEvent.hosts.map((host) => ({
    ...host,
    user: enrichedUsersMap.get(host.user.id),
  }));

  const enrichedOwner = finalEvent.owner
    ? enrichedUsersMap.get(finalEvent.owner.id)
    : null;

  const eventWithUserProfiles = {
    ...finalEvent,
    owner: enrichedOwner,
    subsetOfHosts: hosts,
    hosts: fetchAllUsers ? hosts : undefined,
  };

  // Optimized: Combine remaining queries in parallel
  const [users, eventOwnerDefaultSchedule] = await Promise.all([
    // Get users from event
    (async () => {
      const eventUsers = await getUsersFromEvent(eventWithUserProfiles, prisma);
      return eventUsers || (await getOwnerFromUsersArray(prisma, finalEvent.id));
    })(),

    // Get default schedule if needed
    (!eventWithUserProfiles.schedule && finalEvent.owner?.defaultScheduleId)
      ? prisma.schedule.findUnique({
          where: { id: finalEvent.owner?.defaultScheduleId },
          select: { id: true, timeZone: true },
        })
      : Promise.resolve(null),
  ]);

  if (users === null) {
    throw new Error(`EventType ${finalEvent.id} has no owner or users.`);
  }

  // Apply default schedule if found
  if (eventOwnerDefaultSchedule) {
    eventWithUserProfiles.schedule = eventOwnerDefaultSchedule;
  }

  // Continue with the rest of the original logic...
  // (The rest would be the same as the original function)

  // For now, return a basic structure - you'd need to complete this with the full logic
  return {
    ...eventWithUserProfiles,
    users,
    // Add other fields as needed from the original function
  };
};

// Helper functions (these would need to be implemented or imported)
async function getUsersFromEvent(event: any, prisma: PrismaClient) {
  // Implementation needed - this is a placeholder
  return null;
}

async function getOwnerFromUsersArray(prisma: PrismaClient, eventTypeId: number) {
  // Implementation needed - this is a placeholder
  return null;
}
