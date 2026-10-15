import { PageMessage, pageMessenger } from "@/lib/messaging/page-messaging";
import type { SemiSubscription } from "@/lib/schemas/semi-subscription";
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

export function getManageLabel({ title }: SemiSubscription) {
  return `Edit semi-subscription to ${title}`;
}
