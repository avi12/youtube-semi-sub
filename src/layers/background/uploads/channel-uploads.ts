import { fetchRssUploads } from "./rss-feed";
import { fetchVideosTabUploads } from "./videos-tab-uploads";
import { channelIdSchema } from "@/lib/schemas/channel";
import { type FeedVideo, feedVideoSchema } from "@/lib/schemas/feed-video";
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

export function withKnownDurations({ videos, durationById }: {
  videos: FeedVideo[];
  durationById: ReadonlyMap<string, number>;
}) {
  return videos.map(video => {
    const durationSeconds = video.durationSeconds ?? durationById.get(video.videoId);
    return durationSeconds === undefined ? video : {
      ...video,
      durationSeconds
    };
  });
}

export function collectDurations(videos: readonly FeedVideo[]) {
  const durationById = new Map<string, number>();
  for (const { videoId, durationSeconds } of videos) {
    if (durationSeconds !== undefined) {
      durationById.set(videoId, durationSeconds);
    }
  }
  return durationById;
}

/**
 * RSS tells no lengths, the Videos tab does: the uploads with every length already known (`knownVideos`) filled in,
 * and the Videos tab fetched only while a regular video still lacks one. Shorts never get one - the tab leaves them out
 */
export async function withDurations({ uploads, knownVideos }: {
  uploads: ChannelUploads;
  knownVideos: readonly FeedVideo[];
}) {
  const videos = withKnownDurations({
    videos: uploads.videos,
    durationById: collectDurations(knownVideos)
  });
  const isLengthMissing = videos.some(video => !video.isShort && video.durationSeconds === undefined);
  const isTabFetchUseful = isLengthMissing && uploads.source === UploadsSource.rss;
  const tabVideos = isTabFetchUseful ? await fetchVideosTabUploads(uploads.channelId) : null;
  const filled: ChannelUploads = {
    ...uploads,
    videos: tabVideos ?
      withKnownDurations({
        videos,
        durationById: collectDurations(tabVideos)
      }) :
      videos
  };
  return filled;
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
