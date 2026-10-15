import { selectFeedVideos } from "@/lib/filter/title-filter";
import { MessageType, sendMessage } from "@/lib/messaging/extension-messaging";
import {
  officialSubscriptionChangeSchema,
  PageMessage,
  pageMessenger,
  type PageState,
  semiUnsubscribeRequestSchema
} from "@/lib/messaging/page-messaging";
import { videosByChannelFromCache } from "@/lib/schemas/feed-video";
import { removeSemiSubscription, setSemiSubscriptionHalted } from "@/lib/semi-subscription-storage";
import {
  aiVerdictsItem,
  channelVideosItem,
  isAiEnabledItem,
  isAnimationsEnabledItem,
  isExtensionEnabledItem,
  readStoredState,
  semiSubscriptionsItem
} from "@/lib/storage";
import { prefersReducedMotion } from "@/lib/utils/motion";
import type { ContentScriptContext } from "#imports";

// ISOLATED world: the only page-side context with storage access. It owns the state the MAIN world mirrors

let currentState: PageState | null = null;

async function readPageState() {
  const {
    isExtensionEnabled,
    isAnimationsEnabled,
    isAiEnabled,
    subscriptions,
    channelVideos,
    aiVerdicts
  } = await readStoredState();
  const state: PageState = {
    isExtensionEnabled,
    isAnimationsEnabled: isAnimationsEnabled && !prefersReducedMotion(),
    isAiEnabled,
    subscriptions,
    feedVideos: selectFeedVideos({
      subscriptions,
      videosByChannel: videosByChannelFromCache(channelVideos),
      aiVerdicts,
      isAiEnabled
    })
  };
  return state;
}

async function broadcastPageState() {
  currentState = await readPageState();
  await pageMessenger.sendMessage(PageMessage.pageStateChanged, currentState);
}

export function startStateBridge(context: ContentScriptContext) {
  pageMessenger.onMessage(PageMessage.getPageState, () => currentState);
  pageMessenger.onMessage(PageMessage.officialSubscriptionChanged, async ({ data }) => {
    const parsed = officialSubscriptionChangeSchema.safeParse(data);
    if (!parsed.success) {
      return;
    }

    // A full subscription halts the semi one; unsubscribing resumes it
    await setSemiSubscriptionHalted({
      channelId: parsed.data.channelId,
      isHalted: parsed.data.isSubscribed
    });
  });
  pageMessenger.onMessage(PageMessage.semiUnsubscribe, async ({ data }) => {
    const parsed = semiUnsubscribeRequestSchema.safeParse(data);
    if (!parsed.success) {
      return;
    }

    await removeSemiSubscription(parsed.data.channelId);
  });

  function handleStorageChange() {
    broadcastPageState().catch(() => {});
  }

  const unwatchers = [
    isExtensionEnabledItem.watch(handleStorageChange),
    isAnimationsEnabledItem.watch(handleStorageChange),
    isAiEnabledItem.watch(handleStorageChange),
    semiSubscriptionsItem.watch(handleStorageChange),
    channelVideosItem.watch(handleStorageChange),
    aiVerdictsItem.watch(handleStorageChange)
  ];
  context.onInvalidated(() => {
    for (const unwatch of unwatchers) {
      unwatch();
    }
  });

  handleStorageChange();
  sendMessage(MessageType.refreshStaleChannels).catch(() => {});
}
