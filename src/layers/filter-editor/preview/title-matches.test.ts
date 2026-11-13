import { describe, expect, it } from "vitest";

import { getAiFilterKey } from "@/lib/filter/ai-filter-key";
import { type AiFilter, FilterKind, FilterMatch, MatchState, type RegexFilter } from "@/lib/filter/title-filter";
import type { FeedVideo } from "@/lib/schemas/feed-video";
import { SubscriptionMode } from "@/lib/schemas/subscription-mode";

import { getReadableFilterError, highlightMatches, partitionPreviewRows, previewVideoFilter } from "./title-matches";

const CHANNEL_ID = "UC0123456789abcdefghijkl";

function previewTitleFilter({
  filter,
  videos,
  mode
}: Pick<Parameters<typeof previewVideoFilter>[0], "videos" | "mode"> & {
  filter: RegexFilter;
}) {
  return previewVideoFilter({
    filter,
    videos,
    mode,
    aiVerdicts: {},
    isAiEnabled: false
  });
}

function previewAiFilter(options: Omit<Parameters<typeof previewVideoFilter>[0], "mode">) {
  return previewVideoFilter({
    ...options,
    mode: SubscriptionMode.FOLLOW
  });
}

function createVideo({ videoId, title }: { videoId: string; title: string }) {
  const video: FeedVideo = {
    videoId,
    channelId: CHANNEL_ID,
    channelTitle: "Channel",
    title,
    publishedAt: 0,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    isShort: false
  };
  return video;
}

describe("highlightMatches", () => {
  it("splits a title around every match", () => {
    expect(
      highlightMatches({
        title: "Rust tips and more rust",
        regex: /rust/i
      })
    ).toEqual([
      {
        text: "Rust",
        isHighlighted: true
      },
      {
        text: " tips and more ",
        isHighlighted: false
      },
      {
        text: "rust",
        isHighlighted: true
      }
    ]);
  });

  it("returns the whole title as plain text when nothing matches", () => {
    expect(
      highlightMatches({
        title: "Cooking show",
        regex: /rust/
      })
    ).toEqual([
      {
        text: "Cooking show",
        isHighlighted: false
      }
    ]);
  });

  it("skips zero-width matches instead of looping forever", () => {
    expect(
      highlightMatches({
        title: "abc",
        regex: /x*/
      })
    ).toEqual([
      {
        text: "abc",
        isHighlighted: false
      }
    ]);
  });

  it("keeps astral characters whole with the u flag", () => {
    expect(
      highlightMatches({
        title: "Live 🔴 now",
        regex: /\p{Extended_Pictographic}/u
      })
    ).toEqual([
      {
        text: "Live ",
        isHighlighted: false
      },
      {
        text: "🔴",
        isHighlighted: true
      },
      {
        text: " now",
        isHighlighted: false
      }
    ]);
  });

  it("highlights right-to-left titles", () => {
    expect(
      highlightMatches({
        title: "שיעור 5 - מבוא",
        regex: /שיעור \d+/
      })
    ).toEqual([
      {
        text: "שיעור 5",
        isHighlighted: true
      },
      {
        text: " - מבוא",
        isHighlighted: false
      }
    ]);
  });
});

describe("previewTitleFilter", () => {
  const videos = [
    createVideo({
      videoId: "aaaaaaaaaaa",
      title: "Svelte 5 tutorial"
    }),
    createVideo({
      videoId: "bbbbbbbbbbb",
      title: "Vlog"
    }),
    createVideo({
      videoId: "ccccccccccc",
      title: "TUTORIAL: runes"
    })
  ];

  it("counts the videos the filter lets through", () => {
    const preview = previewTitleFilter({
      filter: {
        kind: FilterKind.REGEX,
        pattern: "tutorial",
        flags: "i"
      },
      videos,
      mode: SubscriptionMode.FOLLOW
    });
    expect(preview.isValid).toBe(true);
    expect(preview.shownRows.map(row => row.video.videoId)).toEqual(["aaaaaaaaaaa", "ccccccccccc"]);
    expect(preview.hiddenRows.map(row => row.video.videoId)).toEqual(["bbbbbbbbbbb"]);
    expect(preview.shownCount).toBe(2);
    expect(preview.pendingCount).toBe(0);
  });

  it("lets every video through with an empty pattern", () => {
    const preview = previewTitleFilter({
      filter: {
        kind: FilterKind.REGEX,
        pattern: "",
        flags: ""
      },
      videos,
      mode: SubscriptionMode.FOLLOW
    });
    expect(preview.shownCount).toBe(videos.length);
    expect(preview.shownRows[1]?.segments).toEqual([
      {
        text: "Vlog",
        isHighlighted: false
      }
    ]);
  });

  it("matches nothing while the pattern is invalid", () => {
    const preview = previewTitleFilter({
      filter: {
        kind: FilterKind.REGEX,
        pattern: "(",
        flags: "i"
      },
      videos,
      mode: SubscriptionMode.FOLLOW
    });
    expect(preview.isValid).toBe(false);
    expect(preview.shownRows).toHaveLength(0);
    expect(preview.hiddenRows).toHaveLength(0);
  });

  it("highlights the pattern of a filter combined with a length", () => {
    const preview = previewVideoFilter({
      filter: {
        kind: FilterKind.GROUP,
        match: FilterMatch.ALL,
        conditions: [
          {
            kind: FilterKind.REGEX,
            pattern: "tutorial",
            flags: "i"
          },
          {
            kind: FilterKind.LENGTH,
            maxSeconds: 600
          }
        ]
      },
      videos: videos.map((video, i) => ({
        ...video,
        durationSeconds: i === 0 ? 300 : 900
      })),
      mode: SubscriptionMode.FOLLOW,
      aiVerdicts: {},
      isAiEnabled: false
    });
    expect(preview.shownCount).toBe(1);
    expect(preview.shownRows[0]?.segments.some(segment => segment.isHighlighted)).toBe(true);
  });
});

describe("previewTitleFilter in hide mode", () => {
  const videos = [
    createVideo({
      videoId: "aaaaaaaaaaa",
      title: "Live: Q&A"
    }),
    createVideo({
      videoId: "bbbbbbbbbbb",
      title: "Review"
    })
  ];

  it("shows the videos it leaves alone, and lists the ones it hides apart", () => {
    const preview = previewTitleFilter({
      filter: {
        kind: FilterKind.REGEX,
        pattern: "^live",
        flags: "i"
      },
      videos,
      mode: SubscriptionMode.HIDE
    });
    expect(preview.shownRows.map(row => row.video.videoId)).toEqual(["bbbbbbbbbbb"]);
    expect(preview.hiddenRows.map(row => row.video.videoId)).toEqual(["aaaaaaaaaaa"]);
  });

  it("hides nothing with an empty pattern, and still counts as valid", () => {
    const preview = previewTitleFilter({
      filter: {
        kind: FilterKind.REGEX,
        pattern: "",
        flags: "i"
      },
      videos,
      mode: SubscriptionMode.HIDE
    });
    expect(preview.isValid).toBe(true);
    expect(preview.shownCount).toBe(videos.length);
    expect(preview.hiddenRows).toHaveLength(0);
  });
});

describe("previewAiFilter", () => {
  const filter: AiFilter = {
    kind: FilterKind.AI_MATCH,
    description: "only tutorials"
  };
  const videos = [
    createVideo({
      videoId: "aaaaaaaaaaa",
      title: "Svelte 5 tutorial"
    }),
    createVideo({
      videoId: "bbbbbbbbbbb",
      title: "Vlog"
    }),
    createVideo({
      videoId: "ccccccccccc",
      title: "Runes deep dive"
    })
  ];
  const aiVerdicts = {
    [getAiFilterKey(filter)]: {
      aaaaaaaaaaa: true,
      bbbbbbbbbbb: false
    }
  };

  it("shows matches and pending videos in the feed, judged ones that don't fit as skipped", () => {
    const preview = previewAiFilter({
      filter,
      videos,
      aiVerdicts,
      isAiEnabled: true
    });
    expect(preview.isValid).toBe(true);
    expect(preview.shownRows.map(row => [row.video.videoId, row.matchState])).toEqual([
      ["aaaaaaaaaaa", MatchState.MATCHES],
      ["ccccccccccc", MatchState.PENDING]
    ]);
    expect(preview.hiddenRows.map(row => row.video.videoId)).toEqual(["bbbbbbbbbbb"]);
    expect(preview.shownCount).toBe(1);
    expect(preview.pendingCount).toBe(1);
  });

  it.each([
    ["AI match is off", filter, false],
    [
      "the description is blank",
      {
        kind: FilterKind.AI_MATCH,
        description: " "
      },
      true
    ]
  ] satisfies [string, AiFilter, boolean][])("judges nothing while %s", (_reason, previewedFilter, isAiEnabled) => {
    const preview = previewAiFilter({
      filter: previewedFilter,
      videos,
      aiVerdicts,
      isAiEnabled
    });
    expect(preview.isValid).toBe(false);
    expect(preview.shownRows).toEqual([]);
    expect(preview.hiddenRows).toEqual([]);
  });
});

describe("partitionPreviewRows", () => {
  const rows = [
    {
      video: createVideo({
        videoId: "aaaaaaaaaaa",
        title: "Pending"
      }),
      matchState: MatchState.PENDING,
      segments: []
    },
    {
      video: createVideo({
        videoId: "bbbbbbbbbbb",
        title: "Skipped"
      }),
      matchState: MatchState.DOES_NOT_MATCH,
      segments: []
    },
    {
      video: createVideo({
        videoId: "ccccccccccc",
        title: "Matching"
      }),
      matchState: MatchState.MATCHES,
      segments: []
    }
  ];

  it("keeps pending videos in the feed but out of the shown count", () => {
    const partition = partitionPreviewRows({
      rows,
      mode: SubscriptionMode.FOLLOW
    });
    expect(partition.shownRows.map(row => row.matchState)).toEqual([MatchState.PENDING, MatchState.MATCHES]);
    expect(partition.hiddenRows.map(row => row.matchState)).toEqual([MatchState.DOES_NOT_MATCH]);
    expect(partition.shownCount).toBe(1);
    expect(partition.pendingCount).toBe(1);
  });

  it("shows what a hide filter doesn't match, and keeps a pending video until it is judged", () => {
    const partition = partitionPreviewRows({
      rows,
      mode: SubscriptionMode.HIDE
    });
    expect(partition.shownRows.map(row => row.matchState)).toEqual([MatchState.PENDING, MatchState.DOES_NOT_MATCH]);
    expect(partition.hiddenRows.map(row => row.matchState)).toEqual([MatchState.MATCHES]);
  });
});

describe("getReadableFilterError", () => {
  it("returns null for a valid filter", () => {
    expect(
      getReadableFilterError({
        kind: FilterKind.REGEX,
        pattern: "a|b",
        flags: "i"
      })
    ).toBeNull();
  });

  it("drops V8's echo of the pattern", () => {
    expect(
      getReadableFilterError({
        kind: FilterKind.REGEX,
        pattern: "a/(",
        flags: "i"
      })
    ).toBe("Unterminated group");
  });

  it("reports conflicting flags", () => {
    expect(
      getReadableFilterError({
        kind: FilterKind.REGEX,
        pattern: "a",
        flags: "uv"
      })
    ).toBeTruthy();
  });
});
