/** MAIN world, document_start: detect successful official Subscribe/Unsubscribe presses */
export { applySubscriptionSnapshot, installSubscriptionWatch } from "./official-subscription";

/** MAIN world, document_start: halt or resume semi-subscriptions from the subscription state in YouTube's raw data */
export { installSubscriptionEntityWatch } from "./subscription-entities";

/** MAIN world, document_start: inject the Semi-subscribe button next to YouTube's Subscribe button */
export { startChannelButton } from "./channel-button.svelte";
