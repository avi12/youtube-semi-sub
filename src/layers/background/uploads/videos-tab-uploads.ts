import { type FeedVideo, feedVideoSchema } from "@/lib/schemas/feed-video";
import { parseJson } from "@/lib/utils/json";
import { buildChannelPath } from "@/lib/youtube/channel-link";
import { findInitialDataJson } from "@/lib/youtube/initial-data";
import { isMembersOnlyClassicRenderer, isMembersOnlyLockup } from "@/lib/youtube/members-only";
import { parseFirstRelativeTime } from "@/lib/youtube/relative-time";
import { channelMetadataRendererSchema, tabbedColumnSchema } from "@/lib/youtube/schemas/browse";
import {
  type ClassicRenderer,
  gridItemSchema,
  type Lockup,
  LOCKUP_VIDEO_CONTENT_TYPE,
  RendererKind
} from "@/lib/youtube/schemas/renderers";
import { readText } from "@/lib/youtube/schemas/text";
import { YOUTUBE_ORIGIN } from "@/lib/youtube/site";
import { durationFromClassicRenderer, durationFromLockup } from "@/lib/youtube/video-duration";
import { buildVideoThumbnailUrl } from "@/lib/youtube/video-thumbnail";
import { z } from "@/lib/zod";

import { fetchText } from "./fetch-text";

// Fallback for when RSS is down: the channel's Videos tab. Its page embeds the InnerTube browse response as
// `ytInitialData`. A direct InnerTube POST is not an option - the browser stamps the extension's Origin on it and
// YouTube answers 403 - while a GET carries no Origin

/** The grid tabs of a channel that list its uploads the same way: regular videos, and live streams */
export enum ChannelGridTab {
  videos = "videos",
  streams = "streams"
}

const INTERFACE_LANGUAGE_PARAM = "hl";
// Relative publish times ("3 hours ago") are only parsed in English
const ENGLISH_INTERFACE_LANGUAGE = "en";

const channelBrowseResponseSchema = z.looseObject({
  contents: z.looseObject({
    twoColumnBrowseResultsRenderer: tabbedColumnSchema
  }),
  metadata: z.looseObject({
    channelMetadataRenderer: channelMetadataRendererSchema.pick({
      title: true,
      externalId: true
    })
  })
});
type ChannelBrowseResponse = z.infer<typeof channelBrowseResponseSchema>;

const gridUploadSchema = z.object({
  videoId: z.string(),
  title: z.string(),
  /** Every text that may carry the relative publish time, most precise first */
  timeTexts: z.array(z.string()),
  /** Null for a live or upcoming video, which has no length yet */
  durationSeconds: z.number().nullable(),
  isMembersOnly: z.boolean()
});
type GridUpload = z.infer<typeof gridUploadSchema>;

function readLockup(lockup: Lockup) {
  const isVideo = lockup.contentType === undefined || lockup.contentType === LOCKUP_VIDEO_CONTENT_TYPE;
  const lockupMetadata = lockup.metadata?.lockupMetadataViewModel;
  const title = lockupMetadata?.title?.content;
  if (!isVideo || title === undefined) {
    return null;
  }

  const rows = lockupMetadata?.metadata?.contentMetadataViewModel?.metadataRows ?? [];
  const timeTexts = rows
    .flatMap(row => row.metadataParts ?? [])
    .flatMap(part => [part.accessibilityLabel, part.text?.content])
    .filter(text => text !== undefined);
  const upload: GridUpload = {
    videoId: lockup.contentId,
    title,
    timeTexts,
    durationSeconds: durationFromLockup(lockup),
    isMembersOnly: isMembersOnlyLockup(lockup)
  };
  return upload;
}

function readVideoRenderer(renderer: ClassicRenderer) {
  if (!renderer.title) {
    return null;
  }

  const upload: GridUpload = {
    videoId: renderer.videoId,
    title: readText(renderer.title),
    timeTexts: renderer.publishedTimeText ? [readText(renderer.publishedTimeText)] : [],
    durationSeconds: durationFromClassicRenderer(renderer),
    isMembersOnly: isMembersOnlyClassicRenderer(renderer)
  };
  return upload;
}

function readGridItem(item: unknown) {
  const parsed = gridItemSchema.safeParse(item);
  const content = parsed.success ? parsed.data.richItemRenderer?.content : undefined;
  const lockup = content?.[RendererKind.lockupViewModel];
  if (lockup) {
    return readLockup(lockup);
  }

  const videoRenderer = content?.[RendererKind.videoRenderer];
  return videoRenderer ? readVideoRenderer(videoRenderer) : null;
}

// Live and upcoming videos carry no relative time - they count as published now
function findPublishedAt({ timeTexts, now }: { timeTexts: string[]; now: number }) {
  return (
    parseFirstRelativeTime({
      texts: timeTexts,
      now
    })?.approximateTime ?? now
  );
}

function findGridContents(response: ChannelBrowseResponse) {
  for (const tab of response.contents.twoColumnBrowseResultsRenderer.tabs) {
    const contents = tab.tabRenderer?.content?.richGridRenderer?.contents;
    if (contents) {
      return contents;
    }
  }
  return null;
}

/** Pulls the embedded InnerTube response out of a youtube.com page */
export function extractInitialData(html: string) {
  const initialData = findInitialDataJson(html);
  return initialData && parseJson(initialData.json);
}

/**
 * Reads the uploads of a channel's Videos tab (newest first); publish times are approximated from relative text. The
 * tab never lists Shorts
 */
export function parseVideosTab({
  response,
  now,
  tab = ChannelGridTab.videos
}: {
  response: unknown;
  now: number;
  /** The Streams tab is read the same way; its uploads are marked live streams */
  tab?: ChannelGridTab;
}) {
  const parsed = channelBrowseResponseSchema.safeParse(response);
  if (!parsed.success) {
    return null;
  }

  const gridContents = findGridContents(parsed.data);
  if (!gridContents) {
    return null;
  }

  const { title: channelTitle, externalId: channelId } = parsed.data.metadata.channelMetadataRenderer;
  const videos: FeedVideo[] = [];
  for (const item of gridContents) {
    const upload = readGridItem(item);
    if (!upload) {
      continue;
    }

    const video = feedVideoSchema.safeParse({
      videoId: upload.videoId,
      channelId,
      channelTitle,
      title: upload.title,
      publishedAt: findPublishedAt({
        timeTexts: upload.timeTexts,
        now
      }),
      thumbnailUrl: buildVideoThumbnailUrl(upload.videoId),
      isShort: false,
      isMembersOnly: upload.isMembersOnly,
      isLiveStream: tab === ChannelGridTab.streams,
      ...(upload.durationSeconds !== null && {
        durationSeconds: upload.durationSeconds
      })
    });
    if (video.success) {
      videos.push(video.data);
    }
  }
  return videos;
}

/** The uploads a channel's grid tab lists, or null when the page is unavailable or unreadable */
export async function fetchChannelTabUploads({ channelId, tab }: { channelId: string; tab: ChannelGridTab }) {
  const url = new URL(`${buildChannelPath(channelId)}/${tab}`, YOUTUBE_ORIGIN);
  url.searchParams.set(INTERFACE_LANGUAGE_PARAM, ENGLISH_INTERFACE_LANGUAGE);
  // Cookies carry the user's consent choice - without them EU visitors get the consent interstitial instead
  const html = await fetchText({
    url,
    credentials: "include"
  });
  if (html === null) {
    return null;
  }

  return parseVideosTab({
    response: extractInitialData(html),
    now: Date.now(),
    tab
  });
}
