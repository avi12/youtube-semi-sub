import {
  type ChannelUploads,
  collectTabDetails,
  UploadsSource,
  withKnownTabDetails
} from "#background/uploads/channel-uploads";
import {
  type FeedVideo,
  feedVideoSchema,
  MAX_CACHED_VIDEOS_PER_CHANNEL,
  sortNewestFirst
} from "@/lib/schemas/feed-video";

const FEED_VIDEO_KEYS = feedVideoSchema.keyof().options;

function isSameVideo({ left, right }: { left: FeedVideo; right: FeedVideo }) {
  for (const key of FEED_VIDEO_KEYS) {
    if (left[key] !== right[key]) {
      return false;
    }
  }
  return true;
}

export function isVideoListUnchanged({ previous, next }: { previous: FeedVideo[]; next: FeedVideo[] }) {
  if (previous.length !== next.length) {
    return false;
  }

  for (const [i, video] of next.entries()) {
    const previousVideo = previous[i];
    const isUnchanged =
      previousVideo !== undefined &&
      isSameVideo({
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
function stabilizeApproximateVideos({ videos, previous }: { videos: FeedVideo[]; previous: FeedVideo[] }) {
  const previousById = new Map(previous.map(video => [video.videoId, video]));
  return videos.map(video => {
    const knownVideo = previousById.get(video.videoId);
    return knownVideo
      ? {
          ...knownVideo,
          title: video.title,
          durationSeconds: video.durationSeconds ?? knownVideo.durationSeconds,
          isMembersOnly: video.isMembersOnly ?? knownVideo.isMembersOnly,
          isLiveStream: video.isLiveStream ?? knownVideo.isLiveStream
        }
      : video;
  });
}

/**
 * Folds a fetch into a channel's cached videos, newest first. An RSS fetch is complete for its time window, so a
 * cached video inside that window but missing from the fetch was deleted or made private and is dropped. The Videos
 * tab leaves out Shorts and live streams, so nothing cached is dropped on its word
 */
export function mergeChannelVideos({ previous, uploads }: { previous: FeedVideo[]; uploads: ChannelUploads }) {
  if (uploads.videos.length === 0) {
    return previous;
  }

  const isExact = uploads.source === UploadsSource.RSS;
  const fetchedVideos = isExact
    ? // A refetch that didn't look at the Videos tab keeps what the cache learned from it
      withKnownTabDetails({
        videos: uploads.videos,
        detailsById: collectTabDetails(previous)
      })
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
  return sortNewestFirst([...fetchedVideos, ...retainedVideos]).slice(0, MAX_CACHED_VIDEOS_PER_CHANNEL);
}
