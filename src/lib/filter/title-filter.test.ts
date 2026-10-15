import { getAiFilterKey } from "@/lib/filter/ai-filter-key";
import type { AiVerdicts } from "@/lib/filter/ai-verdicts";
import {
  type AiFilter,
  compileTitleFilter,
  FilterKind,
  getTitleFilterError,
  isTitleFilterValid,
  selectFeedVideos,
  type TitleFilter
} from "@/lib/filter/title-filter";
import type { FeedVideo } from "@/lib/schemas/feed-video";
import type { SemiSubscriptions } from "@/lib/schemas/semi-subscription";
import { describe, expect, it } from "vitest";

const CHANNEL_ID = "UCBJycsmduvYEL83R_U4JriQ";
const OTHER_CHANNEL_ID = "UCXuqSBlHAE6Xw-yeJA0Tunw";
const HOUR_MS = 3_600_000;

const AI_FILTER: AiFilter = {
  kind: FilterKind.aiMatch,
  description: "only reviews"
};

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

function createSubscriptions(filter: TitleFilter) {
  const subscriptions: SemiSubscriptions = {
    [CHANNEL_ID]: {
      channelId: CHANNEL_ID,
      title: "Channel",
      filter,
      createdAt: 0
    }
  };
  return subscriptions;
}

function createRegexSubscriptions(pattern: string) {
  return createSubscriptions({
    kind: FilterKind.regex,
    pattern,
    flags: "i"
  });
}

describe("compileTitleFilter", () => {
  it("compiles a valid pattern", () => {
    expect(
      compileTitleFilter({
        kind: FilterKind.regex,
        pattern: "review",
        flags: "i"
      })?.test("iPhone REVIEW")
    ).toBe(true);
  });

  it("rejects an invalid pattern", () => {
    expect(
      compileTitleFilter({
        kind: FilterKind.regex,
        pattern: "(",
        flags: ""
      })
    ).toBeNull();
  });

  it("rejects stateful flags", () => {
    expect(
      compileTitleFilter({
        kind: FilterKind.regex,
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
        kind: FilterKind.regex,
        pattern: "a|b",
        flags: "i"
      })
    ).toBeNull();
  });

  it("describes an invalid pattern", () => {
    expect(
      getTitleFilterError({
        kind: FilterKind.regex,
        pattern: "[",
        flags: ""
      })
    ).toEqual(expect.any(String));
  });
});

describe("isTitleFilterValid", () => {
  it.each([
    [AI_FILTER, true],
    [{
      kind: FilterKind.aiMatch,
      description: "   "
    }, false],
    [{
      kind: FilterKind.aiMatch,
      description: "x".repeat(301)
    }, false],
    [{
      kind: FilterKind.regex,
      pattern: "(",
      flags: ""
    }, false]
  ] satisfies [TitleFilter, boolean][])("judges %j as valid: %s", (filter, isValid) => {
    expect(isTitleFilterValid(filter)).toBe(isValid);
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
  const noAi = {
    aiVerdicts: {},
    isAiEnabled: false
  };

  it("keeps only matching videos, newest first", () => {
    const selected = selectFeedVideos({
      subscriptions: createRegexSubscriptions("review"),
      videosByChannel: {
        [CHANNEL_ID]: videos
      },
      ...noAi
    });
    expect(selected.map(video => video.videoId)).toEqual(["ccccccccccc", "aaaaaaaaaaa"]);
  });

  it("treats an empty pattern as every video", () => {
    const selected = selectFeedVideos({
      subscriptions: createRegexSubscriptions(""),
      videosByChannel: {
        [CHANNEL_ID]: videos
      },
      ...noAi
    });
    expect(selected).toHaveLength(videos.length);
  });

  it("ignores channels without a semi-subscription", () => {
    const selected = selectFeedVideos({
      subscriptions: createRegexSubscriptions(""),
      videosByChannel: {
        [OTHER_CHANNEL_ID]: [
          createVideo({
            videoId: "ddddddddddd",
            channelId: OTHER_CHANNEL_ID,
            title: "Other",
            publishedAt: HOUR_MS
          })
        ]
      },
      ...noAi
    });
    expect(selected).toEqual([]);
  });

  it("skips a channel whose filter no longer compiles", () => {
    const selected = selectFeedVideos({
      subscriptions: createRegexSubscriptions("("),
      videosByChannel: {
        [CHANNEL_ID]: videos
      },
      ...noAi
    });
    expect(selected).toEqual([]);
  });

  describe("with an AI filter", () => {
    const aiVerdicts: AiVerdicts = {
      [getAiFilterKey(AI_FILTER)]: {
        aaaaaaaaaaa: true,
        bbbbbbbbbbb: false
      }
    };

    it("inserts a video only on a true verdict - a false one and a pending one stay out", () => {
      const selected = selectFeedVideos({
        subscriptions: createSubscriptions(AI_FILTER),
        videosByChannel: {
          [CHANNEL_ID]: videos
        },
        aiVerdicts,
        isAiEnabled: true
      });
      expect(selected.map(video => video.videoId)).toEqual(["aaaaaaaaaaa"]);
    });

    it("reads verdicts by the normalized description", () => {
      const selected = selectFeedVideos({
        subscriptions: createSubscriptions({
          kind: FilterKind.aiMatch,
          description: "  only   reviews "
        }),
        videosByChannel: {
          [CHANNEL_ID]: videos
        },
        aiVerdicts,
        isAiEnabled: true
      });
      expect(selected.map(video => video.videoId)).toEqual(["aaaaaaaaaaa"]);
    });

    it("pauses while AI match is off, even with verdicts at hand", () => {
      const selected = selectFeedVideos({
        subscriptions: createSubscriptions(AI_FILTER),
        videosByChannel: {
          [CHANNEL_ID]: videos
        },
        aiVerdicts,
        isAiEnabled: false
      });
      expect(selected).toEqual([]);
    });
  });
});
