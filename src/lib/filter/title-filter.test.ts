import { compileTitleFilter, getTitleFilterError, selectFeedVideos } from "@/lib/filter/title-filter";
import type { FeedVideo } from "@/lib/schemas/feed-video";
import type { SemiSubscriptions } from "@/lib/schemas/semi-subscription";
import { describe, expect, it } from "vitest";

const CHANNEL_ID = "UCBJycsmduvYEL83R_U4JriQ";
const OTHER_CHANNEL_ID = "UCXuqSBlHAE6Xw-yeJA0Tunw";
const HOUR_MS = 3_600_000;

function createVideo({ videoId, channelId, title, publishedAt }: Pick<FeedVideo, "videoId" | "channelId" | "title" | "publishedAt">) {
  const video: FeedVideo = {
    videoId,
    channelId,
    title,
    publishedAt,
    channelTitle: "Channel",
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  };
  return video;
}

function createSubscriptions(pattern: string) {
  const subscriptions: SemiSubscriptions = {
    [CHANNEL_ID]: {
      channelId: CHANNEL_ID,
      title: "Channel",
      filter: {
        pattern,
        flags: "i"
      },
      createdAt: 0
    }
  };
  return subscriptions;
}

describe("compileTitleFilter", () => {
  it("compiles a valid pattern", () => {
    expect(
      compileTitleFilter({
        pattern: "review",
        flags: "i"
      })?.test("iPhone REVIEW")
    ).toBe(true);
  });

  it("rejects an invalid pattern", () => {
    expect(
      compileTitleFilter({
        pattern: "(",
        flags: ""
      })
    ).toBeNull();
  });

  it("rejects stateful flags", () => {
    expect(
      compileTitleFilter({
        pattern: "a",
        flags: "g"
      })
    ).toBeNull();
  });
});

describe("getTitleFilterError", () => {
  it("is null for a valid pattern", () => {
    expect(
      getTitleFilterError({
        pattern: "a|b",
        flags: "i"
      })
    ).toBeNull();
  });

  it("describes an invalid pattern", () => {
    expect(
      getTitleFilterError({
        pattern: "[",
        flags: ""
      })
    ).toEqual(expect.any(String));
  });
});

describe("selectFeedVideos", () => {
  const videos = [
    createVideo({
      videoId: "aaaaaaaaaaa",
      channelId: CHANNEL_ID,
      title: "Phone review",
      publishedAt: HOUR_MS
    }),
    createVideo({
      videoId: "bbbbbbbbbbb",
      channelId: CHANNEL_ID,
      title: "Vlog",
      publishedAt: 2 * HOUR_MS
    }),
    createVideo({
      videoId: "ccccccccccc",
      channelId: CHANNEL_ID,
      title: "Laptop Review",
      publishedAt: 3 * HOUR_MS
    })
  ];

  it("keeps only matching videos, newest first", () => {
    const selected = selectFeedVideos({
      subscriptions: createSubscriptions("review"),
      videosByChannel: {
        [CHANNEL_ID]: videos
      }
    });
    expect(selected.map(video => video.videoId)).toEqual(["ccccccccccc", "aaaaaaaaaaa"]);
  });

  it("treats an empty pattern as every video", () => {
    const selected = selectFeedVideos({
      subscriptions: createSubscriptions(""),
      videosByChannel: {
        [CHANNEL_ID]: videos
      }
    });
    expect(selected).toHaveLength(videos.length);
  });

  it("ignores channels without a semi-subscription", () => {
    const selected = selectFeedVideos({
      subscriptions: createSubscriptions(""),
      videosByChannel: {
        [OTHER_CHANNEL_ID]: [
          createVideo({
            videoId: "ddddddddddd",
            channelId: OTHER_CHANNEL_ID,
            title: "Other",
            publishedAt: HOUR_MS
          })
        ]
      }
    });
    expect(selected).toEqual([]);
  });

  it("skips a channel whose filter no longer compiles", () => {
    const selected = selectFeedVideos({
      subscriptions: createSubscriptions("("),
      videosByChannel: {
        [CHANNEL_ID]: videos
      }
    });
    expect(selected).toEqual([]);
  });
});
