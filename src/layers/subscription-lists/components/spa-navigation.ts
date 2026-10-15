import type { SemiSubscription } from "@/lib/schemas/semi-subscription";
import { buildListedChannelEndpoint } from "#subscription-lists/semi-channels";
import { on } from "svelte/events";

const NAVIGATE_EVENT = "yt-navigate";
const PRIMARY_BUTTON = 0;

/**
 * Attachment for a www.youtube.com channel link: a plain click goes through YouTube's own router, which ytd-app runs
 * for `yt-navigate` events bubbling up from inside it. Modified and middle clicks stay ordinary links
 */
export function followsChannelLink(subscription: SemiSubscription) {
  return function attach(elLink: HTMLElement) {
    return on(elLink, "click", e => {
      const isPlainClick = e.button === PRIMARY_BUTTON && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
      if (!isPlainClick) {
        return;
      }

      e.preventDefault();
      elLink.dispatchEvent(
        new CustomEvent(NAVIGATE_EVENT, {
          bubbles: true,
          composed: true,
          detail: {
            endpoint: buildListedChannelEndpoint(subscription)
          }
        })
      );
    });
  };
}
