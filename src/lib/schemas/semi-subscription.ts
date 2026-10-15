import { titleFilterSchema } from "@/lib/filter/title-filter";
import { channelIdSchema, channelInfoSchema } from "@/lib/schemas/channel";
import { z } from "@/lib/zod";

const semiSubscriptionSchema = channelInfoSchema.extend({
  filter: titleFilterSchema,
  createdAt: z.number()
});
export type SemiSubscription = z.infer<typeof semiSubscriptionSchema>;

export const semiSubscriptionsSchema = z.record(channelIdSchema, semiSubscriptionSchema);
export type SemiSubscriptions = z.infer<typeof semiSubscriptionsSchema>;

/** A-Z by channel title, like YouTube's own subscription lists */
export function listByTitle(subscriptions: SemiSubscriptions) {
  return Object.values(subscriptions).toSorted((left, right) => left.title.localeCompare(right.title));
}
