import { PageMessage, pageMessenger } from "@/lib/messaging/page-messaging";
import { channelInfoSchema } from "@/lib/schemas/channel";
import { getSubscriptionMode, type SemiSubscription } from "@/lib/schemas/semi-subscription";
import { describeChannelButton } from "#channel-button";
import { on } from "svelte/events";

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
      // The channel's details only: the dialog reads the filters from storage itself
      pageMessenger.sendMessage(PageMessage.openSemiSubDialog, channelInfoSchema.parse(subscription)).catch(() => {});
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
