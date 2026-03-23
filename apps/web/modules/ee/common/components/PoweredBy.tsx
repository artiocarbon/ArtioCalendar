import Link from "next/link";

import { useIsEmbed } from "@calcom/embed-core/embed-iframe";
import { APP_NAME, POWERED_BY_URL } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";

const PoweredByCal = ({
  logoOnly,
  hasValidLicense,
}: {
  logoOnly?: boolean;
  hasValidLicense?: boolean | null;
}) => {
  return null;
};

export default PoweredByCal;
