import logger from "@calcom/lib/logger";
import { markdownToSafeHTML } from "@calcom/lib/markdownToSafeHTML";
import prisma from "@calcom/prisma";
import type { Prisma } from "@calcom/prisma/client";
import type { baseEventTypeSelect } from "@calcom/prisma/selects";
import { EventTypeMetaDataSchema } from "@calcom/prisma/zod-utils";

const log = logger.getSubLogger({ prefix: ["getEventTypesPublicOptimized"] });

export type EventTypesPublic = Awaited<ReturnType<typeof getEventTypesPublicOptimized>>;

export async function getEventTypesPublicOptimized(userId: number) {
  // Optimized: Single query with proper indexing and only required fields
  const eventTypes = await prisma.eventType.findMany({
    where: {
      teamId: null,
      userId: userId,
    },
    select: {
      id: true,
      title: true,
      description: true,
      length: true,
      schedulingType: true,
      recurringEvent: true,
      slug: true,
      hidden: true,
      price: true,
      currency: true,
      lockTimeZoneToggleOnBookingPage: true,
      lockedTimeZone: true,
      requiresConfirmation: true,
      requiresBookerEmailVerification: true,
      metadata: true,
      canSendCalVideoTranscriptionEmails: true,
      seatsPerTimeSlot: true,
    },
    orderBy: [
      { position: 'desc' },
      { id: 'asc' },
    ],
  });

  // Process in parallel if there are many event types
  if (eventTypes.length > 10) {
    // Batch process for large numbers of event types
    const batchSize = 10;
    const results = [];
    
    for (let i = 0; i < eventTypes.length; i += batchSize) {
      const batch = eventTypes.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((eventType) => ({
          ...eventType,
          metadata: EventTypeMetaDataSchema.parse(eventType.metadata || {}),
          descriptionAsSafeHTML: markdownToSafeHTML(eventType.description),
        }))
      );
      results.push(...batchResults);
    }
    
    return results.filter((evt) => !evt.hidden);
  }

  // Process smaller number of event types normally
  return eventTypes
    .filter((evt) => !evt.hidden)
    .map((eventType) => ({
      ...eventType,
      metadata: EventTypeMetaDataSchema.parse(eventType.metadata || {}),
      descriptionAsSafeHTML: markdownToSafeHTML(eventType.description),
    }));
}
