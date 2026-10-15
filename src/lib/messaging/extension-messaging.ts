import type { FeedVideo } from "@/lib/feed-video";
import { defineExtensionMessaging } from "@webext-core/messaging";

export enum MessageType {
  refreshChannel = "refresh-channel",
  refreshAllChannels = "refresh-all-channels"
}

interface ProtocolMap {
  /** Content script/popup -> background: fetch, cache and return a channel's latest uploads (unfiltered) */
  [MessageType.refreshChannel](data: { channelId: string }): FeedVideo[];
  /** Popup -> background: refetch every semi-subscribed channel now */
  [MessageType.refreshAllChannels](): void;
}

export const { onMessage, sendMessage } = defineExtensionMessaging<ProtocolMap>();
