import { on } from "svelte/events";

import { describeChannelButton } from "#channel-button";
import { PageMessage, pageMessenger } from "@/lib/messaging/page-messaging";
import { channelInfoSchema } from "@/lib/schemas/channel";
import { getSubscriptionMode, type SemiSubscription } from "@/lib/schemas/semi-subscription";

/** Opens the ISOLATED-world dialog (edit the filter, remove the semi-subscription) */
export function openSemiSubDialog(subscription: SemiSubscription) {
  // The channel's details only: the dialog reads the filters from storage itself
  pageMessenger.sendMessage(PageMessage.OPEN_SEMI_SUB_DIALOG, channelInfoSchema.parse(subscription)).catch(() => {});
}

/**
 * Attachment for a manage button that opens the semi-subscribe dialog: a listener on the button itself rather than
 * Svelte's delegated `onclick`, which would only run once the click reached the mount target - a YouTube element whose
 * own click handlers (a guide entry navigates) run first
 */
export function opensSemiSubDialog(subscription: SemiSubscription) {
  return function attach(elButton: HTMLElement) {
    return on(elButton, "click", e => {
      e.preventDefault();
      e.stopPropagation();
      openSemiSubDialog(subscription);
    });
  };
}

/** What a manage button reads as, the same words the channel's own button would use */
export function describeManageButton(subscription: SemiSubscription) {
  return describeChannelButton({
    channelTitle: subscription.title,
    subscription,
    mode: getSubscriptionMode(subscription)
  });
}
