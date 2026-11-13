import { on } from "svelte/events";

import { buildListedChannelEndpoint } from "#subscription-lists/semi-channels";
import type { SemiSubscription } from "@/lib/schemas/semi-subscription";

const NAVIGATE_EVENT = "yt-navigate";
const PRIMARY_BUTTON = 0;

/**
 * Attachment for a www.youtube.com channel link: a plain click goes through YouTube's own router, which ytd-app runs
 * for `yt-navigate` events bubbling up from inside it. Modified and middle clicks stay ordinary links
 */
export function followsChannelLink(subscription: SemiSubscription) {
  return function attach(elLink: HTMLElement) {
    return on(elLink, "click", event => {
      const isPlainClick = event.button === PRIMARY_BUTTON && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
      if (!isPlainClick) {
        return;
      }

      event.preventDefault();
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
