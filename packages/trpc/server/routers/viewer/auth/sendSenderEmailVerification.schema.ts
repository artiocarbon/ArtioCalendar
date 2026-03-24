import { z } from "zod";

export const ZSendSenderEmailVerificationSchema = z.object({});

export type TSendSenderEmailVerificationSchema = z.infer<typeof ZSendSenderEmailVerificationSchema>;
