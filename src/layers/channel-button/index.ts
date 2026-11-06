/** MAIN world, document_start: detect successful official Subscribe/Unsubscribe presses */
export { applySubscriptionSnapshot, installSubscriptionWatch } from "./official-subscription";

/** MAIN world: whether the user is subscribed to any channel on YouTube, as far as this tab's data tells */
export { readOfficialSubscription } from "./official-subscription";

/** MAIN world, document_start: switch semi-subscriptions between modes by the subscription state in YouTube's data */
export { installSubscriptionEntityWatch } from "./subscription-entities";

/** MAIN world, document_start: inject the channel button (Semi-subscribe / Filter) beside YouTube's Subscribe */
export { startChannelButton } from "./channel-button.svelte";

/** The words on a channel's button, for every surface that opens its dialog */
export { describeChannelButton } from "./button/button-label";
