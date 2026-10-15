import { channelIdSchema, channelInfoSchema } from "@/lib/channel";
import { titleFilterSchema } from "@/lib/title-filter";
import { z } from "@/lib/zod";

export const semiSubscriptionSchema = channelInfoSchema.extend({
  filter: titleFilterSchema,
  createdAt: z.number()
});
export type SemiSubscription = z.infer<typeof semiSubscriptionSchema>;

export const semiSubscriptionsSchema = z.record(channelIdSchema, semiSubscriptionSchema);
export type SemiSubscriptions = z.infer<typeof semiSubscriptionsSchema>;
