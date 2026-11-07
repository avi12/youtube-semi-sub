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

/** What only the Videos tab tells about an upload: its length and whether it is for members only */
const tabDetailsSchema = feedVideoSchema.pick({
  durationSeconds: true,
  isMembersOnly: true
});
type TabDetails = z.infer<typeof tabDetailsSchema>;

/** The videos with every detail `detailsById` knows filled in where they lack it */
export function withKnownTabDetails({ videos, detailsById }: {
  videos: FeedVideo[];
  detailsById: ReadonlyMap<string, TabDetails>;
}) {
  return videos.map(video => {
    const known = detailsById.get(video.videoId);
    if (!known) {
      return video;
    }

    const durationSeconds = video.durationSeconds ?? known.durationSeconds;
    const isMembersOnly = video.isMembersOnly ?? known.isMembersOnly;
    const filled: FeedVideo = {
      ...video,
      ...durationSeconds !== undefined && {
        durationSeconds
      },
      ...isMembersOnly !== undefined && {
        isMembersOnly
      }
    };
    return filled;
  });
}

export function collectTabDetails(videos: readonly FeedVideo[]) {
  const detailsById = new Map<string, TabDetails>();
  for (const { videoId, durationSeconds, isMembersOnly } of videos) {
    const isKnown = durationSeconds !== undefined || isMembersOnly !== undefined;
    if (isKnown) {
      detailsById.set(videoId, {
        durationSeconds,
        isMembersOnly
      });
    }
  }
  return detailsById;
}

function isTabDetailMissing(video: FeedVideo) {
  return !video.isShort && (video.durationSeconds === undefined || video.isMembersOnly === undefined);
}

/**
 * RSS tells no lengths and lists members-only videos unmarked, the Videos tab tells both: the uploads with every
 * detail already known (`knownVideos`) filled in, and the Videos tab fetched only while a regular video still lacks
 * one. Shorts never get them - the tab leaves them out
 */
export async function withVideosTabDetails({ uploads, knownVideos }: {
  uploads: ChannelUploads;
  knownVideos: readonly FeedVideo[];
}) {
  const videos = withKnownTabDetails({
    videos: uploads.videos,
    detailsById: collectTabDetails(knownVideos)
  });
  const isTabFetchUseful = videos.some(isTabDetailMissing) && uploads.source === UploadsSource.rss;
  const tabVideos = isTabFetchUseful ? await fetchVideosTabUploads(uploads.channelId) : null;
  const filled: ChannelUploads = {
    ...uploads,
    videos: tabVideos ?
      withKnownTabDetails({
        videos,
        detailsById: collectTabDetails(tabVideos)
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
