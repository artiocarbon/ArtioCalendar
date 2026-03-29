import type { CalendarEvent, Person } from "@calcom/types/Calendar";

import { BaseScheduledEmailEnhanced } from "./BaseScheduledEmailEnhanced";

export const AttendeeScheduledEmailEnhanced = (
  props: {
    calEvent: CalendarEvent;
    attendee: Person;
  } & Partial<React.ComponentProps<typeof BaseScheduledEmailEnhanced>>
) => {
  return (
    <BaseScheduledEmailEnhanced
      locale={props.attendee.language.locale}
      timeZone={props.attendee.timeZone}
      t={props.attendee.language.translate}
      timeFormat={props.attendee?.timeFormat}
      {...props}
    />
  );
};
