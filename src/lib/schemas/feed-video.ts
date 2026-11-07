import { channelIdSchema } from "@/lib/schemas/channel";
import { VIDEO_ID_SOURCE } from "@/lib/youtube/site";
import { z } from "@/lib/zod";

export const VIDEO_ID_PATTERN = new RegExp(`^${VIDEO_ID_SOURCE}$`);
export const videoIdSchema = z.string().regex(VIDEO_ID_PATTERN);
/** Enough of a description to tell what a video is about, without filling storage with link lists and credits */
export const VIDEO_DESCRIPTION_MAX_LENGTH = 400;

export const feedVideoSchema = z.object({
  videoId: videoIdSchema,
  channelId: channelIdSchema,
  channelTitle: z.string(),
  title: z.string(),
  publishedAt: z.number(),
  thumbnailUrl: z.url(),
  /** A Short belongs in the feed's Shorts shelf, never among its regular videos */
  isShort: z.boolean(),
  /** RSS only, cleaned up and cut to `VIDEO_DESCRIPTION_MAX_LENGTH` - what AI match reads besides the title */
  description: z.string().max(VIDEO_DESCRIPTION_MAX_LENGTH).optional(),
  /** From the Videos tab, which RSS lacks - unknown for a Short, a live stream and a video not looked up yet */
  durationSeconds: z.number().int().nonnegative().optional(),
  /** From the Videos tab: RSS lists members-only videos unmarked. Unknown for a Short */
  isMembersOnly: z.boolean().optional()
});
export type FeedVideo = z.infer<typeof feedVideoSchema>;

export function sortNewestFirst(videos: readonly FeedVideo[]) {
  return videos.toSorted((left, right) => right.publishedAt - left.publishedAt);
}

/**
 * RSS only lists the latest 15 uploads, so a matching video would vanish as soon as the channel posts 15 others. The
 * cache therefore keeps videos that slid out of the fetched window, up to this many per channel
 */
export const MAX_CACHED_VIDEOS_PER_CHANNEL = 50;

const channelVideosSchema = z.object({
  fetchedAt: z.number(),
  videos: z.array(feedVideoSchema)
});
export type ChannelVideos = z.infer<typeof channelVideosSchema>;

export const channelVideosCacheSchema = z.record(channelIdSchema, channelVideosSchema);
export type ChannelVideosCache = z.infer<typeof channelVideosCacheSchema>;

/** Each channel's cached uploads, as the filters read them */
export type VideosByChannel = Partial<Record<string, FeedVideo[]>>;

export function videosByChannelFromCache(cache: ChannelVideosCache) {
  const videosByChannel: VideosByChannel = {};
  for (const channelId in cache) {
    videosByChannel[channelId] = cache[channelId]?.videos;
  }
  return videosByChannel;
}
