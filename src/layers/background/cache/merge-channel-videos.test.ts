import { isVideoListUnchanged, mergeChannelVideos } from "./merge-channel-videos";
import { MAX_CACHED_VIDEOS_PER_CHANNEL } from "@/lib/schemas/feed-video";
import type { FeedVideo } from "@/lib/schemas/feed-video";
import { UploadsSource } from "#background/uploads/channel-uploads";
import { describe, expect, it } from "vitest";

const CHANNEL_ID = "UCBJycsmduvYEL83R_U4JriQ";
const HOUR_MS = 3_600_000;

function createVideo({ videoId, publishedAt, title = `Video ${videoId}` }: {
  videoId: string;
  publishedAt: number;
  title?: string;
}) {
  const video: FeedVideo = {
    videoId,
    channelId: CHANNEL_ID,
    channelTitle: "Channel",
    title,
    publishedAt,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    isShort: false
  };
  return video;
}

function readIds(videos: FeedVideo[]) {
  return videos.map(video => video.videoId);
}

describe("mergeChannelVideos", () => {
  const olderThanWindow = createVideo({
    videoId: "older000000",
    publishedAt: 1 * HOUR_MS
  });
  const deletedInWindow = createVideo({
    videoId: "deleted0000",
    publishedAt: 5 * HOUR_MS
  });
  const kept = createVideo({
    videoId: "kept0000000",
    publishedAt: 4 * HOUR_MS
  });

  it("trusts RSS within its window and keeps cached videos that slid out of it", () => {
    const merged = mergeChannelVideos({
      previous: [deletedInWindow, kept, olderThanWindow],
      uploads: {
        channelId: CHANNEL_ID,
        source: UploadsSource.rss,
        videos: [
          createVideo({
            videoId: "new00000000",
            publishedAt: 6 * HOUR_MS
          }),
          kept
        ]
      }
    });
    expect(readIds(merged)).toEqual(["new00000000", "kept0000000", "older000000"]);
  });

  it("keeps cached times of known Videos tab uploads and drops nothing", () => {
    const approximateKept = createVideo({
      videoId: kept.videoId,
      publishedAt: 4.5 * HOUR_MS,
      title: "Renamed"
    });
    const merged = mergeChannelVideos({
      previous: [deletedInWindow, kept, olderThanWindow],
      uploads: {
        channelId: CHANNEL_ID,
        source: UploadsSource.videosTab,
        videos: [approximateKept]
      }
    });
    expect(readIds(merged)).toEqual(["deleted0000", "kept0000000", "older000000"]);
    expect(merged[1]).toEqual({
      ...kept,
      title: "Renamed"
    });
  });

  it("keeps the lengths the cache has when RSS, which tells none, refetches a video", () => {
    const merged = mergeChannelVideos({
      previous: [{
        ...kept,
        durationSeconds: 754
      }],
      uploads: {
        channelId: CHANNEL_ID,
        source: UploadsSource.rss,
        videos: [kept]
      }
    });
    expect(merged[0]?.durationSeconds).toBe(754);
  });

  it("keeps the cache when a fetch comes back empty", () => {
    const previous = [kept];
    expect(
      mergeChannelVideos({
        previous,
        uploads: {
          channelId: CHANNEL_ID,
          source: UploadsSource.rss,
          videos: []
        }
      })
    ).toBe(previous);
  });

  it("caps the cache per channel, keeping the newest", () => {
    const previous = Array.from({ length: MAX_CACHED_VIDEOS_PER_CHANNEL }, (_, i) => createVideo({
      videoId: `old${String(i).padStart(8, "0")}`,
      publishedAt: i
    }));
    const merged = mergeChannelVideos({
      previous,
      uploads: {
        channelId: CHANNEL_ID,
        source: UploadsSource.rss,
        videos: [
          createVideo({
            videoId: "new00000000",
            publishedAt: HOUR_MS
          })
        ]
      }
    });
    expect(merged).toHaveLength(MAX_CACHED_VIDEOS_PER_CHANNEL);
    expect(merged[0]?.videoId).toBe("new00000000");
    expect(merged.at(-1)?.publishedAt).toBe(1);
  });
});

describe("isVideoListUnchanged", () => {
  const first = createVideo({
    videoId: "first000000",
    publishedAt: 2
  });
  const second = createVideo({
    videoId: "second00000",
    publishedAt: 1
  });

  it("matches equal lists, even as separate objects", () => {
    expect(
      isVideoListUnchanged({
        previous: [first, second],
        next: [{ ...first }, { ...second }]
      })
    ).toBe(true);
  });

  it("notices a changed field, order or length", () => {
    expect(
      isVideoListUnchanged({
        previous: [first, second],
        next: [
          {
            ...first,
            title: "Renamed"
          },
          second
        ]
      })
    ).toBe(false);
    expect(
      isVideoListUnchanged({
        previous: [first, second],
        next: [second, first]
      })
    ).toBe(false);
    expect(
      isVideoListUnchanged({
        previous: [first, second],
        next: [first]
      })
    ).toBe(false);
  });
});
