import { type ChannelUploads, UploadsSource } from "./channel-uploads";
import { type FeedVideo, feedVideoSchema } from "@/lib/feed-video";

// RSS only lists the latest 15 uploads, so a matching video would vanish as soon as the channel posts 15 others.
// The cache therefore keeps videos that slid out of the fetched window, up to this many per channel
export const MAX_CACHED_VIDEOS_PER_CHANNEL = 50;

const FEED_VIDEO_KEYS = feedVideoSchema.keyof().options;

function isSameVideo({ left, right }: {
  left: FeedVideo;
  right: FeedVideo;
}) {
  for (const key of FEED_VIDEO_KEYS) {
    if (left[key] !== right[key]) {
      return false;
    }
  }
  return true;
}

export function isVideoListUnchanged({ previous, next }: {
  previous: FeedVideo[];
  next: FeedVideo[];
}) {
  if (previous.length !== next.length) {
    return false;
  }

  for (const [i, video] of next.entries()) {
    const previousVideo = previous[i];
    const isUnchanged = previousVideo !== undefined && isSameVideo({
      left: previousVideo,
      right: video
    });
    if (!isUnchanged) {
      return false;
    }
  }
  return true;
}

// Approximate times drift with every fetch ("3 hours ago" keeps moving), so a known video keeps what the cache has
// and only takes the fresh title
function stabilizeApproximateVideos({ videos, previous }: {
  videos: FeedVideo[];
  previous: FeedVideo[];
}) {
  const previousById = new Map(previous.map(video => [video.videoId, video]));
  return videos.map(video => {
    const knownVideo = previousById.get(video.videoId);
    return knownVideo
      ? {
        ...knownVideo,
        title: video.title
      }
      : video;
  });
}

/**
 * Folds a fetch into a channel's cached videos, newest first. An RSS fetch is complete for its time window, so a
 * cached video inside that window but missing from the fetch was deleted or made private and is dropped. The Videos
 * tab leaves out Shorts and live streams, so nothing cached is dropped on its word
 */
export function mergeChannelVideos({ previous, uploads }: {
  previous: FeedVideo[];
  uploads: ChannelUploads;
}) {
  if (uploads.videos.length === 0) {
    return previous;
  }

  const isExact = uploads.source === UploadsSource.rss;
  const fetchedVideos = isExact
    ? uploads.videos
    : stabilizeApproximateVideos({
      videos: uploads.videos,
      previous
    });
  const fetchedIds = new Set(fetchedVideos.map(video => video.videoId));
  const oldestFetchedAt = Math.min(...fetchedVideos.map(video => video.publishedAt));
  const retainedVideos = previous.filter(video => {
    const isRefetched = fetchedIds.has(video.videoId);
    const isRemovedUpload = isExact && video.publishedAt >= oldestFetchedAt;
    return !isRefetched && !isRemovedUpload;
  });
  return [...fetchedVideos, ...retainedVideos]
    .toSorted((left, right) => right.publishedAt - left.publishedAt)
    .slice(0, MAX_CACHED_VIDEOS_PER_CHANNEL);
}
