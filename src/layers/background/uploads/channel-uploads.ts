import { channelIdSchema } from "@/lib/schemas/channel";
import { type FeedVideo, feedVideoSchema } from "@/lib/schemas/feed-video";
import { z } from "@/lib/zod";

import { fetchRssUploads } from "./rss-feed";
import { ChannelGridTab, fetchChannelTabUploads } from "./videos-tab-uploads";

export enum UploadsSource {
  /** Every upload kind, exact publish times */
  RSS = "rss",
  /** Regular videos only, publish times approximated from relative text */
  VIDEOS_TAB = "videos-tab"
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
      source: UploadsSource.RSS,
      videos: rssVideos
    };
    return uploads;
  }

  const tabVideos = await fetchChannelTabUploads({
    channelId,
    tab: ChannelGridTab.VIDEOS
  });
  if (!tabVideos) {
    return null;
  }

  const uploads: ChannelUploads = {
    channelId,
    source: UploadsSource.VIDEOS_TAB,
    videos: tabVideos
  };
  return uploads;
}

/** What only a channel's tabs tell about an upload: its length, whether it is for members only and a live stream */
const tabDetailsSchema = feedVideoSchema.pick({
  durationSeconds: true,
  isMembersOnly: true,
  isLiveStream: true
});
type TabDetails = z.infer<typeof tabDetailsSchema>;

/** The videos with every detail `detailsById` knows filled in where they lack it */
export function withKnownTabDetails({
  videos,
  detailsById
}: {
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
      ...(durationSeconds !== undefined && {
        durationSeconds
      }),
      ...(isMembersOnly !== undefined && {
        isMembersOnly
      })
    };
    return filled;
  });
}

export function collectTabDetails(videos: readonly FeedVideo[]) {
  const detailsById = new Map<string, TabDetails>();
  for (const { videoId, durationSeconds, isMembersOnly, isLiveStream } of videos) {
    const isKnown = durationSeconds !== undefined || isMembersOnly !== undefined || isLiveStream !== undefined;
    if (isKnown) {
      detailsById.set(videoId, {
        durationSeconds,
        isMembersOnly,
        isLiveStream
      });
    }
  }
  return detailsById;
}

/** A live or upcoming stream has no length yet, so only its tab and badge are waited for */
function isTabDetailMissing(video: FeedVideo) {
  const isLengthMissing = video.durationSeconds === undefined && video.isLiveStream !== true;
  return !video.isShort && (isLengthMissing || video.isMembersOnly === undefined || video.isLiveStream === undefined);
}

/**
 * RSS tells no lengths and lists members-only videos and live streams unmarked; a channel's tabs tell all three: the
 * uploads with every detail already known (`knownVideos`) filled in, then the Videos tab read while a regular upload
 * still lacks one, and the Streams tab while one is still missing - a stream is only ever on that tab. Shorts never get
 * them - neither tab lists Shorts
 */
export async function withVideosTabDetails({
  uploads,
  knownVideos
}: {
  uploads: ChannelUploads;
  knownVideos: readonly FeedVideo[];
}) {
  let videos = withKnownTabDetails({
    videos: uploads.videos,
    detailsById: collectTabDetails(knownVideos)
  });
  const isFromRss = uploads.source === UploadsSource.RSS;
  for (const tab of Object.values(ChannelGridTab)) {
    if (!isFromRss || !videos.some(isTabDetailMissing)) {
      break;
    }

    const tabVideos = await fetchChannelTabUploads({
      channelId: uploads.channelId,
      tab
    });
    videos = withKnownTabDetails({
      videos,
      detailsById: collectTabDetails(tabVideos ?? [])
    });
  }

  const filled: ChannelUploads = {
    ...uploads,
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
