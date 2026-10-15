import {
  channelVideosItem,
  isAnimationsEnabledItem,
  isExtensionEnabledItem,
  semiSubscriptionsItem
} from "@/lib/storage";

/** Read before mounting so the popup opens on stored state instead of flashing the empty state */
export async function loadPopupState() {
  const [subscriptions, channelVideos, isExtensionEnabled, isAnimationsEnabled] = await Promise.all([
    semiSubscriptionsItem.getValue(),
    channelVideosItem.getValue(),
    isExtensionEnabledItem.getValue(),
    isAnimationsEnabledItem.getValue()
  ]);
  return {
    subscriptions,
    channelVideos,
    isExtensionEnabled,
    isAnimationsEnabled
  };
}

export type PopupState = Awaited<ReturnType<typeof loadPopupState>>;
