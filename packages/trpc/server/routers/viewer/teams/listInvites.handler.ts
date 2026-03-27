import { prisma } from "@calcom/prisma";
import type { TrpcSessionUser } from "@calcom/trpc/server/types";

type ListInvitesOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
};

export const listInvitesHandler = async ({ ctx }: ListInvitesOptions) => {
  const userId = ctx.user.id;
  return await prisma.membership.findMany({
    where: {
      user: {
        id: userId,
      },
      accepted: false,
    },
    select: {
      id: true,
      role: true,
      accepted: true,
      createdAt: true,
      team: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
        },
      },
    },
  });
};

export default listInvitesHandler;
