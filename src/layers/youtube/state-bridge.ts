import { videosByChannelFromCache } from "@/lib/feed-video";
import { MessageType, sendMessage } from "@/lib/messaging/extension-messaging";
import {
  officialSubscriptionChangeSchema,
  PageMessage,
  pageMessenger,
  type PageState
} from "@/lib/messaging/page-messaging";
import { prefersReducedMotion } from "@/lib/motion";
import {
  channelVideosItem,
  isAnimationsEnabledItem,
  isExtensionEnabledItem,
  mutateStorageItem,
  semiSubscriptionsItem
} from "@/lib/storage";
import { selectFeedVideos } from "@/lib/title-filter";
import type { ContentScriptContext } from "#imports";

// ISOLATED world: the only page-side context with storage access. It owns the state the MAIN world mirrors

let currentState: PageState | null = null;

async function readPageState() {
  const [isExtensionEnabled, isAnimationsEnabled, subscriptions, channelVideos] = await Promise.all([
    isExtensionEnabledItem.getValue(),
    isAnimationsEnabledItem.getValue(),
    semiSubscriptionsItem.getValue(),
    channelVideosItem.getValue()
  ]);
  const state: PageState = {
    isExtensionEnabled,
    isAnimationsEnabled: isAnimationsEnabled && !prefersReducedMotion(),
    subscriptions,
    feedVideos: selectFeedVideos({
      subscriptions,
      videosByChannel: videosByChannelFromCache(channelVideos)
    })
  };
  return state;
}

async function broadcastPageState() {
  currentState = await readPageState();
  await pageMessenger.sendMessage(PageMessage.pageStateChanged, currentState);
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

export function startStateBridge(context: ContentScriptContext) {
  pageMessenger.onMessage(PageMessage.getPageState, () => currentState);
  pageMessenger.onMessage(PageMessage.officialSubscriptionChanged, async ({ data }) => {
    const parsed = officialSubscriptionChangeSchema.safeParse(data);
    const isNowOfficiallySubscribed = parsed.success && parsed.data.isSubscribed;
    if (!isNowOfficiallySubscribed) {
      return;
    }

    // A full subscription supersedes the semi one
    await removeSemiSubscription(parsed.data.channelId);
  });

  function handleStorageChange() {
    broadcastPageState().catch(() => {});
  }

  const unwatchers = [
    isExtensionEnabledItem.watch(handleStorageChange),
    isAnimationsEnabledItem.watch(handleStorageChange),
    semiSubscriptionsItem.watch(handleStorageChange),
    channelVideosItem.watch(handleStorageChange)
  ];
  context.onInvalidated(() => {
    for (const unwatch of unwatchers) {
      unwatch();
    }
  });

  handleStorageChange();
  sendMessage(MessageType.refreshStaleChannels).catch(() => {});
}
