import { downloadLiteRtModel, getLiteRtDownloadFraction, inferWithLiteRt } from "#ai-match/engine/litert/litert-host";
import { MessageType, onMessage } from "@/lib/messaging/extension-messaging";
import { parseRssFeed } from "@/lib/youtube/rss-feed";

// Chromium's offscreen page: hosts the LiteRT-LM download and engine for the service worker (cancel and delete are the
// worker closing this page), and parses RSS feeds with the DOMParser the worker lacks

onMessage(MessageType.OFFSCREEN_AI_DOWNLOAD, () => downloadLiteRtModel());
onMessage(MessageType.OFFSCREEN_AI_DOWNLOAD_FRACTION, () => getLiteRtDownloadFraction());
onMessage(MessageType.OFFSCREEN_AI_INFER, ({ messages }) => inferWithLiteRt(messages));
onMessage(MessageType.OFFSCREEN_PARSE_RSS, ({ xml }) => parseRssFeed(xml));
