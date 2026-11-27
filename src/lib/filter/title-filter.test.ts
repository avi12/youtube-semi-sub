import { describe, expect, it } from "vitest";

import { getAiFilterKey } from "@/lib/filter/ai-filter-key";
import type { AiVerdicts } from "@/lib/filter/ai-verdicts";
import {
  type AiFilter,
  DEFAULT_TITLE_FILTER,
  FilterKind,
  FilterMatch,
  MatchState,
  type RegexFilter,
  type TitleFilter,
  type VideoFilter,
  VideoType
} from "@/lib/filter/schema/video-filter-schema";
import {
  createSubscribedHideCheck,
  createVideoJudge,
  isFilterInert,
  selectFeedVideos,
  selectHiddenVideoIds
} from "@/lib/filter/title-filter";
import type { FeedVideo } from "@/lib/schemas/feed-video";
import type { SemiSubscriptions } from "@/lib/schemas/semi-subscription";
import { SubscriptionMode } from "@/lib/schemas/subscription-mode";

const CHANNEL_ID = "UCBJycsmduvYEL83R_U4JriQ";
const OTHER_CHANNEL_ID = "UCXuqSBlHAE6Xw-yeJA0Tunw";
const HOUR_MS = 3_600_000;

const AI_FILTER: AiFilter = {
  kind: FilterKind.AI_MATCH,
  description: "only reviews"
};

function createVideo({
  videoId,
  channelId,
  title,
  publishedAt
}: Pick<FeedVideo, "videoId" | "channelId" | "title" | "publishedAt">) {
  const video: FeedVideo = {
    videoId,
    channelId,
    title,
    publishedAt,
    channelTitle: "Channel",
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    isShort: false
  };
  return video;
}

function createSubscriptions(filter: TitleFilter | null) {
  const subscriptions: SemiSubscriptions = {
    [CHANNEL_ID]: {
      channelId: CHANNEL_ID,
      title: "Channel",
      followFilter: filter,
      createdAt: 0,
      hideFilter: DEFAULT_TITLE_FILTER,
      isSubscribed: false
    }
  };
  return subscriptions;
}

function createRegexSubscriptions(pattern: string) {
  return createSubscriptions({
    kind: FilterKind.REGEX,
    pattern,
    flags: "i"
  });
}

describe("createVideoJudge by length", () => {
  const upToTenMinutes: VideoFilter = {
    kind: FilterKind.LENGTH,
    maxSeconds: 600
  };

  function judgeLength({
    filter = upToTenMinutes,
    ...video
  }: Partial<Pick<FeedVideo, "durationSeconds" | "isShort">> & {
    filter?: VideoFilter;
  }) {
    return createVideoJudge({
      filter,
      aiVerdicts: {},
      isAiEnabled: false
    })?.({
      videoId: "aaaaaaaaaaa",
      title: "Video",
      ...video
    });
  }

  it("matches a video inside the range and rejects one outside it", () => {
    expect(judgeLength({ durationSeconds: 300 })).toBe(MatchState.MATCHES);
    expect(judgeLength({ durationSeconds: 601 })).toBe(MatchState.DOES_NOT_MATCH);
  });

  it("keeps a video of unknown length pending, unless it is a Short the range covers", () => {
    expect(judgeLength({})).toBe(MatchState.PENDING);
    expect(judgeLength({ isShort: true })).toBe(MatchState.MATCHES);
    expect(
      judgeLength({
        isShort: true,
        filter: {
          kind: FilterKind.LENGTH,
          minSeconds: 300
        }
      })
    ).toBe(MatchState.DOES_NOT_MATCH);
    expect(
      judgeLength({
        isShort: true,
        filter: {
          kind: FilterKind.LENGTH,
          maxSeconds: 60
        }
      })
    ).toBe(MatchState.PENDING);
  });
});

describe("createVideoJudge by upload type", () => {
  const noShortsOrStreams: VideoFilter = {
    kind: FilterKind.TYPE,
    types: [VideoType.VIDEO]
  };

  function judgeType(video: Partial<Pick<FeedVideo, "isShort" | "isLiveStream">>) {
    return createVideoJudge({
      filter: noShortsOrStreams,
      aiVerdicts: {},
      isAiEnabled: false
    })?.({
      videoId: "aaaaaaaaaaa",
      title: "Video",
      ...video
    });
  }

  it("keeps the picked types and rejects the rest", () => {
    expect(
      judgeType({
        isShort: false,
        isLiveStream: false
      })
    ).toBe(MatchState.MATCHES);
    expect(judgeType({ isShort: true })).toBe(MatchState.DOES_NOT_MATCH);
    expect(
      judgeType({
        isShort: false,
        isLiveStream: true
      })
    ).toBe(MatchState.DOES_NOT_MATCH);
  });

  it("keeps a video pending until a channel tab tells whether it is a live stream", () => {
    expect(judgeType({ isShort: false })).toBe(MatchState.PENDING);
  });

  it("leaves out a condition that picks every type", () => {
    expect(
      isFilterInert({
        filter: {
          kind: FilterKind.TYPE,
          types: Object.values(VideoType)
        },
        mode: SubscriptionMode.HIDE
      })
    ).toBe(true);
  });
});

describe("createVideoJudge with combined conditions", () => {
  function createGroup(match: FilterMatch) {
    const filter: VideoFilter = {
      kind: FilterKind.GROUP,
      match,
      conditions: [
        {
          kind: FilterKind.REGEX,
          pattern: "review",
          flags: "i"
        },
        {
          kind: FilterKind.LENGTH,
          maxSeconds: 600
        }
      ]
    };
    return filter;
  }

  function judge({
    match,
    title,
    durationSeconds
  }: Pick<FeedVideo, "title"> & {
    match: FilterMatch;
    durationSeconds?: number;
  }) {
    return createVideoJudge({
      filter: createGroup(match),
      aiVerdicts: {},
      isAiEnabled: false
    })?.({
      videoId: "aaaaaaaaaaa",
      title,
      durationSeconds
    });
  }

  it("needs every condition with all", () => {
    expect(
      judge({
        match: FilterMatch.ALL,
        title: "Phone review",
        durationSeconds: 300
      })
    ).toBe(MatchState.MATCHES);
    expect(
      judge({
        match: FilterMatch.ALL,
        title: "Phone review",
        durationSeconds: 900
      })
    ).toBe(MatchState.DOES_NOT_MATCH);
    expect(
      judge({
        match: FilterMatch.ALL,
        title: "Phone review"
      })
    ).toBe(MatchState.PENDING);
    expect(
      judge({
        match: FilterMatch.ALL,
        title: "Vlog"
      })
    ).toBe(MatchState.DOES_NOT_MATCH);
  });

  it("needs one condition with any", () => {
    expect(
      judge({
        match: FilterMatch.ANY,
        title: "Phone review"
      })
    ).toBe(MatchState.MATCHES);
    expect(
      judge({
        match: FilterMatch.ANY,
        title: "Vlog",
        durationSeconds: 300
      })
    ).toBe(MatchState.MATCHES);
    expect(
      judge({
        match: FilterMatch.ANY,
        title: "Vlog",
        durationSeconds: 900
      })
    ).toBe(MatchState.DOES_NOT_MATCH);
    expect(
      judge({
        match: FilterMatch.ANY,
        title: "Vlog"
      })
    ).toBe(MatchState.PENDING);
  });

  it("leaves out an empty pattern, so a hide filter hides by length alone", () => {
    const filter: VideoFilter = {
      kind: FilterKind.GROUP,
      match: FilterMatch.ANY,
      conditions: [
        DEFAULT_TITLE_FILTER,
        {
          kind: FilterKind.LENGTH,
          maxSeconds: 60
        }
      ]
    };
    expect(
      isFilterInert({
        filter,
        mode: SubscriptionMode.HIDE
      })
    ).toBe(false);
    expect(
      createVideoJudge({
        filter,
        aiVerdicts: {},
        isAiEnabled: false
      })?.({
        videoId: "aaaaaaaaaaa",
        title: "Anything",
        durationSeconds: 600
      })
    ).toBe(MatchState.DOES_NOT_MATCH);
  });

  it("counts a paused AI condition as pending beside a working one", () => {
    const filter: VideoFilter = {
      kind: FilterKind.GROUP,
      match: FilterMatch.ANY,
      conditions: [
        AI_FILTER,
        {
          kind: FilterKind.LENGTH,
          maxSeconds: 600
        }
      ]
    };
    const pausedJudge = createVideoJudge({
      filter,
      aiVerdicts: {},
      isAiEnabled: false
    });
    expect(
      pausedJudge?.({
        videoId: "aaaaaaaaaaa",
        title: "Vlog",
        durationSeconds: 300
      })
    ).toBe(MatchState.MATCHES);
    expect(
      pausedJudge?.({
        videoId: "aaaaaaaaaaa",
        title: "Vlog",
        durationSeconds: 900
      })
    ).toBe(MatchState.PENDING);
  });
});

describe("isFilterInert", () => {
  it("leaves the feed alone in either mode while the filter was never set", () => {
    expect(
      isFilterInert({
        filter: null,
        mode: SubscriptionMode.FOLLOW
      })
    ).toBe(true);
    expect(
      isFilterInert({
        filter: null,
        mode: SubscriptionMode.HIDE
      })
    ).toBe(true);
  });

  it("reads an empty pattern as the whole channel: hiding nothing, and following every video", () => {
    expect(
      isFilterInert({
        filter: DEFAULT_TITLE_FILTER,
        mode: SubscriptionMode.HIDE
      })
    ).toBe(true);
    expect(
      isFilterInert({
        filter: DEFAULT_TITLE_FILTER,
        mode: SubscriptionMode.FOLLOW
      })
    ).toBe(false);
  });

  it("acts on a pattern or an AI description in either mode", () => {
    for (const mode of [SubscriptionMode.FOLLOW, SubscriptionMode.HIDE]) {
      expect(
        isFilterInert({
          filter: AI_FILTER,
          mode
        })
      ).toBe(false);
    }
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

  it("leaves a members-only video out unless the user is a member", () => {
    const membersOnly = {
      ...createVideo({
        videoId: "ddddddddddd",
        channelId: CHANNEL_ID,
        title: "Members review",
        publishedAt: 4 * HOUR_MS
      }),
      isMembersOnly: true
    };
    function select(isMember: boolean) {
      const subscriptions = createRegexSubscriptions("review");
      for (const subscription of Object.values(subscriptions)) {
        subscription.isMember = isMember;
      }
      return selectFeedVideos({
        subscriptions,
        videosByChannel: {
          [CHANNEL_ID]: [membersOnly]
        },
        ...noAi
      }).map(video => video.videoId);
    }
    expect(select(false)).toEqual([]);
    expect(select(true)).toEqual(["ddddddddddd"]);
  });

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

  it("adds nothing while the follow filter was never set - a channel first saved while subscribed", () => {
    const selected = selectFeedVideos({
      subscriptions: createSubscriptions(null),
      videosByChannel: {
        [CHANNEL_ID]: videos
      },
      ...noAi
    });
    expect(selected).toEqual([]);
  });

  it("adds nothing from a channel the user is subscribed to", () => {
    const selected = selectFeedVideos({
      subscriptions: {
        [CHANNEL_ID]: {
          channelId: CHANNEL_ID,
          title: "Channel",
          followFilter: {
            kind: FilterKind.REGEX,
            pattern: "",
            flags: ""
          },
          createdAt: 0,
          hideFilter: DEFAULT_TITLE_FILTER,
          isSubscribed: true
        }
      },
      videosByChannel: {
        [CHANNEL_ID]: videos
      },
      ...noAi
    });
    expect(selected).toEqual([]);
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
          kind: FilterKind.AI_MATCH,
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

describe("selectHiddenVideoIds", () => {
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
      title: "Livestream",
      publishedAt: 3 * HOUR_MS
    })
  ];
  const videosByChannel = {
    [CHANNEL_ID]: videos
  };

  function subscribedWith(hideFilter: TitleFilter | null) {
    const subscriptions: SemiSubscriptions = {
      [CHANNEL_ID]: {
        channelId: CHANNEL_ID,
        title: "Channel",
        followFilter: DEFAULT_TITLE_FILTER,
        hideFilter,
        createdAt: 0,
        isSubscribed: true
      }
    };
    return subscriptions;
  }

  it("hides a subscribed channel's uploads whose title its hide filter matches", () => {
    expect(
      selectHiddenVideoIds({
        subscriptions: subscribedWith({
          kind: FilterKind.REGEX,
          pattern: "vlog|live",
          flags: "i"
        }),
        videosByChannel,
        aiVerdicts: {},
        isAiEnabled: false
      })
    ).toEqual(["bbbbbbbbbbb", "ccccccccccc"]);
  });

  it("hides nothing with an empty hide filter, though an empty follow filter lets everything through", () => {
    expect(
      selectHiddenVideoIds({
        subscriptions: subscribedWith(DEFAULT_TITLE_FILTER),
        videosByChannel,
        aiVerdicts: {},
        isAiEnabled: false
      })
    ).toEqual([]);
  });

  it("hides nothing while the hide filter was never set", () => {
    expect(
      selectHiddenVideoIds({
        subscriptions: subscribedWith(null),
        videosByChannel,
        aiVerdicts: {},
        isAiEnabled: false
      })
    ).toEqual([]);
  });

  it("hides nothing from a channel the user follows without subscribing", () => {
    expect(
      selectHiddenVideoIds({
        subscriptions: createRegexSubscriptions("review"),
        videosByChannel,
        aiVerdicts: {},
        isAiEnabled: false
      })
    ).toEqual([]);
  });

  it("hides on a true AI verdict only - a pending video stays, and so does everything while AI match is off", () => {
    const aiVerdicts: AiVerdicts = {
      [getAiFilterKey(AI_FILTER)]: {
        aaaaaaaaaaa: true,
        bbbbbbbbbbb: false
      }
    };
    expect(
      selectHiddenVideoIds({
        subscriptions: subscribedWith(AI_FILTER),
        videosByChannel,
        aiVerdicts,
        isAiEnabled: true
      })
    ).toEqual(["aaaaaaaaaaa"]);
    expect(
      selectHiddenVideoIds({
        subscriptions: subscribedWith(AI_FILTER),
        videosByChannel,
        aiVerdicts,
        isAiEnabled: false
      })
    ).toEqual([]);
  });
});

describe("createSubscribedHideCheck", () => {
  const context = {
    aiVerdicts: {},
    isAiEnabled: false
  };
  const tutorials: RegexFilter = {
    kind: FilterKind.REGEX,
    pattern: "tutorial",
    flags: "i"
  };

  it("hides what a subscribed channel's Allow list does not let through", () => {
    const isHidden = createSubscribedHideCheck({
      subscription: {
        followFilter: tutorials,
        hideFilter: null,
        isSubscribed: true
      },
      ...context
    });
    expect(
      isHidden?.({
        videoId: "a",
        title: "A tutorial"
      })
    ).toBe(false);
    expect(
      isHidden?.({
        videoId: "b",
        title: "Vlog"
      })
    ).toBe(true);
  });

  it("does nothing for a channel the user isn't subscribed to", () => {
    expect(
      createSubscribedHideCheck({
        subscription: {
          followFilter: tutorials,
          hideFilter: null,
          isSubscribed: false
        },
        ...context
      })
    ).toBeNull();
  });

  it("restricts nothing with an empty Allow list", () => {
    expect(
      createSubscribedHideCheck({
        subscription: {
          followFilter: DEFAULT_TITLE_FILTER,
          hideFilter: null,
          isSubscribed: true
        },
        ...context
      })
    ).toBeNull();
  });
});
