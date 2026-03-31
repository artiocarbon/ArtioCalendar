import type { GetServerSidePropsContext } from "next";
import z from "zod";

import slugify from "@calcom/lib/slugify";
import { getUsernameList } from "@calcom/features/eventtypes/lib/defaultEvents";

import { getServerSideProps as GSSUserTypePage } from "@server/lib/[user]/[type]/getServerSideProps";

const paramsSchema = z.object({
  orgSlug: z.string(),
  user: z.string(),
  type: z.string().transform((s) => slugify(s)),
});

export const getServerSideProps = async (ctx: GetServerSidePropsContext) => {
  const { user, type } = paramsSchema.parse(ctx.params);
  const usernames = getUsernameList(user);
  const isDynamicGroup = usernames.length > 1;

  if (isDynamicGroup) {
    const params = { user, type };
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
  const params = { user, type };
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
