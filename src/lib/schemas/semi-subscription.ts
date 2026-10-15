import {
  DEFAULT_TITLE_FILTER,
  legacyRegexFilterSchema,
  type TitleFilter,
  titleFilterSchema
} from "@/lib/filter/title-filter";
import { channelIdSchema, channelInfoSchema } from "@/lib/schemas/channel";
import { SubscriptionMode } from "@/lib/schemas/subscription-mode";
import { z } from "@/lib/zod";

const semiSubscriptionV2Schema = channelInfoSchema.extend({
  filter: titleFilterSchema,
  createdAt: z.number()
});

const semiSubscriptionV3Schema = semiSubscriptionV2Schema.extend({
  isHalted: z.boolean()
});
type SemiSubscriptionV3 = z.infer<typeof semiSubscriptionV3Schema>;

const semiSubscriptionSchema = semiSubscriptionV2Schema.omit({ filter: true }).extend({
  /** Picks the videos added to the feed while the user isn't subscribed */
  followFilter: titleFilterSchema,
  /** Picks the videos hidden from the feed while the user is subscribed - an empty one hides nothing */
  hideFilter: titleFilterSchema,
  /** Subscribed on YouTube, which switches the channel to hiding. Both filters are kept either way */
  isSubscribed: z.boolean()
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

  const migrated: Record<string, SemiSubscriptionV3> = {};
  for (const [channelId, subscription] of Object.entries(parsed.data)) {
    migrated[channelId] = {
      ...subscription,
      isHalted: false
    };
  }
  return migrated;
}

const semiSubscriptionsV3Schema = z.record(channelIdSchema, semiSubscriptionV3Schema);

/**
 * Storage v4 gives every channel a mode: the filter becomes the follow filter, a halt becomes a subscription, and the
 * new hide filter starts empty - so a subscribed channel hides nothing, as a halted one let nothing through
 */
export function migrateSemiSubscriptionsToV4(stored: unknown) {
  const parsed = semiSubscriptionsV3Schema.safeParse(stored);
  if (!parsed.success) {
    return stored;
  }

  const migrated: SemiSubscriptions = {};
  for (const [channelId, { filter, isHalted, ...subscription }] of Object.entries(parsed.data)) {
    migrated[channelId] = {
      ...subscription,
      followFilter: filter,
      hideFilter: {
        ...DEFAULT_TITLE_FILTER
      },
      isSubscribed: isHalted
    };
  }
  return migrated;
}

const FILTER_KEY_BY_MODE = {
  [SubscriptionMode.follow]: "followFilter",
  [SubscriptionMode.hide]: "hideFilter"
} as const satisfies Record<SubscriptionMode, keyof SemiSubscription>;

/** The subscription with one mode's filter replaced */
export function withModeFilter({ subscription, mode, filter }: {
  subscription: SemiSubscription;
  mode: SubscriptionMode;
  filter: TitleFilter;
}) {
  const updated: SemiSubscription = {
    ...subscription,
    [FILTER_KEY_BY_MODE[mode]]: filter
  };
  return updated;
}

/** A-Z by channel title, like YouTube's own subscription lists */
export function listByTitle(subscriptions: SemiSubscriptions) {
  return Object.values(subscriptions).toSorted((left, right) => left.title.localeCompare(right.title));
}
