import authedProcedure from "../../../../procedures/authedProcedure";
import { ZGetInputSchema } from "../get.schema";

export const get = authedProcedure.input(ZGetInputSchema).query(async ({ ctx, input }) => {
  const handler = (await import("../get-optimized.handler")).getOptimizedHandler;

  return handler({ ctx, input });
});
