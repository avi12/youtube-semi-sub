import { describe, expect, it } from "vitest";

import { getAiFilterKey } from "@/lib/filter/ai-filter-key";
import { type AiFilter, DEFAULT_TITLE_FILTER, FilterKind } from "@/lib/filter/title-filter";
import type { FeedVideo } from "@/lib/schemas/feed-video";
import type { SemiSubscriptions } from "@/lib/schemas/semi-subscription";

import { collectClassificationJobs } from "./classification";

const CHANNEL_ID = "UCBJycsmduvYEL83R_U4JriQ";
const REGEX_CHANNEL_ID = "UCXuqSBlHAE6Xw-yeJA0Tunw";
const REVIEWS: AiFilter = {
  kind: FilterKind.AI_MATCH,
  description: "only reviews"
};
const TUTORIALS: AiFilter = {
  kind: FilterKind.AI_MATCH,
  description: "only tutorials"
};

function createVideo({ videoId, publishedAt }: Pick<FeedVideo, "videoId" | "publishedAt">) {
  const video: FeedVideo = {
    videoId,
    channelId: CHANNEL_ID,
    channelTitle: "Channel",
    title: videoId,
    publishedAt,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    isShort: false
  };
  return video;
}

const OLD = createVideo({
  videoId: "aaaaaaaaaaa",
  publishedAt: 1
});
const NEW = createVideo({
  videoId: "bbbbbbbbbbb",
  publishedAt: 2
});
const JUDGED = createVideo({
  videoId: "ccccccccccc",
  publishedAt: 3
});

const SUBSCRIPTIONS: SemiSubscriptions = {
  [CHANNEL_ID]: {
    channelId: CHANNEL_ID,
    title: "Channel",
    followFilter: REVIEWS,
    createdAt: 0,
    hideFilter: DEFAULT_TITLE_FILTER,
    isSubscribed: false
  },
  [REGEX_CHANNEL_ID]: {
    channelId: REGEX_CHANNEL_ID,
    title: "Regex channel",
    followFilter: {
      kind: FilterKind.REGEX,
      pattern: "",
      flags: "i"
    },
    createdAt: 0,
    hideFilter: DEFAULT_TITLE_FILTER,
    isSubscribed: false
  }
};

describe("collectClassificationJobs", () => {
  const jobs = collectClassificationJobs({
    requests: [
      {
        filter: TUTORIALS,
        videos: [OLD]
      },
      {
        filter: {
          kind: FilterKind.AI_MATCH,
          description: " only  reviews"
        },
        videos: [OLD]
      }
    ],
    subscriptions: SUBSCRIPTIONS,
    channelVideos: {
      [CHANNEL_ID]: {
        fetchedAt: 0,
        videos: [OLD, JUDGED, NEW]
      },
      [REGEX_CHANNEL_ID]: {
        fetchedAt: 0,
        videos: [
          createVideo({
            videoId: "ddddddddddd",
            publishedAt: 4
          })
        ]
      }
    },
    aiVerdicts: {
      [getAiFilterKey(REVIEWS)]: {
        [JUDGED.videoId]: true
      }
    }
  });

  it("puts the editor's requests first and groups by filter key", () => {
    expect(jobs.map(job => job.key)).toEqual([getAiFilterKey(TUTORIALS), getAiFilterKey(REVIEWS)]);
  });

  it("judges a video once per key, skips judged ones, and leaves RegExp channels alone", () => {
    expect(jobs[1]?.videos.map(video => video.videoId)).toEqual([OLD.videoId, NEW.videoId]);
    expect(jobs[1]?.description).toBe("only reviews");
  });

  it("drops a filter with nothing left to judge", () => {
    expect(
      collectClassificationJobs({
        requests: [],
        subscriptions: SUBSCRIPTIONS,
        channelVideos: {},
        aiVerdicts: {}
      })
    ).toEqual([]);
  });
});

describe("collectClassificationJobs across modes", () => {
  it("judges a subscribed channel by its hide filter and by its allow list", () => {
    const jobs = collectClassificationJobs({
      requests: [],
      subscriptions: {
        [CHANNEL_ID]: {
          channelId: CHANNEL_ID,
          title: "Channel",
          followFilter: REVIEWS,
          hideFilter: TUTORIALS,
          createdAt: 0,
          isSubscribed: true
        }
      },
      channelVideos: {
        [CHANNEL_ID]: {
          fetchedAt: 0,
          videos: [OLD]
        }
      },
      aiVerdicts: {}
    });
    expect(jobs.map(job => job.key)).toEqual([getAiFilterKey(TUTORIALS), getAiFilterKey(REVIEWS)]);
  });
});
