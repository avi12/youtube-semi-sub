/** How a semi-subscription treats its channel, decided by whether the user is subscribed to it on YouTube */
export enum SubscriptionMode {
  /** "Follow without subscribing": the follow filter picks the channel's videos to add to the feed */
  FOLLOW = "follow",
  /** "Subscribe with a filter": the hide filter picks the channel's videos to hide from the feed */
  HIDE = "hide"
}

/** Each mode's name, wherever the UI says which one applies */
export const SUBSCRIPTION_MODE_NAME = {
  [SubscriptionMode.FOLLOW]: "Follow without subscribing",
  [SubscriptionMode.HIDE]: "Subscribe with a filter"
} as const satisfies Record<SubscriptionMode, string>;

/** Each mode's words for a filter that leaves the feed alone (`isFilterInert`), wherever a filter is summed up */
export const INERT_FILTER_LABEL = {
  [SubscriptionMode.FOLLOW]: "Nothing added",
  [SubscriptionMode.HIDE]: "Nothing hidden"
} as const satisfies Record<SubscriptionMode, string>;

/** An empty follow pattern, which lets every video through */
export const ANY_TITLE_LABEL = "Any title";
