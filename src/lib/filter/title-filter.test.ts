import { getAiFilterKey } from "@/lib/filter/ai-filter-key";
import type { AiVerdicts } from "@/lib/filter/ai-verdicts";
import {
  type AiFilter,
  buildVideoFilter,
  compileTitleFilter,
  createSubscribedHideCheck,
  createVideoJudge,
  DEFAULT_TITLE_FILTER,
  FilterKind,
  FilterMatch,
  getTitleFilterError,
  isFilterInert,
  isVideoFilterValid,
  MatchState,
  type RegexFilter,
  selectFeedVideos,
  selectHiddenVideoIds,
  type TitleFilter,
  type VideoFilter,
  VideoType
} from "@/lib/filter/title-filter";
import type { FeedVideo } from "@/lib/schemas/feed-video";
import type { SemiSubscriptions } from "@/lib/schemas/semi-subscription";
import { SubscriptionMode } from "@/lib/schemas/subscription-mode";
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

  it("explains a flag that would make the filter stateful, as compileTitleFilter refuses it", () => {
    const filter = {
      kind: FilterKind.regex,
      pattern: "review",
      flags: "g"
    } as const;
    expect(compileTitleFilter(filter)).toBeNull();
    expect(getTitleFilterError(filter)).toEqual(expect.stringContaining("flags"));
  });
});

describe("isVideoFilterValid", () => {
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
    }, false],
    [{
      kind: FilterKind.length,
      maxSeconds: 600
    }, true],
    [{
      kind: FilterKind.length
    }, false],
    [{
      kind: FilterKind.length,
      minSeconds: 600,
      maxSeconds: 60
    }, false],
    [{
      kind: FilterKind.group,
      match: FilterMatch.any,
      conditions: []
    }, false]
  ] satisfies [VideoFilter, boolean][])("judges %j as valid: %s", (filter, isValid) => {
    expect(isVideoFilterValid(filter)).toBe(isValid);
  });
});

describe("createVideoJudge by length", () => {
  const UP_TO_TEN_MINUTES: VideoFilter = {
    kind: FilterKind.length,
    maxSeconds: 600
  };

  function judgeLength({ filter = UP_TO_TEN_MINUTES, ...video }: Partial<Pick<FeedVideo, "durationSeconds" | "isShort">> & {
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
    expect(judgeLength({ durationSeconds: 300 })).toBe(MatchState.matches);
    expect(judgeLength({ durationSeconds: 601 })).toBe(MatchState.doesNotMatch);
  });

  it("keeps a video of unknown length pending, unless it is a Short the range covers", () => {
    expect(judgeLength({})).toBe(MatchState.pending);
    expect(judgeLength({ isShort: true })).toBe(MatchState.matches);
    expect(
      judgeLength({
        isShort: true,
        filter: {
          kind: FilterKind.length,
          minSeconds: 300
        }
      })
    ).toBe(MatchState.doesNotMatch);
    expect(
      judgeLength({
        isShort: true,
        filter: {
          kind: FilterKind.length,
          maxSeconds: 60
        }
      })
    ).toBe(MatchState.pending);
  });
});

describe("createVideoJudge by upload type", () => {
  const NO_SHORTS_OR_STREAMS: VideoFilter = {
    kind: FilterKind.type,
    types: [VideoType.video]
  };

  function judgeType(video: Partial<Pick<FeedVideo, "isShort" | "isLiveStream">>) {
    return createVideoJudge({
      filter: NO_SHORTS_OR_STREAMS,
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
    ).toBe(MatchState.matches);
    expect(judgeType({ isShort: true })).toBe(MatchState.doesNotMatch);
    expect(
      judgeType({
        isShort: false,
        isLiveStream: true
      })
    ).toBe(MatchState.doesNotMatch);
  });

  it("keeps a video pending until a channel tab tells whether it is a live stream", () => {
    expect(judgeType({ isShort: false })).toBe(MatchState.pending);
  });

  it("leaves out a condition that picks every type", () => {
    expect(
      isFilterInert({
        filter: {
          kind: FilterKind.type,
          types: Object.values(VideoType)
        },
        mode: SubscriptionMode.hide
      })
    ).toBe(true);
  });
});

describe("createVideoJudge with combined conditions", () => {
  function createGroup(match: FilterMatch) {
    const filter: VideoFilter = {
      kind: FilterKind.group,
      match,
      conditions: [{
        kind: FilterKind.regex,
        pattern: "review",
        flags: "i"
      }, {
        kind: FilterKind.length,
        maxSeconds: 600
      }]
    };
    return filter;
  }

  function judge({ match, title, durationSeconds }: Pick<FeedVideo, "title"> & {
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
        match: FilterMatch.all,
        title: "Phone review",
        durationSeconds: 300
      })
    ).toBe(MatchState.matches);
    expect(
      judge({
        match: FilterMatch.all,
        title: "Phone review",
        durationSeconds: 900
      })
    ).toBe(MatchState.doesNotMatch);
    expect(
      judge({
        match: FilterMatch.all,
        title: "Phone review"
      })
    ).toBe(MatchState.pending);
    expect(
      judge({
        match: FilterMatch.all,
        title: "Vlog"
      })
    ).toBe(MatchState.doesNotMatch);
  });

  it("needs one condition with any", () => {
    expect(
      judge({
        match: FilterMatch.any,
        title: "Phone review"
      })
    ).toBe(MatchState.matches);
    expect(
      judge({
        match: FilterMatch.any,
        title: "Vlog",
        durationSeconds: 300
      })
    ).toBe(MatchState.matches);
    expect(
      judge({
        match: FilterMatch.any,
        title: "Vlog",
        durationSeconds: 900
      })
    ).toBe(MatchState.doesNotMatch);
    expect(
      judge({
        match: FilterMatch.any,
        title: "Vlog"
      })
    ).toBe(MatchState.pending);
  });

  it("leaves out an empty pattern, so a hide filter hides by length alone", () => {
    const filter: VideoFilter = {
      kind: FilterKind.group,
      match: FilterMatch.any,
      conditions: [DEFAULT_TITLE_FILTER, {
        kind: FilterKind.length,
        maxSeconds: 60
      }]
    };
    expect(
      isFilterInert({
        filter,
        mode: SubscriptionMode.hide
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
    ).toBe(MatchState.doesNotMatch);
  });

  it("counts a paused AI condition as pending beside a working one", () => {
    const filter: VideoFilter = {
      kind: FilterKind.group,
      match: FilterMatch.any,
      conditions: [AI_FILTER, {
        kind: FilterKind.length,
        maxSeconds: 600
      }]
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
    ).toBe(MatchState.matches);
    expect(
      pausedJudge?.({
        videoId: "aaaaaaaaaaa",
        title: "Vlog",
        durationSeconds: 900
      })
    ).toBe(MatchState.pending);
  });
});

describe("buildVideoFilter", () => {
  it("stores a single condition bare and groups several", () => {
    expect(
      buildVideoFilter({
        conditions: [AI_FILTER],
        match: FilterMatch.any
      })
    ).toEqual(AI_FILTER);
    expect(
      buildVideoFilter({
        conditions: [AI_FILTER, DEFAULT_TITLE_FILTER],
        match: FilterMatch.any
      })
    ).toEqual({
      kind: FilterKind.group,
      match: FilterMatch.any,
      conditions: [AI_FILTER, DEFAULT_TITLE_FILTER]
    });
  });
});

describe("isFilterInert", () => {
  it("leaves the feed alone in either mode while the filter was never set", () => {
    expect(
      isFilterInert({
        filter: null,
        mode: SubscriptionMode.follow
      })
    ).toBe(true);
    expect(
      isFilterInert({
        filter: null,
        mode: SubscriptionMode.hide
      })
    ).toBe(true);
  });

  it("reads an empty pattern as the whole channel: hiding nothing, and following every video", () => {
    expect(
      isFilterInert({
        filter: DEFAULT_TITLE_FILTER,
        mode: SubscriptionMode.hide
      })
    ).toBe(true);
    expect(
      isFilterInert({
        filter: DEFAULT_TITLE_FILTER,
        mode: SubscriptionMode.follow
      })
    ).toBe(false);
  });

  it("acts on a pattern or an AI description in either mode", () => {
    for (const mode of [SubscriptionMode.follow, SubscriptionMode.hide]) {
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
            kind: FilterKind.regex,
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
          kind: FilterKind.regex,
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
    kind: FilterKind.regex,
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
