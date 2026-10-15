import { channelIdSchema } from "@/lib/schemas/channel";
import { z } from "@/lib/zod";

export const VIDEO_ID_PATTERN = /^[\w-]{11}$/;

export const feedVideoSchema = z.object({
  videoId: z.string().regex(VIDEO_ID_PATTERN),
  channelId: channelIdSchema,
  channelTitle: z.string(),
  title: z.string(),
  publishedAt: z.number(),
  thumbnailUrl: z.url()
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
