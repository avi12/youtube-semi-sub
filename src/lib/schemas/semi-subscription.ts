import { legacyRegexFilterSchema, titleFilterSchema } from "@/lib/filter/title-filter";
import { channelIdSchema, channelInfoSchema } from "@/lib/schemas/channel";
import { z } from "@/lib/zod";

const semiSubscriptionSchema = channelInfoSchema.extend({
  filter: titleFilterSchema,
  createdAt: z.number()
});
export type SemiSubscription = z.infer<typeof semiSubscriptionSchema>;

export const semiSubscriptionsSchema = z.record(channelIdSchema, semiSubscriptionSchema);
export type SemiSubscriptions = z.infer<typeof semiSubscriptionsSchema>;

/** Storage v1 predates filter kinds, though builds since wrote today's filters under v1 too - so either can be there */
const semiSubscriptionsV1Schema = z.record(
  channelIdSchema,
  semiSubscriptionSchema.extend({
    filter: z.union([titleFilterSchema, legacyRegexFilterSchema])
  })
);

export function migrateSemiSubscriptionsToV2(stored: unknown) {
  const parsed = semiSubscriptionsV1Schema.safeParse(stored);
  return parsed.success ? parsed.data : stored;
}

/** A-Z by channel title, like YouTube's own subscription lists */
export function listByTitle(subscriptions: SemiSubscriptions) {
  return Object.values(subscriptions).toSorted((left, right) => left.title.localeCompare(right.title));
}
