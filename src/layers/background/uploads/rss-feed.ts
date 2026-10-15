import { fetchText } from "./fetch-text";
import { buildVideoThumbnailUrl } from "./video-thumbnail";
import { type FeedVideo, feedVideoSchema, VIDEO_DESCRIPTION_MAX_LENGTH } from "@/lib/schemas/feed-video";
import { z } from "@/lib/zod";
import { XMLParser } from "fast-xml-parser";

const RSS_FEED_URL = "https://www.youtube.com/feeds/videos.xml";
const RSS_CHANNEL_ID_PARAM = "channel_id";
const RSS_ENTRY_TAG = "entry";
const URL_PATTERN = /https?:\/\/\S+/g;
const WHITESPACE_RUN_PATTERN = /\s+/g;

// MV3 service workers have no DOMParser. Namespace prefixes are dropped (`yt:videoId` -> `videoId`), tag values stay
// strings (a title like "1984" must not become a number), and `entry` is always an array, even for a single upload
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  parseTagValue: false,
  htmlEntities: true,
  isArray: tagName => tagName === RSS_ENTRY_TAG
});

const rssFeedSchema = z.looseObject({
  feed: z.looseObject({
    entry: z.array(z.unknown()).optional()
  })
});

/**
 * The part of a description that says what the video is: links (sponsors, socials) dropped, whitespace collapsed, cut
 * to a bounded length on whole code points
 */
export function summarizeDescription(description: string) {
  const text = description.replaceAll(URL_PATTERN, " ").replaceAll(WHITESPACE_RUN_PATTERN, " ").trim();
  return Array.from(text).slice(0, VIDEO_DESCRIPTION_MAX_LENGTH).join("").trim();
}

const rssEntrySchema = z
  .looseObject({
    videoId: z.string(),
    channelId: z.string(),
    title: z.string(),
    published: z.string(),
    author: z.looseObject({
      name: z.string()
    }),
    group: z
      .looseObject({
        thumbnail: z
          .looseObject({
            url: z.url()
          })
          .optional()
          .catch(undefined),
        description: z.string().optional().catch(undefined)
      })
      .optional()
      .catch(undefined)
  })
  .transform(entry => {
    const description = summarizeDescription(entry.group?.description ?? "");
    return {
      videoId: entry.videoId,
      channelId: entry.channelId,
      channelTitle: entry.author.name,
      title: entry.title,
      publishedAt: Date.parse(entry.published),
      thumbnailUrl: entry.group?.thumbnail?.url ?? buildVideoThumbnailUrl(entry.videoId),
      ...description && {
        description
      }
    };
  })
  .pipe(feedVideoSchema);

function parseXml(xml: string) {
  try {
    const document: unknown = xmlParser.parse(xml);
    return document;
  } catch {
    return null;
  }
}

/** Reads a channel's Atom upload feed; null when the document is not a feed at all */
export function parseRssFeed(xml: string) {
  const parsed = rssFeedSchema.safeParse(parseXml(xml));
  if (!parsed.success) {
    return null;
  }

  const videos: FeedVideo[] = [];
  for (const entry of parsed.data.feed.entry ?? []) {
    const parsedEntry = rssEntrySchema.safeParse(entry);
    if (parsedEntry.success) {
      videos.push(parsedEntry.data);
    }
  }
  return videos;
}

/** The channel's latest uploads (newest first, up to 15) from its RSS feed, or null when the feed is unavailable */
export async function fetchRssUploads(channelId: string) {
  const url = new URL(RSS_FEED_URL);
  url.searchParams.set(RSS_CHANNEL_ID_PARAM, channelId);
  const xml = await fetchText({
    url,
    credentials: "omit"
  });
  if (xml === null) {
    return null;
  }

  return parseRssFeed(xml);
}
