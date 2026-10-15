import { channelIdSchema } from "@/lib/schemas/channel";
import { z } from "@/lib/zod";

export const VIDEO_ID_PATTERN = /^[\w-]{11}$/;
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
  /** RSS only, cleaned up and cut to `VIDEO_DESCRIPTION_MAX_LENGTH` - what AI match reads besides the title */
  description: z.string().max(VIDEO_DESCRIPTION_MAX_LENGTH).optional()
});
export type FeedVideo = z.infer<typeof feedVideoSchema>;

export function sortNewestFirst(videos: readonly FeedVideo[]) {
  return videos.toSorted((left, right) => right.publishedAt - left.publishedAt);
}

const channelVideosSchema = z.object({
  fetchedAt: z.number(),
  videos: z.array(feedVideoSchema)
});
export type ChannelVideos = z.infer<typeof channelVideosSchema>;

export const channelVideosCacheSchema = z.record(channelIdSchema, channelVideosSchema);
export type ChannelVideosCache = z.infer<typeof channelVideosCacheSchema>;

export function videosByChannelFromCache(cache: ChannelVideosCache) {
  const videosByChannel: Partial<Record<string, FeedVideo[]>> = {};
  for (const channelId in cache) {
    videosByChannel[channelId] = cache[channelId]?.videos;
  }
  return videosByChannel;
}
