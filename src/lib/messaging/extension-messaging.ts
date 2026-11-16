import { defineExtensionMessaging, type ProtocolWithReturn } from "@webext-core/messaging";

import { aiStatusSchema, downloadFractionSchema, modelDownloadChangeSchema } from "@/lib/ai/ai-status";
import { chatMessageSchema } from "@/lib/ai/chat-message";
import { aiFilterSchema } from "@/lib/filter/title-filter";
import { defineValidatedMessaging } from "@/lib/messaging/validated-messaging";
import { channelIdSchema } from "@/lib/schemas/channel";
import { feedVideoSchema, MAX_CACHED_VIDEOS_PER_CHANNEL } from "@/lib/schemas/feed-video";
import { z } from "@/lib/zod";

export enum MessageType {
  REFRESH_CHANNEL = "refresh-channel",
  REFRESH_ALL_CHANNELS = "refresh-all-channels",
  REFRESH_STALE_CHANNELS = "refresh-stale-channels",
  GET_AI_STATUS = "get-ai-status",
  CLASSIFY_VIDEOS = "classify-videos",
  DOWNLOAD_AI_MODEL = "download-ai-model",
  OPEN_AI_SETTINGS = "open-ai-settings",
  AI_MODEL_DOWNLOAD_CHANGED = "ai-model-download-changed",
  OFFSCREEN_AI_DOWNLOAD = "offscreen-ai-download",
  OFFSCREEN_AI_DOWNLOAD_FRACTION = "offscreen-ai-download-fraction",
  OFFSCREEN_AI_INFER = "offscreen-ai-infer",
  OFFSCREEN_PARSE_RSS = "offscreen-parse-rss"
}

const NO_PAYLOAD = z.undefined();
const NO_REPLY = z.void();

/** The editor's ask: judge these videos (at most a channel's cached uploads) against this filter */
const classifyRequestSchema = z.object({
  filter: aiFilterSchema,
  videos: z.array(feedVideoSchema).max(MAX_CACHED_VIDEOS_PER_CHANNEL)
});
export type ClassifyRequest = z.infer<typeof classifyRequestSchema>;

/** Every message's payload and reply: the one source of their types, checked on both ends */
const MESSAGE_SCHEMAS = {
  /**
   * Content script/popup -> background: fetch a channel's latest uploads now and return them (unfiltered). Cached only
   * when the channel is semi-subscribed, so the dialog can preview a channel first. Rejects when they can't be loaded
   */
  [MessageType.REFRESH_CHANNEL]: {
    request: z.object({ channelId: channelIdSchema }),
    reply: z.array(feedVideoSchema)
  },
  /** Popup -> background: refetch every semi-subscribed channel now; rejects when none could be fetched */
  [MessageType.REFRESH_ALL_CHANNELS]: {
    request: NO_PAYLOAD,
    reply: NO_REPLY
  },
  /** Content script -> background: refetch the semi-subscribed channels that weren't fetched in the last few minutes */
  [MessageType.REFRESH_STALE_CHANNELS]: {
    request: NO_PAYLOAD,
    reply: NO_REPLY
  },
  /** Popup/content script -> background: which AI engine this browser uses, and whether its model is ready */
  [MessageType.GET_AI_STATUS]: {
    request: NO_PAYLOAD,
    reply: aiStatusSchema
  },
  /**
   * Popup/content script -> background: judge these videos against an AI filter (the editor's preview, possibly of a
   * channel not semi-subscribed yet). Resolves at once; verdicts land in `aiVerdictsItem` as they come
   */
  [MessageType.CLASSIFY_VIDEOS]: {
    request: classifyRequestSchema,
    reply: NO_REPLY
  },
  /**
   * Popup -> background: download the local LiteRT-LM model (the user just opted in). Resolves once the download
   * ended, to whether the model is on disk; progress arrives as `aiModelDownloadChanged`
   */
  [MessageType.DOWNLOAD_AI_MODEL]: {
    request: NO_PAYLOAD,
    reply: z.boolean()
  },
  /**
   * Content script -> background: the in-page dialog's way to AI match setup - the popup, where the download and
   * its size are explained (opened as a tab where the browser won't open the popup without a click on it)
   */
  [MessageType.OPEN_AI_SETTINGS]: {
    request: NO_PAYLOAD,
    reply: NO_REPLY
  },
  /** Downloading page (Firefox's background, Chromium's offscreen page) -> extension pages: progress, then null */
  [MessageType.AI_MODEL_DOWNLOAD_CHANGED]: {
    request: modelDownloadChangeSchema,
    reply: NO_REPLY
  },
  /** Chromium background -> offscreen page: download the model there, out of the service worker's short lifetime */
  [MessageType.OFFSCREEN_AI_DOWNLOAD]: {
    request: NO_PAYLOAD,
    reply: z.boolean()
  },
  /** Chromium background -> offscreen page: the running download's progress, null when none runs */
  [MessageType.OFFSCREEN_AI_DOWNLOAD_FRACTION]: {
    request: NO_PAYLOAD,
    reply: downloadFractionSchema.nullable()
  },
  /** Chromium background -> offscreen page: one LiteRT-LM chat turn; null when the model can't run */
  [MessageType.OFFSCREEN_AI_INFER]: {
    request: z.object({ messages: z.array(chatMessageSchema).min(1) }),
    reply: z.string().nullable()
  },
  /** Chromium background -> offscreen page: parse a channel's upload feed (the service worker has no DOMParser) */
  [MessageType.OFFSCREEN_PARSE_RSS]: {
    request: z.object({ xml: z.string() }),
    reply: z.array(feedVideoSchema).nullable()
  }
};

export const { onMessage, sendMessage } = defineValidatedMessaging({
  schemas: MESSAGE_SCHEMAS,
  messenger: defineExtensionMessaging<Record<MessageType, ProtocolWithReturn<unknown, unknown>>>()
});
