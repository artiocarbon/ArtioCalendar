import prisma from "@calcom/prisma";

const getUserBookingOptimized = async (uid: string) => {
  // First, get the basic booking info with minimal selects
  const bookingInfo = await prisma.booking.findUnique({
    where: {
      uid: uid,
    },
    select: {
      title: true,
      id: true,
      uid: true,
      startTime: true,
      endTime: true,
      status: true,
      eventTypeId: true,
      userPrimaryEmail: true,
      fromReschedule: true,
      rescheduled: true,
      rescheduledBy: true,
      // Only get essential nested data initially
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          timeZone: true,
          avatarUrl: true,
        },
      },
      attendees: {
        select: {
          name: true,
          email: true,
          timeZone: true,
          phoneNumber: true,
        },
        orderBy: {
          id: "asc",
        },
      },
    },
  });

  if (!bookingInfo) {
    return null;
  }

  // Parallel fetch additional data to avoid N+1 queries
  const [
    eventType,
    seatsReferences,
    tracking,
    assignmentReason,
    additionalBookingFields,
  ] = await Promise.all([
    // Event type info
    bookingInfo.eventTypeId
      ? prisma.eventType.findUnique({
          where: { id: bookingInfo.eventTypeId },
          select: {
            eventName: true,
            slug: true,
            timeZone: true,
            schedulingType: true,
            hideOrganizerEmail: true,
          },
        })
      : null,
    
    // Seats references
    prisma.bookingSeat.findMany({
      where: { booking: { uid } },
      select: {
        referenceUid: true,
      },
    }),
    
    // Tracking data
    prisma.tracking.findUnique({
      where: { bookingId: bookingInfo.id },
      select: {
        utm_source: true,
        utm_medium: true,
        utm_campaign: true,
        utm_term: true,
        utm_content: true,
      },
    }),
    
    // Assignment reason
    prisma.assignmentReason.findFirst({
      where: { bookingId: bookingInfo.id },
      select: {
        reasonEnum: true,
        reasonString: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 1,
    }),
    
    // Additional booking fields
    prisma.booking.findUnique({
      where: { uid },
      select: {
        description: true,
        customInputs: true,
        smsReminderNumber: true,
        recurringEventId: true,
        location: true,
        metadata: true,
        cancellationReason: true,
        cancelledBy: true,
        responses: true,
        rejectionReason: true,
      },
    }),
  ]);

  // Combine all data
  return {
    ...bookingInfo,
    ...additionalBookingFields,
    eventType,
    seatsReferences,
    tracking,
    assignmentReason,
  };
};

export default getUserBookingOptimized;
