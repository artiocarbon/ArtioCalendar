import { getPublicEventOptimized } from "@calcom/features/eventtypes/lib/getPublicEventOptimized";
import prisma from "@calcom/prisma";

export type GetPublicEventInput = {
  username: string;
  eventSlug: string;
  isTeamEvent?: boolean;
  org: string | null;
  fromRedirectOfNonOrgLink: boolean;
};

export class EventRepositoryOptimized {
  static async getPublicEvent(input: GetPublicEventInput, userId?: number) {
    const event = await getPublicEventOptimized(
      input.username,
      input.eventSlug,
      input.isTeamEvent,
      input.org,
      prisma,
      input.fromRedirectOfNonOrgLink,
      userId
    );
    return event;
  }
}
