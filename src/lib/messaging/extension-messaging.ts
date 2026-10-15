import type { AiStatus, ModelDownloadChange } from "@/lib/ai/ai-status";
import type { ChatMessage } from "@/lib/ai/chat-message";
import type { AiFilter } from "@/lib/filter/title-filter";
import type { FeedVideo } from "@/lib/schemas/feed-video";
import { defineExtensionMessaging } from "@webext-core/messaging";

export enum MessageType {
  refreshChannel = "refresh-channel",
  refreshAllChannels = "refresh-all-channels",
  refreshStaleChannels = "refresh-stale-channels",
  getAiStatus = "get-ai-status",
  classifyVideos = "classify-videos",
  downloadAiModel = "download-ai-model",
  openAiSettings = "open-ai-settings",
  aiModelDownloadChanged = "ai-model-download-changed",
  offscreenAiDownload = "offscreen-ai-download",
  offscreenAiDownloadFraction = "offscreen-ai-download-fraction",
  offscreenAiInfer = "offscreen-ai-infer"
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
  /**
   * Popup -> background: download the local LiteRT-LM model (the user just opted in). Resolves once the download
   * ended, to whether the model is on disk; progress arrives as `aiModelDownloadChanged`
   */
  [MessageType.downloadAiModel](): boolean;
  /**
   * Content script -> background: the in-page dialog's way to AI match setup - the popup, where the download and
   * its size are explained (opened as a tab where the browser won't open the popup without a click on it)
   */
  [MessageType.openAiSettings](): void;
  /** Downloading page (Firefox's background, Chromium's offscreen page) -> extension pages: progress, then null */
  [MessageType.aiModelDownloadChanged](data: ModelDownloadChange): void;
  /** Chromium background -> offscreen page: download the model there, out of the service worker's short lifetime */
  [MessageType.offscreenAiDownload](): boolean;
  /** Chromium background -> offscreen page: the running download's progress, null when none runs */
  [MessageType.offscreenAiDownloadFraction](): number | null;
  /** Chromium background -> offscreen page: one LiteRT-LM chat turn; null when the model can't run */
  [MessageType.offscreenAiInfer](data: { messages: ChatMessage[] }): string | null;
}

export const { onMessage, sendMessage } = defineExtensionMessaging<ProtocolMap>();
