import type { AiStatus } from "@/lib/ai/ai-status";
import type { AiFilter } from "@/lib/filter/title-filter";
import type { FeedVideo } from "@/lib/schemas/feed-video";
import { defineExtensionMessaging } from "@webext-core/messaging";

export enum MessageType {
  refreshChannel = "refresh-channel",
  refreshAllChannels = "refresh-all-channels",
  refreshStaleChannels = "refresh-stale-channels",
  getAiStatus = "get-ai-status",
  classifyVideos = "classify-videos"
}

interface ProtocolMap {
  /**
   * Content script/popup -> background: fetch a channel's latest uploads now and return them (unfiltered). Cached only
   * when the channel is semi-subscribed, so the dialog can preview a channel first. Rejects when they can't be loaded
   */
  [MessageType.refreshChannel](data: { channelId: string }): FeedVideo[];
  /** Popup -> background: refetch every semi-subscribed channel now; rejects when none could be fetched */
  [MessageType.refreshAllChannels](): void;
  /** Content script -> background: refetch the semi-subscribed channels that weren't fetched in the last few minutes */
  [MessageType.refreshStaleChannels](): void;
  /** Popup/content script -> background: which AI engine this browser uses, and whether its model is ready */
  [MessageType.getAiStatus](): AiStatus;
  /**
   * Popup/content script -> background: judge these videos against an AI filter (the editor's preview, possibly of a
   * channel not semi-subscribed yet). Resolves at once; verdicts land in `aiVerdictsItem` as they come
   */
  [MessageType.classifyVideos](data: {
    filter: AiFilter;
    videos: FeedVideo[];
  }): void;
}

export const { onMessage, sendMessage } = defineExtensionMessaging<ProtocolMap>();
