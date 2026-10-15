import {
  getReadableFilterError,
  highlightMatches,
  MatchState,
  partitionPreviewRows,
  previewTitleFilter
} from "./title-matches";
import type { FeedVideo } from "@/lib/schemas/feed-video";
import { describe, expect, it } from "vitest";

const CHANNEL_ID = "UC0123456789abcdefghijkl";

function createVideo({ videoId, title }: {
  videoId: string;
  title: string;
}) {
  const video: FeedVideo = {
    videoId,
    channelId: CHANNEL_ID,
    channelTitle: "Channel",
    title,
    publishedAt: 0,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
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
    ).toEqual([{
      text: "Cooking show",
      isHighlighted: false
    }]);
  });

  it("skips zero-width matches instead of looping forever", () => {
    expect(
      highlightMatches({
        title: "abc",
        regex: /x*/
      })
    ).toEqual([{
      text: "abc",
      isHighlighted: false
    }]);
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
        pattern: "tutorial",
        flags: "i"
      },
      videos
    });
    expect(preview.isValid).toBe(true);
    expect(preview.feedRows.map(row => row.video.videoId)).toEqual(["aaaaaaaaaaa", "ccccccccccc"]);
    expect(preview.skippedRows.map(row => row.video.videoId)).toEqual(["bbbbbbbbbbb"]);
    expect(preview.matchCount).toBe(2);
    expect(preview.pendingCount).toBe(0);
  });

  it("lets every video through with an empty pattern", () => {
    const preview = previewTitleFilter({
      filter: {
        pattern: "",
        flags: ""
      },
      videos
    });
    expect(preview.matchCount).toBe(videos.length);
    expect(preview.feedRows[1]?.segments).toEqual([{
      text: "Vlog",
      isHighlighted: false
    }]);
  });

  it("matches nothing while the pattern is invalid", () => {
    const preview = previewTitleFilter({
      filter: {
        pattern: "(",
        flags: "i"
      },
      videos
    });
    expect(preview.isValid).toBe(false);
    expect(preview.feedRows).toHaveLength(0);
    expect(preview.skippedRows).toHaveLength(videos.length);
  });
});

describe("partitionPreviewRows", () => {
  it("keeps pending videos in the feed but out of the match count", () => {
    const partition = partitionPreviewRows([
      {
        video: createVideo({
          videoId: "aaaaaaaaaaa",
          title: "Pending"
        }),
        matchState: MatchState.pending,
        segments: []
      },
      {
        video: createVideo({
          videoId: "bbbbbbbbbbb",
          title: "Skipped"
        }),
        matchState: MatchState.doesNotMatch,
        segments: []
      },
      {
        video: createVideo({
          videoId: "ccccccccccc",
          title: "Matching"
        }),
        matchState: MatchState.matches,
        segments: []
      }
    ]);
    expect(partition.feedRows.map(row => row.matchState)).toEqual([MatchState.pending, MatchState.matches]);
    expect(partition.skippedRows).toHaveLength(1);
    expect(partition.matchCount).toBe(1);
    expect(partition.pendingCount).toBe(1);
  });
});

describe("getReadableFilterError", () => {
  it("returns null for a valid filter", () => {
    expect(
      getReadableFilterError({
        pattern: "a|b",
        flags: "i"
      })
    ).toBeNull();
  });

  it("drops V8's echo of the pattern", () => {
    expect(
      getReadableFilterError({
        pattern: "a/(",
        flags: "i"
      })
    ).toBe("Unterminated group");
  });

  it("reports conflicting flags", () => {
    expect(
      getReadableFilterError({
        pattern: "a",
        flags: "uv"
      })
    ).toBeTruthy();
  });
});
