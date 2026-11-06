import type { VideoFilter } from "@/lib/filter/title-filter";
import type { ChannelInfo } from "@/lib/schemas/channel";
import { type SemiSubscription, type SemiSubscriptions, withModeFilter } from "@/lib/schemas/semi-subscription";
import { SubscriptionMode } from "@/lib/schemas/subscription-mode";
import { mutateStorageItem, semiSubscriptionsItem } from "@/lib/storage";

// Every write to the semi-subscriptions goes through here, so each kind of change is made one way everywhere

export async function readSemiSubscription(channelId: string) {
  const subscriptions = await semiSubscriptionsItem.getValue();
  return subscriptions[channelId] ?? null;
}

/**
 * The stored entry after a save of one mode's filter: `createdAt`, the subscription state and the other mode's filter
 * survive an edit, and a channel opened from a page that lacks its avatar or handle keeps the ones stored before. A
 * new entry starts subscribed when it is saved in hide mode, with the other mode's filter unset (`isFilterInert`)
 */
export function mergeSemiSubscription({ previous, channel, mode, filter, now }: {
  previous: SemiSubscription | undefined;
  channel: ChannelInfo;
  mode: SubscriptionMode;
  filter: VideoFilter;
  now: number;
}) {
  const base: SemiSubscription = {
    channelId: channel.channelId,
    title: channel.title || previous?.title || "",
    followFilter: previous?.followFilter ?? null,
    hideFilter: previous?.hideFilter ?? null,
    createdAt: previous?.createdAt ?? now,
    isSubscribed: previous?.isSubscribed ?? mode === SubscriptionMode.hide
  };
  const subscription = withModeFilter({
    subscription: base,
    mode,
    filter
  });
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

export function saveSemiSubscription({ channel, mode, filter }: Pick<
  Parameters<typeof mergeSemiSubscription>[0],
  "channel" | "mode" | "filter"
>) {
  return mutateStorageItem({
    item: semiSubscriptionsItem,
    mutator(subscriptions) {
      return {
        ...subscriptions,
        [channel.channelId]: mergeSemiSubscription({
          previous: subscriptions[channel.channelId],
          channel,
          mode,
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

/** Replaces one mode's filter of a channel that is still semi-subscribed; a removed one stays removed */
export function setSemiSubscriptionFilter({ channelId, mode, filter }: Pick<SemiSubscription, "channelId"> & Pick<
  Parameters<typeof mergeSemiSubscription>[0],
  "mode" | "filter"
>) {
  return mutateStorageItem({
    item: semiSubscriptionsItem,
    mutator(subscriptions) {
      const current = subscriptions[channelId];
      if (!current) {
        return subscriptions;
      }

      return {
        ...subscriptions,
        [channelId]: withModeFilter({
          subscription: current,
          mode,
          filter
        })
      };
    }
  });
}

/**
 * Switches a semi-subscription to hiding while the user is subscribed to its channel on YouTube, and back to following
 * once they unsubscribe. Both filters are kept either way; a channel that isn't semi-subscribed is left alone
 */
export function applyOfficialSubscription({ subscriptions, channelId, isSubscribed }: Pick<
  SemiSubscription,
  "channelId" | "isSubscribed"
> & {
  subscriptions: SemiSubscriptions;
}) {
  const current = subscriptions[channelId];
  const isUnchanged = !current || current.isSubscribed === isSubscribed;
  if (isUnchanged) {
    return subscriptions;
  }

  return {
    ...subscriptions,
    [channelId]: {
      ...current,
      isSubscribed
    }
  };
}

export function setSemiSubscriptionSubscribed({ channelId, isSubscribed }: Pick<
  SemiSubscription,
  "channelId" | "isSubscribed"
>) {
  return mutateStorageItem({
    item: semiSubscriptionsItem,
    mutator: subscriptions => applyOfficialSubscription({
      subscriptions,
      channelId,
      isSubscribed
    })
  });
}
