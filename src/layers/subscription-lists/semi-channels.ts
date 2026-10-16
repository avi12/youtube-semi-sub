import type { PageState } from "@/lib/messaging/page-messaging";
import type { ChannelInfo } from "@/lib/schemas/channel";
import { listByTitle, type SemiSubscription } from "@/lib/schemas/semi-subscription";
import { getChannelUrl } from "@/lib/youtube/channel-link";
import { buildChannelEndpoint } from "@/lib/youtube/endpoints";

/** The heading of every list of ours that stands apart from YouTube's own */
export const SEMI_LIST_TITLE = "Semi-subscriptions";

/** What every list shows: nothing while the extension is off, otherwise A-Z like YouTube's own sort */
export function listSemiSubscriptions(state: PageState | null) {
  if (!state?.isExtensionEnabled) {
    return [];
  }

  return listByTitle(state.subscriptions);
}

/**
 * The channels that get an entry of ours beside YouTube's own subscriptions (the sidebar guide, m's avatar strip): the
 * followed ones. A subscribed channel is already listed by YouTube itself
 */
export function listFollowedSubscriptions(subscriptions: readonly SemiSubscription[]) {
  return subscriptions.filter(subscription => !subscription.isSubscribed);
}

export function getChannelPath(channel: Pick<ChannelInfo, "channelId" | "handle">) {
  return new URL(getChannelUrl(channel)).pathname;
}

/** The endpoint YouTube's router follows to open a channel, at the same path the lists link to */
export function buildListedChannelEndpoint(channel: Pick<ChannelInfo, "channelId" | "handle">) {
  const url = getChannelPath(channel);
  return buildChannelEndpoint({
    channelId: channel.channelId,
    url,
    canonicalBaseUrl: url
  });
}
