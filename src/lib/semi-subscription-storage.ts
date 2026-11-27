import type { VideoFilter } from "@/lib/filter/schema/video-filter-schema";
import type { ChannelInfo } from "@/lib/schemas/channel";
import { type SemiSubscription, type SemiSubscriptions, withModeFilter } from "@/lib/schemas/semi-subscription";
import { SubscriptionMode } from "@/lib/schemas/subscription-mode";
import { mutateStorageItem, semiSubscriptionsItem } from "@/lib/storage";

// Every write to the semi-subscriptions goes through here, so each kind of change is made one way everywhere

export async function readSemiSubscription(channelId: string) {
  const subscriptions = await semiSubscriptionsItem.getValue();
  return subscriptions[channelId] ?? null;
}

/** The optional fields a save keeps from what was stored when the page that opened it doesn't say */
function readCarriedFields({
  previous,
  channel,
  isMember
}: Pick<Parameters<typeof mergeSemiSubscription>[0], "previous" | "channel" | "isMember">) {
  const handle = channel.handle ?? previous?.handle;
  const avatarUrl = channel.avatarUrl ?? previous?.avatarUrl;
  const isMemberSet = isMember ?? previous?.isMember;
  return {
    ...(handle && {
      handle
    }),
    ...(avatarUrl && {
      avatarUrl
    }),
    ...(isMemberSet && {
      isMember: isMemberSet
    })
  };
}

/**
 * The stored entry after a save of one mode's filter: `createdAt`, the subscription state and the other mode's filter
 * survive an edit, and a channel opened from a page that lacks its avatar or handle keeps the ones stored before - as
 * does the membership, unless the save sets it. A new entry starts subscribed when it is saved in hide mode, with the
 * other mode's filter unset (`isFilterInert`)
 */
export function mergeSemiSubscription({
  previous,
  channel,
  mode,
  filter,
  isMember,
  now
}: Partial<Pick<SemiSubscription, "isMember">> & {
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
    isSubscribed: previous?.isSubscribed ?? mode === SubscriptionMode.HIDE,
    ...readCarriedFields({
      previous,
      channel,
      isMember
    })
  };
  return withModeFilter({
    subscription: base,
    mode,
    filter
  });
}

export function saveSemiSubscription({
  channel,
  mode,
  filter,
  isMember
}: Pick<Parameters<typeof mergeSemiSubscription>[0], "channel" | "mode" | "filter" | "isMember">) {
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
          isMember,
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
      const { [channelId]: removed, ...rest } = subscriptions;
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

/**
 * Replaces one mode's filter of a channel that is still semi-subscribed, and whether the user is its member; a removed
 * one stays removed
 */
export function setSemiSubscriptionFilter({
  channelId,
  mode,
  filter,
  isMember
}: Pick<SemiSubscription, "channelId"> &
  Pick<Parameters<typeof mergeSemiSubscription>[0], "mode" | "filter" | "isMember">) {
  return mutateStorageItem({
    item: semiSubscriptionsItem,
    mutator(subscriptions) {
      const current = subscriptions[channelId];
      if (!current) {
        return subscriptions;
      }

      const { isMember: previousMembership, ...rest } = withModeFilter({
        subscription: current,
        mode,
        filter
      });
      const isMemberSet = isMember ?? current.isMember;
      return {
        ...subscriptions,
        [channelId]: isMemberSet
          ? {
              ...rest,
              isMember: isMemberSet
            }
          : rest
      };
    }
  });
}

/**
 * Switches a semi-subscription to hiding while the user is subscribed to its channel on YouTube, and back to following
 * once they unsubscribe. Both filters are kept either way; a channel that isn't semi-subscribed is left alone
 */
export function applyOfficialSubscription({
  subscriptions,
  channelId,
  isSubscribed
}: Pick<SemiSubscription, "channelId" | "isSubscribed"> & {
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

export function setSemiSubscriptionSubscribed({
  channelId,
  isSubscribed
}: Pick<SemiSubscription, "channelId" | "isSubscribed">) {
  return mutateStorageItem({
    item: semiSubscriptionsItem,
    mutator: subscriptions =>
      applyOfficialSubscription({
        subscriptions,
        channelId,
        isSubscribed
      })
  });
}
