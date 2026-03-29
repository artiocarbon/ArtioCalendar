import dayjs from "@calcom/dayjs";
import { formatPrice } from "@calcom/lib/currencyConversions";
import { TimeFormat } from "@calcom/lib/timeFormat";
import type { CalendarEvent, Person } from "@calcom/types/Calendar";
import type { TFunction } from "i18next";
import {
  AppsStatus,
  BaseEmailHtmlEnhanced,
  InfoEnhanced,
  LocationInfo,
  ManageLink,
  UserFieldsResponses,
  WhenInfo,
  WhoInfo,
} from "../components";
import { PersonInfo } from "../components/WhoInfo";
import { EnhancedButton } from "../components/EnhancedButton";

export const BaseScheduledEmailEnhanced = (
  props: {
    calEvent: CalendarEvent;
    attendee: Person;
    timeZone: string;
    includeAppsStatus?: boolean;
    t: TFunction;
    locale: string;
    timeFormat: TimeFormat | undefined;
    isOrganizer?: boolean;
    reassigned?: { name: string | null; email: string; reason?: string; byUser?: string };
  } & Partial<React.ComponentProps<typeof BaseEmailHtmlEnhanced>>
) => {
  const { t, timeZone, locale, timeFormat: timeFormat_ } = props;

  const timeFormat = timeFormat_ ?? TimeFormat.TWELVE_HOUR;

  function getRecipientStart(format: string) {
    return dayjs(props.calEvent.startTime).tz(timeZone).format(format);
  }

  function getRecipientEnd(format: string) {
    return dayjs(props.calEvent.endTime).tz(timeZone).format(format);
  }

  const subject = t(props.subject || "confirmed_event_type_subject", {
    eventType: props.calEvent.type,
    name: props.calEvent.team?.name || props.calEvent.organizer.name,
    date: `${getRecipientStart("h:mma")} - ${getRecipientEnd("h:mma")}, ${t(
      getRecipientStart("dddd").toLowerCase()
    )}, ${t(getRecipientStart("MMMM").toLowerCase())} ${getRecipientStart("D, YYYY")}`,
    interpolation: { escapeValue: false },
  });

  let rescheduledBy = props.calEvent.rescheduledBy;
  if (
    rescheduledBy &&
    rescheduledBy === props.calEvent.organizer.email &&
    props.calEvent.hideOrganizerEmail
  ) {
    const personWhoRescheduled = [props.calEvent.organizer, ...props.calEvent.attendees].find(
      (person) => person.email === rescheduledBy
    );
    rescheduledBy = personWhoRescheduled?.name;
  }

  return (
    <BaseEmailHtmlEnhanced
      hideLogo={Boolean(props.calEvent.platformClientId) || Boolean(props.calEvent.hideBranding)}
      headerType={props.headerType || "checkCircle"}
      subject={props.subject || subject}
      title={t(
        props.title
          ? props.title
          : props.calEvent.recurringEvent?.count
            ? "your_event_has_been_scheduled_recurring"
            : "your_event_has_been_scheduled"
      )}
      callToAction={
        props.callToAction === null
          ? null
          : props.callToAction || (
              <div style={{ textAlign: "center" }}>
                <EnhancedButton href={`https://calendar.artiocarbon.com/${props.attendee.username}/${props.calEvent.slug}`}>
                  {t("manage_booking")}
                </EnhancedButton>
                <p style={{
                  color: "#6B7280",
                  fontSize: "13px",
                  margin: "12px 0 0 0",
                  textAlign: "center",
                  lineHeight: "1.4"
                }}>
                  {t("booking_confirmation_subtitle")}
                </p>
              </div>
            )
      }
      subtitle={props.subtitle || <>{t("emailed_you_and_any_other_attendees")}</>}>
      
      {/* Enhanced styling for rejection/cancellation reasons */}
      {props.calEvent.rejectionReason && (
        <InfoEnhanced 
          label={t("rejection_reason")} 
          description={props.calEvent.rejectionReason} 
          withSpacer 
        />
      )}
      
      {props.calEvent.cancellationReason && (
        <InfoEnhanced
          label={t(
            props.calEvent.cancellationReason.startsWith("$RCH$")
              ? "reason_for_reschedule"
              : "cancellation_reason"
          )}
          description={
            !!props.calEvent.cancellationReason && props.calEvent.cancellationReason.replace("$RCH$", "")
          }
          withSpacer
        />
      )}
      
      {/* Enhanced styling for reassignment info */}
      {props.reassigned && !props.reassigned.byUser && (
        <>
          <InfoEnhanced
            label={t("reassigned_to")}
            description={
              <PersonInfo name={props.reassigned.name || undefined} email={props.reassigned.email} />
            }
            withSpacer
          />
          {props.reassigned?.reason && (
            <InfoEnhanced label={t("reason")} description={props.reassigned.reason} withSpacer />
          )}
        </>
      )}
      
      {props.reassigned && props.reassigned.byUser && (
        <>
          <InfoEnhanced label={t("reassigned_by")} description={props.reassigned.byUser} withSpacer />
          {props.reassigned?.reason && (
            <InfoEnhanced label={t("reason")} description={props.reassigned.reason} withSpacer />
          )}
        </>
      )}
      
      {rescheduledBy && <InfoEnhanced label={t("rescheduled_by")} description={rescheduledBy} withSpacer />}
      
      {/* Core event information with enhanced styling */}
      <InfoEnhanced label={t("what")} description={props.calEvent.title} withSpacer />
      <WhenInfo timeFormat={timeFormat} calEvent={props.calEvent} t={t} timeZone={timeZone} locale={locale} />
      <WhoInfo calEvent={props.calEvent} t={t} />
      <LocationInfo calEvent={props.calEvent} t={t} />
      <InfoEnhanced label={t("description")} description={props.calEvent.description} withSpacer formatted />
      <InfoEnhanced label={t("additional_notes")} description={props.calEvent.additionalNotes} withSpacer formatted />
      
      {props.includeAppsStatus && <AppsStatus calEvent={props.calEvent} t={t} />}
      
      {props.isOrganizer && props.calEvent.assignmentReason && (
        <InfoEnhanced
          label={t("assignment_reason")}
          description={`${t(props.calEvent.assignmentReason.category)}${props.calEvent.assignmentReason.details ? `: ${props.calEvent.assignmentReason.details}` : ""}`}
          withSpacer
        />
      )}
      
      <UserFieldsResponses t={t} calEvent={props.calEvent} isOrganizer={props.isOrganizer} />
      
      {/* Enhanced payment info styling */}
      {props.calEvent.paymentInfo?.amount && (
        <InfoEnhanced
          label={props.calEvent.paymentInfo.paymentOption === "HOLD" ? t("no_show_fee") : t("price")}
          description={formatPrice(
            props.calEvent.paymentInfo.amount,
            props.calEvent.paymentInfo.currency,
            props.attendee.language.locale
          )}
          withSpacer
        />
      )}
    </BaseEmailHtmlEnhanced>
  );
};
