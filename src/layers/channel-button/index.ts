/**
 * MAIN world, document_start: detect successful official Subscribe/Unsubscribe presses, and apply what server data
 * says about official subscriptions
 */
export { applySubscriptionSnapshot, installSubscriptionWatch } from "./official-subscription";

/** MAIN world, document_start: inject the Semi-subscribe button next to YouTube's Subscribe button */
export { startChannelButton } from "./channel-button.svelte";
