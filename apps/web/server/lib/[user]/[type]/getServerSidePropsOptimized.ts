import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import type { GetBookingType } from "@calcom/features/bookings/lib/get-booking";
import { getBookingForReschedule, getBookingForSeatedEvent } from "@calcom/features/bookings/lib/get-booking";
import { orgDomainConfig } from "@calcom/features/ee/organizations/lib/orgDomains";
import { getUsernameList } from "@calcom/features/eventtypes/lib/defaultEvents";
import { EventRepositoryOptimized } from "@calcom/features/eventtypes/repositories/EventRepositoryOptimized";
import { shouldHideBrandingForUserEvent } from "@calcom/features/profile/lib/hideBranding";
import slugify from "@calcom/lib/slugify";
import { prisma } from "@calcom/prisma";
import { BookingStatus, RedirectType } from "@calcom/prisma/enums";
import { handleOrgRedirect } from "@lib/handleOrgRedirect";
import { getUsersInOrgContextOptimized } from "@server/lib/[user]/getUsersInOrgContextOptimized";
import type { GetServerSidePropsContext } from "next";
import type { Session } from "next-auth";
import { z } from "zod";

type Props = {
  eventData: NonNullable<Awaited<ReturnType<typeof EventRepositoryOptimized.getPublicEvent>>>;
  booking?: GetBookingType;
  rescheduleUid: string | null;
  bookingUid: string | null;
  user: string;
  slug: string;
  isBrandingHidden: boolean;
  isSEOIndexable: boolean | null;
  themeBasis: null | string;
  orgBannerUrl: null;
};

async function processRescheduleOptimized({
  props,
  rescheduleUid,
  session,
  allowRescheduleForCancelledBooking,
}: {
  props: Props;
  session: Session | null;
  rescheduleUid: string | string[] | undefined;
  allowRescheduleForCancelledBooking?: boolean;
}) {
  if (!rescheduleUid) return;

  const booking = await getBookingForReschedule(`${rescheduleUid}`, session?.user?.id);

  if (booking?.eventType?.disableRescheduling) {
    return {
      redirect: {
        destination: `/booking/${rescheduleUid}`,
        permanent: false,
      },
    };
  }

  if (
    booking === null ||
    !booking.eventTypeId ||
    (booking?.eventTypeId === props.eventData?.id &&
      (booking.status !== BookingStatus.CANCELLED ||
        allowRescheduleForCancelledBooking ||
        !!(props.eventData as any)?.allowReschedulingCancelledBookings))
  ) {
    props.booking = booking;
    props.rescheduleUid = Array.isArray(rescheduleUid) ? rescheduleUid[0] : rescheduleUid;
    return;
  }

  const redirectEventTypeTarget = await prisma.eventType.findUnique({
    where: { id: booking.eventTypeId },
    select: { slug: true },
  });
  
  if (!redirectEventTypeTarget) {
    return { notFound: true } as const;
  }
  
  return {
    redirect: {
      permanent: false,
      destination: redirectEventTypeTarget.slug,
    },
  };
}

async function processSeatedEventOptimized({
  props,
  bookingUid,
  allowRescheduleForCancelledBooking,
}: {
  props: Props;
  bookingUid: string | string[] | undefined;
  allowRescheduleForCancelledBooking?: boolean;
}) {
  if (!bookingUid) return;
  
  const booking = await getBookingForSeatedEvent(`${bookingUid}`);
  if (booking?.status === BookingStatus.CANCELLED && !allowRescheduleForCancelledBooking) {
    return {
      redirect: {
        permanent: false,
        destination: `${props.slug}`,
      },
    };
  } else {
    props.booking = booking;
    props.bookingUid = Array.isArray(bookingUid) ? bookingUid[0] : bookingUid;
  }
}

async function getDynamicGroupPagePropsOptimized(context: GetServerSidePropsContext) {
  const session = await getServerSession({ req: context.req });
  const { user: usernames, type: slug } = paramsSchema.parse(context.params);
  const { rescheduleUid, bookingUid } = context.query;
  const allowRescheduleForCancelledBooking = context.query.allowRescheduleForCancelledBooking === "true";
  const { currentOrgDomain, isValidOrgDomain } = orgDomainConfig(context.req, context.params?.orgSlug);
  const org = isValidOrgDomain ? currentOrgDomain : null;

  const redirect = await handleOrgRedirect({
    slugs: usernames,
    redirectType: RedirectType.User,
    eventTypeSlug: slug,
    context,
    currentOrgDomain: org,
  });

  if (redirect) {
    return redirect;
  }

  // Optimized: Parallel user lookup and event lookup
  const [usersInOrgContext, eventData] = await Promise.all([
    getUsersInOrgContextOptimized(usernames, isValidOrgDomain ? currentOrgDomain : null),
    EventRepositoryOptimized.getPublicEvent(
      {
        username: usernames.join("+"),
        eventSlug: slug,
        org,
        fromRedirectOfNonOrgLink: context.query.orgRedirection === "true",
      },
      session?.user?.id
    ),
  ]);

  if (!usersInOrgContext.length || !eventData) {
    return { notFound: true } as const;
  }

  const users = usersInOrgContext;

  // Redirect if no routing form response and redirect URL is configured
  const hasRoutingFormResponse =
    context.query["cal.routingFormResponseId"] || context.query["cal.queuedFormResponseId"];
  if (
    !hasRoutingFormResponse &&
    !rescheduleUid &&
    !bookingUid &&
    "redirectUrlOnNoRoutingFormResponse" in eventData &&
    eventData.redirectUrlOnNoRoutingFormResponse
  ) {
    return {
      redirect: {
        destination: eventData.redirectUrlOnNoRoutingFormResponse,
        permanent: false,
      },
    };
  }

  const props: Props = {
    eventData: {
      ...eventData,
      metadata: {
        ...(typeof eventData.metadata === 'object' && eventData.metadata !== null ? eventData.metadata : {}),
        multipleDuration: [15, 30, 45, 60, 90],
      },
    },
    user: usernames.join("+"),
    slug,
    isBrandingHidden: false,
    isSEOIndexable: true,
    themeBasis: null,
    bookingUid: bookingUid ? `${bookingUid}` : null,
    rescheduleUid: null,
    orgBannerUrl: null,
  };

  // Parallel processing of reschedule and seated event
  const [processRescheduleResult, processSeatResult] = await Promise.all([
    rescheduleUid
      ? processRescheduleOptimized({
          props,
          rescheduleUid,
          session,
          allowRescheduleForCancelledBooking,
        })
      : Promise.resolve(null),
    bookingUid
      ? processSeatedEventOptimized({
          props,
          bookingUid,
          allowRescheduleForCancelledBooking,
        })
      : Promise.resolve(null),
  ]);

  if (processRescheduleResult) {
    return processRescheduleResult;
  }
  if (processSeatResult) {
    return processSeatResult;
  }

  return { props };
}

async function getUserPagePropsOptimized(context: GetServerSidePropsContext) {
  const session = await getServerSession({ req: context.req });
  const { user: usernames, type: slug } = paramsSchema.parse(context.params);
  const username = usernames[0];
  const { rescheduleUid, bookingUid } = context.query;
  const allowRescheduleForCancelledBooking = context.query.allowRescheduleForCancelledBooking === "true";
  const { currentOrgDomain, isValidOrgDomain } = orgDomainConfig(context.req, context.params?.orgSlug);

  const redirect = await handleOrgRedirect({
    slugs: usernames,
    redirectType: RedirectType.User,
    eventTypeSlug: slug,
    context,
    currentOrgDomain: isValidOrgDomain ? currentOrgDomain : null,
  });

  if (redirect) {
    return redirect;
  }

  // Optimized: Parallel user lookup and event lookup
  const [user, eventData] = await Promise.all([
    getUsersInOrgContextOptimized([username], isValidOrgDomain ? currentOrgDomain : null).then(users => users[0]),
    EventRepositoryOptimized.getPublicEvent(
      {
        username,
        eventSlug: slug,
        org: isValidOrgDomain ? currentOrgDomain : null,
        fromRedirectOfNonOrgLink: context.query.orgRedirection === "true",
      },
      session?.user?.id
    ),
  ]);

  if (!user || !eventData) {
    return { notFound: true } as const;
  }

  // Redirect if no routing form response and redirect URL is configured
  const hasRoutingFormResponse =
    context.query["cal.routingFormResponseId"] || context.query["cal.queuedFormResponseId"];
  if (
    !hasRoutingFormResponse &&
    !rescheduleUid &&
    !bookingUid &&
    "redirectUrlOnNoRoutingFormResponse" in eventData &&
    eventData.redirectUrlOnNoRoutingFormResponse
  ) {
    return {
      redirect: {
        destination: eventData.redirectUrlOnNoRoutingFormResponse,
        permanent: false,
      },
    };
  }

  const allowSEOIndexing = currentOrgDomain
    ? user?.profile?.organization?.organizationSettings?.allowSEOIndexing
      ? user?.allowSEOIndexing
      : false
    : user?.allowSEOIndexing;

  const props: Props = {
    eventData: eventData,
    user: username,
    slug,
    isBrandingHidden: shouldHideBrandingForUserEvent({
      eventTypeId: eventData.id,
      owner: user,
    }),
    isSEOIndexable: allowSEOIndexing,
    themeBasis: username,
    bookingUid: bookingUid ? `${bookingUid}` : null,
    rescheduleUid: null,
    orgBannerUrl: eventData?.owner?.profile?.organization?.bannerUrl ?? null,
  };

  // Parallel processing of reschedule and seated event
  const [processRescheduleResult, processSeatResult] = await Promise.all([
    rescheduleUid
      ? processRescheduleOptimized({
          props,
          rescheduleUid,
          session,
          allowRescheduleForCancelledBooking,
        })
      : Promise.resolve(null),
    bookingUid
      ? processSeatedEventOptimized({
          props,
          bookingUid,
          allowRescheduleForCancelledBooking,
        })
      : Promise.resolve(null),
  ]);

  if (processRescheduleResult) {
    return processRescheduleResult;
  }
  if (processSeatResult) {
    return processSeatResult;
  }

  return { props };
}

const paramsSchema = z.object({
  type: z.string().transform((s) => slugify(s)),
  user: z.string().transform((s) => getUsernameList(s)),
});

export const getServerSidePropsOptimized = async (context: GetServerSidePropsContext) => {
  const { user } = paramsSchema.parse(context.params);
  const isDynamicGroup = user.length > 1;

  return isDynamicGroup 
    ? await getDynamicGroupPagePropsOptimized(context) 
    : await getUserPagePropsOptimized(context);
};
