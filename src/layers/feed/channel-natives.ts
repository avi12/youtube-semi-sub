import { rendererFromGridItem, shortsLockupFromItem, videoIdFromShelfItem } from "#feed/items/feed-items";
import {
  browseResponseSchema,
  isVerifiedChannelHeader,
  type VideoRenderer,
  videoRendererSchema
} from "#feed/items/feed-schemas";
import type { FeedVideo } from "@/lib/schemas/feed-video";
import { MILLISECONDS_PER_MINUTE } from "@/lib/utils/time";
import { InnerTubeEndpoint, postInnerTube } from "@/lib/youtube/page/innertube";
import { shortsLockupSchema } from "@/lib/youtube/schemas/renderers";
import { z } from "@/lib/zod";

// A channel's Videos tab - or Shorts tab, for a Short - fetched with the page's own client so its renderers match what
// this client renders (lockupViewModel on www, compactVideoRenderer on m, shortsLockupViewModel for Shorts). Cached per
// page session

enum ChannelTab {
  VIDEOS = "videos",
  SHORTS = "shorts"
}

const TAB_PARAMS: Record<ChannelTab, string> = {
  [ChannelTab.VIDEOS]: "EgZ2aWRlb3PyBgQKAjoA",
  [ChannelTab.SHORTS]: "EgZzaG9ydHPyBgUKA5oBAA=="
};
const CACHE_TTL_MS = 5 * MILLISECONDS_PER_MINUTE;
const FAILED_FETCH_RETRY_MS = 30 * 1000;

const tabRequestSchema = z.object({
  channelId: z.string(),
  tab: z.enum(ChannelTab)
});
type TabRequest = z.infer<typeof tabRequestSchema>;

const channelNativesSchema = z.object({
  avatarUrl: z.string().nullable(),
  isVerified: z.boolean(),
  renderersByVideoId: z.map(z.string(), videoRendererSchema),
  shortsByVideoId: z.map(z.string(), shortsLockupSchema)
});
type ChannelNatives = z.infer<typeof channelNativesSchema>;

const cacheEntrySchema = z.object({
  fetchedAt: z.number(),
  natives: z.custom<Promise<ChannelNatives | null>>(value => value instanceof Promise),
  result: channelNativesSchema.nullable().optional()
});
type CacheEntry = z.infer<typeof cacheEntrySchema>;

const cacheByTab = new Map<string, CacheEntry>();

function cacheKey({ channelId, tab }: TabRequest) {
  return `${tab}:${channelId}`;
}

function tabOf(video: Pick<FeedVideo, "isShort">) {
  return video.isShort ? ChannelTab.SHORTS : ChannelTab.VIDEOS;
}

function parseChannelNatives(response: unknown) {
  const parsed = browseResponseSchema.safeParse(response);
  if (!parsed.success) {
    return null;
  }

  const { contents, metadata, header } = parsed.data;
  const tabs = contents.twoColumnBrowseResultsRenderer?.tabs ?? contents.singleColumnBrowseResultsRenderer?.tabs ?? [];
  const natives: ChannelNatives = {
    avatarUrl: metadata?.channelMetadataRenderer?.avatar?.thumbnails?.at(-1)?.url ?? null,
    isVerified: isVerifiedChannelHeader(header),
    renderersByVideoId: new Map<string, VideoRenderer>(),
    shortsByVideoId: new Map()
  };
  for (const tab of tabs) {
    for (const item of tab.tabRenderer?.content?.richGridRenderer?.contents ?? []) {
      const videoId = videoIdFromShelfItem(item);
      const renderer = rendererFromGridItem(item);
      const shortsLockup = shortsLockupFromItem(item);
      if (videoId && renderer) {
        natives.renderersByVideoId.set(videoId, renderer);
      }

      if (videoId && shortsLockup) {
        natives.shortsByVideoId.set(videoId, shortsLockup);
      }
    }
  }
  return natives;
}

async function fetchChannelNatives({ channelId, tab }: TabRequest) {
  const response = await postInnerTube({
    endpoint: InnerTubeEndpoint.BROWSE,
    payload: {
      browseId: channelId,
      params: TAB_PARAMS[tab]
    }
  });
  return parseChannelNatives(response);
}

function isEntryFresh(entry: CacheEntry) {
  const isFailed = entry.result === null;
  const maxAge = isFailed ? FAILED_FETCH_RETRY_MS : CACHE_TTL_MS;
  return Date.now() - entry.fetchedAt < maxAge;
}

function loadTab(request: TabRequest) {
  const key = cacheKey(request);
  const cached = cacheByTab.get(key);
  const isCachedFresh = cached && isEntryFresh(cached);
  if (isCachedFresh) {
    return cached.natives;
  }

  // A stale result keeps serving lookups until the refetch lands, and survives a failed refetch
  const entry: CacheEntry = {
    fetchedAt: Date.now(),
    natives: Promise.resolve(null),
    result: cached?.result
  };
  entry.natives = fetchChannelNatives(request)
    .catch(() => null)
    .then(natives => {
      entry.result = natives ?? cached?.result ?? null;
      return entry.result;
    });
  cacheByTab.set(key, entry);
  return entry.natives;
}

/** Loads the tab each video's native renderer comes from - one request per channel and tab */
export function loadChannelNatives(videos: readonly Pick<FeedVideo, "channelId" | "isShort">[]) {
  const requestsByKey = new Map<string, TabRequest>();
  for (const video of videos) {
    const request: TabRequest = {
      channelId: video.channelId,
      tab: tabOf(video)
    };
    requestsByKey.set(cacheKey(request), request);
  }
  return Promise.all([...requestsByKey.values()].map(loadTab));
}

/** What is already loaded - never waits */
function findLoadedNatives(request: TabRequest) {
  return cacheByTab.get(cacheKey(request))?.result ?? null;
}

function findLoadedNativesOf(video: Pick<FeedVideo, "channelId" | "isShort">) {
  return findLoadedNatives({
    channelId: video.channelId,
    tab: tabOf(video)
  });
}

export function findNativeRenderer(video: Pick<FeedVideo, "channelId" | "videoId" | "isShort">) {
  return findLoadedNativesOf(video)?.renderersByVideoId.get(video.videoId) ?? null;
}

export function findNativeShort(video: Pick<FeedVideo, "channelId" | "videoId" | "isShort">) {
  return findLoadedNativesOf(video)?.shortsByVideoId.get(video.videoId) ?? null;
}

export function findLoadedAvatarUrl(channelId: string) {
  const loaded = Object.values(ChannelTab).map(tab =>
    findLoadedNatives({
      channelId,
      tab
    })
  );
  return loaded.find(natives => natives?.avatarUrl)?.avatarUrl ?? null;
}

export function findLoadedIsVerified(channelId: string) {
  return Object.values(ChannelTab).some(
    tab =>
      findLoadedNatives({
        channelId,
        tab
      })?.isVerified
  );
}
