import {
  isAllowListRestricting,
  isFilterInert,
  isLengthFiltered,
  legacyRegexFilterSchema,
  titleFilterSchema,
  type VideoFilter,
  videoFilterSchema
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
  /** Picks the videos added to the feed while the user isn't subscribed; null until one is saved in that mode */
  followFilter: videoFilterSchema.nullable(),
  /** Picks the videos hidden from the feed while the user is subscribed; null until one is saved in that mode */
  hideFilter: videoFilterSchema.nullable(),
  /** Subscribed on YouTube, which switches the channel to hiding. Both filters are kept either way */
  isSubscribed: z.boolean(),
  /** A member of the channel, so following adds its members-only videos too - absent until the user says so */
  isMember: z.boolean().optional()
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
 * new hide filter starts unset - so a subscribed channel hides nothing, as a halted one let nothing through
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
      hideFilter: null,
      isSubscribed: isHalted
    };
  }
  return migrated;
}

const FILTER_KEY_BY_MODE = {
  [SubscriptionMode.follow]: "followFilter",
  [SubscriptionMode.hide]: "hideFilter"
} as const satisfies Record<SubscriptionMode, keyof SemiSubscription>;

export function getSubscriptionMode({ isSubscribed }: Pick<SemiSubscription, "isSubscribed">) {
  return isSubscribed ? SubscriptionMode.hide : SubscriptionMode.follow;
}

export function getModeFilter({ subscription, mode }: {
  subscription: Pick<SemiSubscription, "followFilter" | "hideFilter">;
  mode: SubscriptionMode;
}) {
  return subscription[FILTER_KEY_BY_MODE[mode]];
}

/** The filter the channel's current mode applies */
export function getActiveFilter(subscription: Pick<SemiSubscription, "followFilter" | "hideFilter" | "isSubscribed">) {
  return getModeFilter({
    subscription,
    mode: getSubscriptionMode(subscription)
  });
}

/**
 * Whether the background keeps the channel's uploads current: while its current mode's filter adds or hides
 * something - the uploads are what it is judged against, Shorts included
 */
export function isUploadsWatched(subscription: Pick<SemiSubscription, "followFilter" | "hideFilter" | "isSubscribed">) {
  const isActiveFilterWorking = !isFilterInert({
    filter: getActiveFilter(subscription),
    mode: getSubscriptionMode(subscription)
  });
  return isActiveFilterWorking || isAllowListHiding(subscription);
}

/** A subscribed channel whose Allow list keeps filtering it - the follow filter hides what it doesn't let through */
export function isAllowListHiding({ isSubscribed, followFilter }: Pick<SemiSubscription, "followFilter" | "isSubscribed">) {
  return isSubscribed && isAllowListRestricting(followFilter);
}

/** Every filter that judges a channel's videos: the current mode's, and the Allow list while it keeps filtering */
export function getJudgingFilters(subscription: Pick<SemiSubscription, "followFilter" | "hideFilter" | "isSubscribed">) {
  const filters = [getActiveFilter(subscription)];
  if (isAllowListHiding(subscription)) {
    filters.push(subscription.followFilter);
  }

  return filters.filter(filter => filter !== null);
}

/** Whether a filter judging the channel reads lengths, so its uploads need them looked up */
export function isUploadsLengthFiltered(subscription: Pick<SemiSubscription, "followFilter" | "hideFilter" | "isSubscribed">) {
  return getJudgingFilters(subscription).some(isLengthFiltered);
}

/**
 * Whether the channel's uploads need what only its Videos tab tells: lengths for a filter that reads them, and for a
 * followed channel which videos are members-only, since following never adds one for a non-member
 */
export function isVideosTabRead(subscription: Pick<SemiSubscription, "followFilter" | "hideFilter" | "isSubscribed">) {
  return !subscription.isSubscribed || isUploadsLengthFiltered(subscription);
}

/** The subscription with one mode's filter replaced */
export function withModeFilter({ subscription, mode, filter }: {
  subscription: SemiSubscription;
  mode: SubscriptionMode;
  filter: VideoFilter;
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
