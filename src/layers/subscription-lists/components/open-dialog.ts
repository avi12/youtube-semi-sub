import { PageMessage, pageMessenger } from "@/lib/messaging/page-messaging";
import { getSubscriptionMode, type SemiSubscription } from "@/lib/schemas/semi-subscription";
import { describeChannelButton } from "#channel-button";
import { toChannelInfo } from "#subscription-lists/semi-channels";
import { on } from "svelte/events";

function openSemiSubDialog(subscription: SemiSubscription) {
  pageMessenger.sendMessage(PageMessage.openSemiSubDialog, toChannelInfo(subscription)).catch(() => {});
}

/**
 * Attachment for a manage button: opens the ISOLATED-world dialog (edit the filter, remove the semi-subscription).
 * A listener on the button itself rather than Svelte's delegated `onclick`, which would only run once the click
 * reached the mount target - a YouTube element whose own click handlers (a guide entry navigates) run first
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
