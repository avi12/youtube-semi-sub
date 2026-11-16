import { MessageType, sendMessage } from "@/lib/messaging/extension-messaging";
import { sendToOffscreenDocument } from "@/lib/offscreen/offscreen-document";
import { parseRssFeed } from "@/lib/youtube/rss-feed";
import { YOUTUBE_ORIGIN } from "@/lib/youtube/site";

import { fetchText } from "./fetch-text";

const RSS_FEED_PATH = "/feeds/videos.xml";
const RSS_CHANNEL_ID_PARAM = "channel_id";

/** Chromium's service worker has no `DOMParser`: its offscreen page parses there, anywhere else it is parsed here */
async function parseUploadsFeed(xml: string) {
  if (typeof DOMParser !== "undefined") {
    return parseRssFeed(xml);
  }

  return await sendToOffscreenDocument(() => sendMessage(MessageType.OFFSCREEN_PARSE_RSS, { xml })).catch(() => null);
}

/** The channel's latest uploads (newest first, up to 15) from its RSS feed, or null when the feed is unavailable */
export async function fetchRssUploads(channelId: string) {
  const url = new URL(RSS_FEED_PATH, YOUTUBE_ORIGIN);
  url.searchParams.set(RSS_CHANNEL_ID_PARAM, channelId);
  const xml = await fetchText({
    url,
    credentials: "omit"
  });
  if (xml === null) {
    return null;
  }

  return await parseUploadsFeed(xml);
}
