import { legacyRegexFilterSchema, titleFilterSchema } from "@/lib/filter/title-filter";
import { channelIdSchema, channelInfoSchema } from "@/lib/schemas/channel";
import { z } from "@/lib/zod";

const semiSubscriptionV2Schema = channelInfoSchema.extend({
  filter: titleFilterSchema,
  createdAt: z.number()
});

const semiSubscriptionSchema = semiSubscriptionV2Schema.extend({
  /** The user subscribed officially: the filter is kept, but nothing reaches the feed until they unsubscribe */
  isHalted: z.boolean()
});
export type SemiSubscription = z.infer<typeof semiSubscriptionSchema>;

export const semiSubscriptionsSchema = z.record(channelIdSchema, semiSubscriptionSchema);
export type SemiSubscriptions = z.infer<typeof semiSubscriptionsSchema>;

/** Storage v1 predates filter kinds, though builds since wrote today's filters under v1 too - so either can be there */
const semiSubscriptionsV1Schema = z.record(
  channelIdSchema,
  semiSubscriptionV2Schema.extend({
    filter: z.union([titleFilterSchema, legacyRegexFilterSchema])
  })
);

export function migrateSemiSubscriptionsToV2(stored: unknown) {
  const parsed = semiSubscriptionsV1Schema.safeParse(stored);
  return parsed.success ? parsed.data : stored;
}

const semiSubscriptionsV2Schema = z.record(channelIdSchema, semiSubscriptionV2Schema);

/** Storage v3 adds the halt that an official subscription puts on a semi-subscription - none were halted before */
export function migrateSemiSubscriptionsToV3(stored: unknown) {
  const parsed = semiSubscriptionsV2Schema.safeParse(stored);
  if (!parsed.success) {
    return stored;
  }

  const migrated: SemiSubscriptions = {};
  for (const [channelId, subscription] of Object.entries(parsed.data)) {
    migrated[channelId] = {
      ...subscription,
      isHalted: false
    };
  }
  return migrated;
}

/** A-Z by channel title, like YouTube's own subscription lists */
export function listByTitle(subscriptions: SemiSubscriptions) {
  return Object.values(subscriptions).toSorted((left, right) => left.title.localeCompare(right.title));
}
