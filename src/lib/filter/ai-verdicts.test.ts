import { describe, expect, it } from "vitest";

import { DEFAULT_TITLE_FILTER } from "@/lib/filter/schema/video-filter-schema";
import { FilterKind, type TitleFilter } from "@/lib/filter/schema/video-filter-schema";
import type { ChannelVideosCache, FeedVideo } from "@/lib/schemas/feed-video";
import type { SemiSubscriptions } from "@/lib/schemas/semi-subscription";

import { getAiFilterKey } from "./ai-filter-key";
import { countAiVerdicts, pruneAiVerdicts } from "./ai-verdicts";

const CHANNEL_ID = "UCBJycsmduvYEL83R_U4JriQ";
const OTHER_CHANNEL_ID = "UCXuqSBlHAE6Xw-yeJA0Tunw";
const REVIEWS_KEY = getAiFilterKey({ description: "only reviews" });
const TUTORIALS_KEY = getAiFilterKey({ description: "only tutorials" });

function createVideo(videoId: string) {
  const video: FeedVideo = {
    videoId,
    channelId: CHANNEL_ID,
    channelTitle: "Channel",
    title: videoId,
    publishedAt: 0,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    isShort: false
  };
  return video;
}

function createSubscriptions(filtersByChannel: Record<string, TitleFilter>) {
  const subscriptions: SemiSubscriptions = {};
  for (const channelId of Object.keys(filtersByChannel)) {
    const filter = filtersByChannel[channelId];
    if (filter) {
      subscriptions[channelId] = {
        channelId,
        title: "Channel",
        followFilter: filter,
        createdAt: 0,
        hideFilter: DEFAULT_TITLE_FILTER,
        isSubscribed: false
      };
    }
  }
  return subscriptions;
}

const CHANNEL_VIDEOS: ChannelVideosCache = {
  [CHANNEL_ID]: {
    fetchedAt: 0,
    videos: [createVideo("aaaaaaaaaaa"), createVideo("bbbbbbbbbbb")]
  },
  [OTHER_CHANNEL_ID]: {
    fetchedAt: 0,
    videos: [createVideo("ccccccccccc")]
  }
};

describe("pruneAiVerdicts", () => {
  it("drops keys no semi-subscription uses, like an old filter or an unsaved preview", () => {
    const pruned = pruneAiVerdicts({
      aiVerdicts: {
        [REVIEWS_KEY]: {
          aaaaaaaaaaa: true
        },
        [TUTORIALS_KEY]: {
          aaaaaaaaaaa: false
        }
      },
      subscriptions: createSubscriptions({
        [CHANNEL_ID]: {
          kind: FilterKind.AI_MATCH,
          description: "only reviews"
        }
      }),
      channelVideos: CHANNEL_VIDEOS
    });
    expect(pruned).toEqual({
      [REVIEWS_KEY]: {
        aaaaaaaaaaa: true
      }
    });
  });

  it("drops videos that left the cache of every channel using the key", () => {
    const pruned = pruneAiVerdicts({
      aiVerdicts: {
        [REVIEWS_KEY]: {
          aaaaaaaaaaa: true,
          zzzzzzzzzzz: true,
          ccccccccccc: false
        }
      },
      subscriptions: createSubscriptions({
        [CHANNEL_ID]: {
          kind: FilterKind.AI_MATCH,
          description: "only reviews"
        },
        [OTHER_CHANNEL_ID]: {
          kind: FilterKind.AI_MATCH,
          description: "only  reviews"
        }
      }),
      channelVideos: CHANNEL_VIDEOS
    });
    expect(pruned).toEqual({
      [REVIEWS_KEY]: {
        aaaaaaaaaaa: true,
        ccccccccccc: false
      }
    });
  });

  it("keeps nothing once only RegExp filters are left", () => {
    const pruned = pruneAiVerdicts({
      aiVerdicts: {
        [REVIEWS_KEY]: {
          aaaaaaaaaaa: true
        }
      },
      subscriptions: createSubscriptions({
        [CHANNEL_ID]: {
          kind: FilterKind.REGEX,
          pattern: "",
          flags: "i"
        }
      }),
      channelVideos: CHANNEL_VIDEOS
    });
    expect(pruned).toEqual({});
  });
});

describe("pruneAiVerdicts across modes", () => {
  it("keeps the verdicts of both a channel's follow filter and its hide filter, whichever mode is on", () => {
    const aiVerdicts = {
      [REVIEWS_KEY]: {
        aaaaaaaaaaa: true
      },
      [TUTORIALS_KEY]: {
        aaaaaaaaaaa: false
      }
    };
    expect(
      pruneAiVerdicts({
        aiVerdicts,
        subscriptions: {
          [CHANNEL_ID]: {
            channelId: CHANNEL_ID,
            title: "Channel",
            followFilter: {
              kind: FilterKind.AI_MATCH,
              description: "only reviews"
            },
            hideFilter: {
              kind: FilterKind.AI_MATCH,
              description: "only tutorials"
            },
            createdAt: 0,
            isSubscribed: true
          }
        },
        channelVideos: CHANNEL_VIDEOS
      })
    ).toEqual(aiVerdicts);
  });
});

describe("countAiVerdicts", () => {
  it("counts verdicts across every key", () => {
    expect(
      countAiVerdicts({
        [REVIEWS_KEY]: {
          aaaaaaaaaaa: true,
          bbbbbbbbbbb: false
        },
        [TUTORIALS_KEY]: {
          aaaaaaaaaaa: true
        }
      })
    ).toBe(3);
  });
});
