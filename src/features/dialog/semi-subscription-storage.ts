import type { ChannelInfo } from "@/lib/channel";
import type { SemiSubscription } from "@/lib/semi-subscription";
import { mutateStorageItem, semiSubscriptionsItem } from "@/lib/storage";
import type { TitleFilter } from "@/lib/title-filter";

export async function readSemiSubscription(channelId: string) {
  const subscriptions = await semiSubscriptionsItem.getValue();
  return subscriptions[channelId] ?? null;
}

/**
 * The stored entry after a save: `createdAt` survives an edit, and a channel opened from a page that lacks its avatar
 * or handle keeps the ones stored before
 */
export function mergeSemiSubscription({ previous, channel, filter, now }: {
  previous: SemiSubscription | undefined;
  channel: ChannelInfo;
  filter: TitleFilter;
  now: number;
}) {
  const subscription: SemiSubscription = {
    channelId: channel.channelId,
    title: channel.title || previous?.title || "",
    filter,
    createdAt: previous?.createdAt ?? now
  };
  const handle = channel.handle ?? previous?.handle;
  if (handle) {
    subscription.handle = handle;
  }

  const avatarUrl = channel.avatarUrl ?? previous?.avatarUrl;
  if (avatarUrl) {
    subscription.avatarUrl = avatarUrl;
  }

  return subscription;
}

export function saveSemiSubscription({ channel, filter }: {
  channel: ChannelInfo;
  filter: TitleFilter;
}) {
  return mutateStorageItem({
    item: semiSubscriptionsItem,
    mutator(subscriptions) {
      return {
        ...subscriptions,
        [channel.channelId]: mergeSemiSubscription({
          previous: subscriptions[channel.channelId],
          channel,
          filter,
          now: Date.now()
        })
      };
    }
  });
}
