import type { TitleFilter } from "@/lib/filter/title-filter";
import type { ChannelInfo } from "@/lib/schemas/channel";
import type { SemiSubscription } from "@/lib/schemas/semi-subscription";
import { mutateStorageItem, semiSubscriptionsItem } from "@/lib/storage";

// Every write to the semi-subscriptions goes through here, so each kind of change is made one way everywhere

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

export function saveSemiSubscription({ channel, filter }: Pick<
  Parameters<typeof mergeSemiSubscription>[0],
  "channel" | "filter"
>) {
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

export function removeSemiSubscription(channelId: string) {
  return mutateStorageItem({
    item: semiSubscriptionsItem,
    mutator(subscriptions) {
      const { [channelId]: _removed, ...rest } = subscriptions;
      return rest;
    }
  });
}

/** Puts back a removed semi-subscription exactly as it was (the popup's undo) */
export function restoreSemiSubscription(subscription: SemiSubscription) {
  return mutateStorageItem({
    item: semiSubscriptionsItem,
    mutator: subscriptions => ({
      ...subscriptions,
      [subscription.channelId]: subscription
    })
  });
}

/** Replaces the filter of a channel that is still semi-subscribed; a removed one stays removed */
export function setSemiSubscriptionFilter({ channelId, filter }: Pick<SemiSubscription, "channelId" | "filter">) {
  return mutateStorageItem({
    item: semiSubscriptionsItem,
    mutator(subscriptions) {
      const current = subscriptions[channelId];
      if (!current) {
        return subscriptions;
      }

      return {
        ...subscriptions,
        [channelId]: {
          ...current,
          filter
        }
      };
    }
  });
}
