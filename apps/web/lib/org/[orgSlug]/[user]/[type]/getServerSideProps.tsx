import type { GetServerSidePropsContext } from "next";
import z from "zod";

import { getSlugOrRequestedSlug } from "@calcom/features/ee/organizations/lib/orgDomains";
import slugify from "@calcom/lib/slugify";
import { getUsernameList } from "@calcom/features/eventtypes/lib/defaultEvents";
import prisma from "@calcom/prisma";

import { getServerSideProps as GSSTeamTypePage } from "@lib/team/[slug]/[type]/getServerSideProps";

import { getServerSideProps as GSSUserTypePage } from "@server/lib/[user]/[type]/getServerSideProps";

const paramsSchema = z.object({
  orgSlug: z.string().transform((s) => slugify(s)),
  user: z.string().transform((s) => getUsernameList(s)),
  type: z.string().transform((s) => slugify(s)),
});

export const getServerSideProps = async (ctx: GetServerSidePropsContext) => {
  const { user: teamOrUserSlugOrDynamicGroup, orgSlug, type } = paramsSchema.parse(ctx.params);
  const isDynamicGroup = Array.isArray(teamOrUserSlugOrDynamicGroup);

  if (isDynamicGroup) {
    const params = { user: teamOrUserSlugOrDynamicGroup, type };
    return GSSUserTypePage({
      ...ctx,
      params: {
        ...ctx.params,
        ...params,
      },
      query: {
        ...ctx.query,
        ...params,
      },
    });
  }

  const firstUsername = teamOrUserSlugOrDynamicGroup;

  const team = await prisma.team.findFirst({
    where: {
      slug: slugify(firstUsername),
      parentId: {
        not: null,
      },
      parent: getSlugOrRequestedSlug(orgSlug),
    },
    select: {
      id: true,
    },
  });

  if (team) {
    const params = { slug: firstUsername, type };
    return GSSTeamTypePage({
      ...ctx,
      params: {
        ...ctx.params,
        ...params,
      },
      query: {
        ...ctx.query,
        ...params,
      },
    });
  }
  const params = { user: teamOrUserSlugOrDynamicGroup, type };
  return GSSUserTypePage({
    ...ctx,
    params: {
      ...ctx.params,
      ...params,
    },
    query: {
      ...ctx.query,
      ...params,
    },
  });
};
