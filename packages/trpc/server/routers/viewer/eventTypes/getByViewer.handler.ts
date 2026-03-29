import { getEventTypesByViewerOptimized } from "@calcom/features/eventtypes/lib/getEventTypesByViewerOptimized";
import { checkRateLimitAndThrowError } from "@calcom/lib/checkRateLimitAndThrowError";
import type { PrismaClient } from "@calcom/prisma";

import type { TrpcSessionUser } from "../../../types";
import type { TEventTypeInputSchema } from "./getByViewer.schema";

type GetByViewerOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
    prisma: PrismaClient;
  };
  input: TEventTypeInputSchema;
};

export const getByViewerHandler = async ({ ctx, input }: GetByViewerOptions) => {
  await checkRateLimitAndThrowError({
    identifier: `eventTypes:getByViewer:${ctx.user.id}`,
    rateLimitingType: "common",
  });
  const user = ctx.user;
  const filters = input?.filters;
  const forRoutingForms = input?.forRoutingForms;

  return await getEventTypesByViewerOptimized(user, filters, forRoutingForms);
};
