import { type FeedVideo, sortNewestFirst, videosByChannelFromCache } from "@/lib/schemas/feed-video";
import { describe, expect, it } from "vitest";

const CHANNEL_ID = "UCBJycsmduvYEL83R_U4JriQ";

function createVideo({ videoId, publishedAt }: Pick<FeedVideo, "videoId" | "publishedAt">) {
  const video: FeedVideo = {
    videoId,
    channelId: CHANNEL_ID,
    channelTitle: "Channel",
    title: "Title",
    publishedAt,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    isShort: false
  };
  return video;
}

const OLDER = createVideo({
  videoId: "aaaaaaaaaaa",
  publishedAt: 1
});
const NEWER = createVideo({
  videoId: "bbbbbbbbbbb",
  publishedAt: 2
});

describe("sortNewestFirst", () => {
  it("sorts a copy, newest first", () => {
    const videos = [OLDER, NEWER];
    expect(sortNewestFirst(videos)).toEqual([NEWER, OLDER]);
    expect(videos).toEqual([OLDER, NEWER]);
  });
});

describe("videosByChannelFromCache", () => {
  it("keeps each channel's videos and drops when they were fetched", () => {
    expect(
      videosByChannelFromCache({
        [CHANNEL_ID]: {
          fetchedAt: 0,
          videos: [NEWER]
        }
      })
    ).toEqual({ [CHANNEL_ID]: [NEWER] });
  });
});
