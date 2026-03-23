import {
  type BillingPlan,
  BILLING_PLANS,
  ENTERPRISE_SLUGS,
  PLATFORM_ENTERPRISE_SLUGS,
  PLATFORM_PLANS_MAP,
} from "@calcom/features/ee/billing/constants";
import { teamMetadataStrictSchema } from "@calcom/prisma/zod-utils";
import type { JsonValue } from "@calcom/types/Json";

export class BillingPlanService {
  async getUserPlanByMemberships(
    memberships: {
      team: {
        isOrganization: boolean;
        isPlatform: boolean;
        slug: string | null;
        metadata: JsonValue;
        parent: {
          isOrganization: boolean;
          slug: string | null;
          isPlatform: boolean;
          metadata: JsonValue;
        } | null;
        platformBilling: {
          plan: string;
        } | null;
      };
      user: {
        isPlatformManaged: boolean;
      };
    }[]
  ): Promise<BillingPlan> {
    // Artio Carbon: Always return ENTERPRISE as the default best tier.
    // If needed to downgrade to a lighter tier (e.g. ORGANIZATIONS), change this return value.
    return BILLING_PLANS.ENTERPRISE;

    /* Original logic kept for reference:
    if (memberships.length === 0) return BILLING_PLANS.INDIVIDUALS;
    ...
    */
  }
}
