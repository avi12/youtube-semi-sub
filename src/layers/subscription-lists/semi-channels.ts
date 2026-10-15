import type { PageState } from "@/lib/messaging/page-messaging";
import type { ChannelInfo } from "@/lib/schemas/channel";
import type { SemiSubscription } from "@/lib/schemas/semi-subscription";
import { getChannelUrl } from "#popup";

const CHANNEL_PAGE_TYPE = "WEB_PAGE_TYPE_CHANNEL";
const CHANNEL_ROOT_VISUAL_ELEMENT = 3611;
const BROWSE_API_URL = "/youtubei/v1/browse";

/** What every list shows: nothing while the extension is off, otherwise A-Z like YouTube's own sort */
export function listSemiSubscriptions(state: PageState | null) {
  const isListed = state?.isExtensionEnabled === true;
  if (!state || !isListed) {
    return [];
  }

  return Object.values(state.subscriptions).toSorted((left, right) => left.title.localeCompare(right.title));
}

export function getChannelPath(channel: Pick<ChannelInfo, "channelId" | "handle">) {
  return new URL(getChannelUrl(channel)).pathname;
}

/** The endpoint YouTube's router follows to open a channel, shaped like the ones in its own responses */
export function buildChannelEndpoint(channel: Pick<ChannelInfo, "channelId" | "handle">) {
  const url = getChannelPath(channel);
  return {
    commandMetadata: {
      webCommandMetadata: {
        url,
        webPageType: CHANNEL_PAGE_TYPE,
        rootVe: CHANNEL_ROOT_VISUAL_ELEMENT,
        apiUrl: BROWSE_API_URL
      }
    },
    browseEndpoint: {
      browseId: channel.channelId,
      canonicalBaseUrl: url
    }
  };
}

export function toChannelInfo({ channelId, title, handle, avatarUrl }: SemiSubscription) {
  const channel: ChannelInfo = {
    channelId,
    title,
    handle,
    avatarUrl
  };
  return channel;
}
