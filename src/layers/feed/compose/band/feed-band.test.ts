import { describe, expect, it } from "vitest";

import { AnchorSide } from "#feed/compose/feed-slot";
import {
  contextRendererItem,
  continuationItem,
  desktopFeedItem,
  feedVideo,
  NOW,
  shortsShelf,
  videoId
} from "#feed/fixtures/feed-fixtures";
import { videoIdFromGridItem } from "#feed/items/feed-items";
import type { FeedVideo } from "@/lib/schemas/feed-video";

import { findInlineRuns, planFeedBand, reflowBandIntoRuns } from "./feed-band";

const NO_REMOVALS = new Set<string>();

// Band: 1 (1h) 2 (3h) | Shorts shelf | 3 (1d) 4 (3d) | continuation
function feedContents() {
  return [
    desktopFeedItem({
      index: 1,
      published: "1 hour ago"
    }),
    desktopFeedItem({
      index: 2,
      published: "3 hours ago"
    }),
    shortsShelf([90, 91]),
    desktopFeedItem({
      index: 3,
      published: "1 day ago"
    }),
    desktopFeedItem({
      index: 4,
      published: "3 days ago"
    }),
    continuationItem()
  ];
}

function plan({
  contents = feedContents(),
  videos,
  removedVideoIds = NO_REMOVALS
}: {
  contents?: unknown[];
  videos: FeedVideo[];
  removedVideoIds?: ReadonlySet<string>;
}) {
  return planFeedBand({
    contents,
    videos,
    now: NOW,
    removedVideoIds
  });
}

function slotIds(slots: ReturnType<typeof plan>["slots"]) {
  return slots.map(slot => slot.videoId);
}

describe("findInlineRuns", () => {
  it("splits the root videos at section markers and continuations", () => {
    expect(findInlineRuns(feedContents())).toEqual([
      {
        start: 0,
        end: 2
      },
      {
        start: 3,
        end: 5
      }
    ]);
  });
});

describe("planFeedBand", () => {
  it("never puts a Short in the band", () => {
    const { insertedVideos, isChanged } = plan({
      videos: [
        feedVideo({
          index: 50,
          hours: 2,
          isShort: true
        })
      ]
    });
    expect(insertedVideos).toEqual([]);
    expect(isChanged).toBe(false);
  });

  it("inserts a video before the first item older than it", () => {
    const { slots, insertedVideos, isChanged } = plan({
      videos: [
        feedVideo({
          index: 50,
          hours: 2
        })
      ]
    });
    expect(slotIds(slots)).toEqual([videoId(1), videoId(50), videoId(2), videoId(3), videoId(4)]);
    expect(insertedVideos.map(video => video.videoId)).toEqual([videoId(50)]);
    expect(isChanged).toBe(true);
  });

  it("keeps a video behind the item it was first placed behind when that item's time text changes", () => {
    const video = feedVideo({
      index: 50,
      hours: 2
    });
    const first = plan({
      videos: [video]
    });
    expect(first.placements.get(video.videoId)).toEqual({
      videoId: videoId(1),
      side: AnchorSide.AFTER
    });
    const flippedContents = [
      desktopFeedItem({
        index: 1,
        published: "1 hour ago"
      }),
      desktopFeedItem({
        index: 2,
        published: "1 hour ago"
      })
    ];
    const { slots } = planFeedBand({
      contents: flippedContents,
      videos: [video],
      now: NOW,
      removedVideoIds: NO_REMOVALS,
      anchors: first.placements
    });
    expect(slotIds(slots)).toEqual([videoId(1), video.videoId, videoId(2)]);
  });

  it("moves a video placed at the band's start along with the item after it when a newer one arrives above", () => {
    const video = feedVideo({
      index: 50,
      hours: 0.5
    });
    const first = plan({
      videos: [video]
    });
    expect(first.placements.get(video.videoId)).toEqual({
      videoId: videoId(1),
      side: AnchorSide.BEFORE
    });
    const { slots } = planFeedBand({
      contents: [
        desktopFeedItem({
          index: 60,
          published: "1 minute ago"
        }),
        ...feedContents()
      ],
      videos: [video],
      now: NOW,
      removedVideoIds: NO_REMOVALS,
      anchors: first.placements
    });
    expect(slotIds(slots)).toEqual([videoId(60), video.videoId, videoId(1), videoId(2), videoId(3), videoId(4)]);
  });

  it("orders several videos newest first among the band", () => {
    const { slots } = plan({
      videos: [
        feedVideo({
          index: 51,
          hours: 30
        }),
        feedVideo({
          index: 50,
          hours: 0.5
        })
      ]
    });
    expect(slotIds(slots)).toEqual([videoId(50), videoId(1), videoId(2), videoId(3), videoId(51), videoId(4)]);
  });

  it("leaves videos older than the loaded page for later pages", () => {
    // The oldest item reads "3 days ago", which may mean up to 4 days
    const { slots, insertedVideos } = plan({
      videos: [
        feedVideo({
          index: 50,
          hours: 24 * 3.5
        }),
        feedVideo({
          index: 51,
          hours: 24 * 5
        })
      ]
    });
    expect(insertedVideos.map(video => video.videoId)).toEqual([videoId(50)]);
    expect(slotIds(slots).at(-1)).toBe(videoId(50));
  });

  it("skips videos the feed already shows, shelves included", () => {
    const { insertedVideos, isChanged } = plan({
      videos: [
        feedVideo({
          index: 2,
          hours: 3
        }),
        feedVideo({
          index: 90,
          hours: 2
        })
      ]
    });
    expect(insertedVideos).toEqual([]);
    expect(isChanged).toBe(false);
  });

  it("keeps an item without a readable time (a live stream) ahead of newer videos", () => {
    const contents = [
      desktopFeedItem({
        index: 9,
        published: ""
      }),
      ...feedContents()
    ];
    const { slots } = plan({
      contents,
      videos: [
        feedVideo({
          index: 50,
          hours: 0.1
        })
      ]
    });
    expect(slotIds(slots).slice(0, 3)).toEqual([videoId(9), videoId(50), videoId(1)]);
  });

  it("puts videos from the last day first when no time can be read", () => {
    const contents = [
      contextRendererItem({
        index: 1,
        published: "hace 1 hora"
      }),
      contextRendererItem({
        index: 2,
        published: "hace 3 horas"
      })
    ];
    const { slots, insertedVideos } = plan({
      contents,
      videos: [
        feedVideo({
          index: 50,
          hours: 5
        }),
        feedVideo({
          index: 51,
          hours: 30
        })
      ]
    });
    expect(slotIds(slots)).toEqual([videoId(50), videoId(1), videoId(2)]);
    expect(insertedVideos.map(video => video.videoId)).toEqual([videoId(50)]);
  });

  it("takes removed videos out of the band", () => {
    const { slots, removedIds, isChanged } = plan({
      videos: [],
      removedVideoIds: new Set([videoId(3), videoId(77)])
    });
    expect(slotIds(slots)).toEqual([videoId(1), videoId(2), videoId(4)]);
    expect(removedIds).toEqual([videoId(3)]);
    expect(isChanged).toBe(true);
  });

  it("keeps the span YouTube loaded when the oldest item is taken out", () => {
    const { insertedVideos } = plan({
      videos: [
        feedVideo({
          index: 50,
          hours: 24 * 3.5
        })
      ],
      removedVideoIds: new Set([videoId(4)])
    });
    expect(insertedVideos.map(video => video.videoId)).toEqual([videoId(50)]);
  });

  it("changes nothing in a feed without root videos", () => {
    const { isChanged } = plan({
      contents: [shortsShelf([90])],
      videos: [
        feedVideo({
          index: 50,
          hours: 1
        })
      ]
    });
    expect(isChanged).toBe(false);
  });
});

describe("reflowBandIntoRuns", () => {
  it("keeps each run's length so section markers stay on their row", () => {
    const contents = feedContents();
    const runs = findInlineRuns(contents);
    const inserted = desktopFeedItem({
      index: 50,
      published: "2 hours ago"
    });
    const [first, second, , third, fourth] = contents;
    const result = reflowBandIntoRuns({
      contents,
      runs,
      band: [first, inserted, second, third, fourth]
    });
    expect(result.map(item => videoIdFromGridItem(item) ?? "marker")).toEqual([
      videoId(1),
      videoId(50),
      "marker",
      videoId(2),
      videoId(3),
      videoId(4),
      "marker"
    ]);
    expect(result[2]).toBe(contents[2]);
    expect(result.at(-1)).toBe(contents.at(-1));
  });

  it("lets the last run absorb a shrink", () => {
    const contents = feedContents();
    const [first, second, , third] = contents;
    const result = reflowBandIntoRuns({
      contents,
      runs: findInlineRuns(contents),
      band: [first, second, third]
    });
    expect(result.map(item => videoIdFromGridItem(item) ?? "marker")).toEqual([
      videoId(1),
      videoId(2),
      "marker",
      videoId(3),
      "marker"
    ]);
  });
});
