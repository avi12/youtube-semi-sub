import type { PageState } from "@/lib/messaging/page-messaging";
import type { ChannelInfo } from "@/lib/schemas/channel";
import { listByTitle, type SemiSubscription } from "@/lib/schemas/semi-subscription";
import { getChannelUrl } from "@/lib/youtube/channel-link";
import { buildChannelEndpoint } from "@/lib/youtube/endpoints";

/** What every list shows: nothing while the extension is off, otherwise A-Z like YouTube's own sort */
export function listSemiSubscriptions(state: PageState | null) {
  const isListed = state?.isExtensionEnabled === true;
  if (!state || !isListed) {
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

export function toChannelInfo({ channelId, title, handle, avatarUrl }: SemiSubscription) {
  const channel: ChannelInfo = {
    channelId,
    title,
    handle,
    avatarUrl
  };
  return channel;
}
