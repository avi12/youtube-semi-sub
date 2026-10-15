import { InnerTubeEndpoint, postInnerTube } from "@/lib/youtube/page/innertube";
import { z } from "@/lib/zod";
import { rendererFromGridItem, videoIdFromGridItem } from "#feed/items/feed-items";
import { browseResponseSchema, type VideoRenderer, videoRendererSchema } from "#feed/items/feed-schemas";

// A channel's Videos tab, fetched with the page's own client so its renderers match what this client renders
// (lockupViewModel on www, compactVideoRenderer on m). Cached per page session

const VIDEOS_TAB_PARAMS = "EgZ2aWRlb3PyBgQKAjoA";
const CACHE_TTL_MS = 5 * 60 * 1000;
const FAILED_FETCH_RETRY_MS = 30 * 1000;

const channelNativesSchema = z.object({
  avatarUrl: z.string().nullable(),
  renderersByVideoId: z.map(z.string(), videoRendererSchema)
});
type ChannelNatives = z.infer<typeof channelNativesSchema>;

const cacheEntrySchema = z.object({
  fetchedAt: z.number(),
  natives: z.custom<Promise<ChannelNatives | null>>(value => value instanceof Promise),
  result: channelNativesSchema.nullable().optional()
});
type CacheEntry = z.infer<typeof cacheEntrySchema>;

const cacheByChannelId = new Map<string, CacheEntry>();

function parseChannelNatives(response: unknown) {
  const parsed = browseResponseSchema.safeParse(response);
  if (!parsed.success) {
    return null;
  }

  const { contents, metadata } = parsed.data;
  const tabs = contents.twoColumnBrowseResultsRenderer?.tabs ?? contents.singleColumnBrowseResultsRenderer?.tabs ?? [];
  const renderersByVideoId = new Map<string, VideoRenderer>();
  for (const tab of tabs) {
    for (const item of tab.tabRenderer?.content?.richGridRenderer?.contents ?? []) {
      const videoId = videoIdFromGridItem(item);
      const renderer = rendererFromGridItem(item);
      if (videoId && renderer) {
        renderersByVideoId.set(videoId, renderer);
      }
    }
  }

  const natives: ChannelNatives = {
    avatarUrl: metadata?.channelMetadataRenderer?.avatar?.thumbnails?.at(-1)?.url ?? null,
    renderersByVideoId
  };
  return natives;
}

async function fetchChannelNatives(channelId: string) {
  const response = await postInnerTube({
    endpoint: InnerTubeEndpoint.browse,
    payload: {
      browseId: channelId,
      params: VIDEOS_TAB_PARAMS
    }
  });
  return parseChannelNatives(response);
}

function isEntryFresh(entry: CacheEntry) {
  const isFailed = entry.result === null;
  const maxAge = isFailed ? FAILED_FETCH_RETRY_MS : CACHE_TTL_MS;
  return Date.now() - entry.fetchedAt < maxAge;
}

export function loadChannelNatives(channelId: string) {
  const cached = cacheByChannelId.get(channelId);
  if (cached && isEntryFresh(cached)) {
    return cached.natives;
  }

  // A stale result keeps serving lookups until the refetch lands, and survives a failed refetch
  const entry: CacheEntry = {
    fetchedAt: Date.now(),
    natives: Promise.resolve(null),
    result: cached?.result
  };
  entry.natives = fetchChannelNatives(channelId).catch(() => null).then(natives => {
    entry.result = natives ?? cached?.result ?? null;
    return entry.result;
  });
  cacheByChannelId.set(channelId, entry);
  return entry.natives;
}

/** What is already loaded - never waits */
function findLoadedNatives(channelId: string) {
  const entry = cacheByChannelId.get(channelId);
  return entry?.result ?? null;
}

export function findNativeRenderer({ channelId, videoId }: {
  channelId: string;
  videoId: string;
}) {
  return findLoadedNatives(channelId)?.renderersByVideoId.get(videoId) ?? null;
}

export function findLoadedAvatarUrl(channelId: string) {
  return findLoadedNatives(channelId)?.avatarUrl ?? null;
}
