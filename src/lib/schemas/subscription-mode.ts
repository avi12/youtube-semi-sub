/** How a semi-subscription treats its channel, decided by whether the user is subscribed to it on YouTube */
export enum SubscriptionMode {
  /** "Follow without subscribing": the follow filter picks the channel's videos to add to the feed */
  follow = "follow",
  /** "Subscribe with a filter": the hide filter picks the channel's videos to hide from the feed */
  hide = "hide"
}

/** Each mode's name, wherever the UI says which one applies */
export const SUBSCRIPTION_MODE_NAME = {
  [SubscriptionMode.follow]: "Follow without subscribing",
  [SubscriptionMode.hide]: "Subscribe with a filter"
} as const satisfies Record<SubscriptionMode, string>;
