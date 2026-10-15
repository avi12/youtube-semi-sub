import { fetchRssUploads } from "./rss-feed";
import { fetchVideosTabUploads } from "./videos-tab-uploads";
import { channelIdSchema } from "@/lib/schemas/channel";
import { feedVideoSchema } from "@/lib/schemas/feed-video";
import { z } from "@/lib/zod";

export enum UploadsSource {
  /** Every upload kind, exact publish times */
  rss = "rss",
  /** Regular videos only, publish times approximated from relative text */
  videosTab = "videos-tab"
}

const channelUploadsSchema = z.object({
  channelId: channelIdSchema,
  source: z.enum(UploadsSource),
  /** Newest first */
  videos: z.array(feedVideoSchema)
});
export type ChannelUploads = z.infer<typeof channelUploadsSchema>;

const pendingFetchByChannel = new Map<string, Promise<ChannelUploads | null>>();

async function fetchFromNetwork(channelId: string) {
  const rssVideos = await fetchRssUploads(channelId);
  if (rssVideos) {
    const uploads: ChannelUploads = {
      channelId,
      source: UploadsSource.rss,
      videos: rssVideos
    };
    return uploads;
  }

  const tabVideos = await fetchVideosTabUploads(channelId);
  if (!tabVideos) {
    return null;
  }

  const uploads: ChannelUploads = {
    channelId,
    source: UploadsSource.videosTab,
    videos: tabVideos
  };
  return uploads;
}

/** RSS first, the Videos tab when RSS fails; concurrent calls for one channel share a single request */
export function fetchChannelUploads(channelId: string) {
  const pending = pendingFetchByChannel.get(channelId);
  if (pending) {
    return pending;
  }

  const request = fetchFromNetwork(channelId).finally(() => pendingFetchByChannel.delete(channelId));
  pendingFetchByChannel.set(channelId, request);
  return request;
}
