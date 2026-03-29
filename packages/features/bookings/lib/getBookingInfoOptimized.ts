import { getBookingWithResponses } from "@calcom/features/bookings/lib/get-booking";
import getUserBookingOptimized from "./getUserBookingOptimized";

const getBookingInfoOptimized = async (uid: string) => {
  const bookingInfoRaw = await getUserBookingOptimized(uid);

  if (!bookingInfoRaw) {
    return { bookingInfoRaw: undefined, bookingInfo: undefined };
  }

  const bookingInfo = getBookingWithResponses(bookingInfoRaw);

  return { bookingInfoRaw, bookingInfo };
};

export default getBookingInfoOptimized;
