import { describe, expect, it } from "vitest";

import { buildSemiSubscribedRichItem } from "#feed/compose/semi-subscribed-tag";
import {
  continuationItem,
  desktopFeedItem,
  feedVideo,
  mobileShortsShelf,
  mostRelevantShelf,
  NOW,
  shortsLockup,
  shortsShelf,
  videoId
} from "#feed/fixtures/feed-fixtures";
import type { FeedVideo } from "@/lib/schemas/feed-video";
import { MILLISECONDS_PER_HOUR } from "@/lib/utils/time";
import { ShelfRendererKind } from "@/lib/youtube/schemas/renderers";

import { findShortsShelf, planShortsShelf } from "./shorts-shelf";

const NO_REMOVALS = new Set<string>();
const LOADED_SPAN_HOURS = 48;

function isWithinTwoDays(video: FeedVideo) {
  return NOW - video.publishedAt <= LOADED_SPAN_HOURS * MILLISECONDS_PER_HOUR;
}

function short({ index, hours }: { index: number; hours: number }) {
  return feedVideo({
    index,
    hours,
    isShort: true
  });
}

/** Latest band, then "Most relevant", then the Shorts shelf, like a real www feed */
function feedContents(shelf: unknown = shortsShelf([90, 91])) {
  return [
    desktopFeedItem({
      index: 1,
      published: "1 hour ago"
    }),
    mostRelevantShelf([1]),
    shelf,
    desktopFeedItem({
      index: 2,
      published: "1 day ago"
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
  return planShortsShelf({
    contents,
    videos,
    removedVideoIds,
    isWithinLoadedSpan: isWithinTwoDays
  });
}

function slotIds(planned: ReturnType<typeof plan>) {
  return planned?.slots.map(slot => slot.videoId);
}

/** A Short this extension put in the shelf earlier */
function insertedShort(index: number) {
  return buildSemiSubscribedRichItem({ shortsLockupViewModel: shortsLockup({ index }) });
}

describe("findShortsShelf", () => {
  it("finds the shelf holding Shorts, past a shelf of regular videos", () => {
    const found = findShortsShelf(feedContents());
    expect(found?.iItem).toBe(2);
    expect(found?.shelf.kind).toBe(ShelfRendererKind.RICH);
    expect(found?.template.onTap.innertubeCommand.reelWatchEndpoint.videoId).toBe(videoId(90));
  });

  it("finds m's reel shelf of bare lockups", () => {
    const found = findShortsShelf(feedContents(mobileShortsShelf([90])));
    expect(found?.shelf.kind).toBe(ShelfRendererKind.REEL);
    expect(found?.shelf.items).toHaveLength(1);
  });

  it("finds nothing in a feed without a Shorts shelf", () => {
    expect(findShortsShelf(feedContents(mostRelevantShelf([5])))).toBeNull();
  });
});

describe("planShortsShelf", () => {
  it("leads the shelf with semi-subscribed Shorts, newest first", () => {
    const planned = plan({
      videos: [
        short({
          index: 50,
          hours: 30
        }),
        short({
          index: 51,
          hours: 2
        })
      ]
    });
    expect(slotIds(planned)).toEqual([videoId(51), videoId(50), videoId(90), videoId(91)]);
    expect(planned?.insertedShorts.map(video => video.videoId)).toEqual([videoId(51), videoId(50)]);
    expect(planned?.isChanged).toBe(true);
  });

  it("leaves out regular videos, Shorts already shown, and Shorts older than the loaded span", () => {
    const planned = plan({
      videos: [
        feedVideo({
          index: 50,
          hours: 2
        }),
        short({
          index: 90,
          hours: 2
        }),
        short({
          index: 52,
          hours: LOADED_SPAN_HOURS + 1
        })
      ]
    });
    expect(slotIds(planned)).toEqual([videoId(90), videoId(91)]);
    expect(planned?.isChanged).toBe(false);
  });

  it("slots a new Short among the semi-subscribed ones by time, still ahead of YouTube's own", () => {
    const contents = feedContents({
      richSectionRenderer: {
        content: {
          richShelfRenderer: {
            contents: [
              insertedShort(60),
              insertedShort(61),
              ...shortsShelf([90]).richSectionRenderer.content.richShelfRenderer.contents
            ]
          }
        }
      }
    });
    const planned = plan({
      contents,
      videos: [
        short({
          index: 60,
          hours: 1
        }),
        short({
          index: 61,
          hours: 10
        }),
        short({
          index: 50,
          hours: 5
        }),
        short({
          index: 51,
          hours: 20
        })
      ]
    });
    expect(slotIds(planned)).toEqual([videoId(60), videoId(50), videoId(61), videoId(51), videoId(90)]);
  });

  it("takes removed Shorts out of the shelf", () => {
    const planned = plan({
      videos: [],
      removedVideoIds: new Set([videoId(91)])
    });
    expect(slotIds(planned)).toEqual([videoId(90)]);
    expect(planned?.removedIds).toEqual([videoId(91)]);
    expect(planned?.isChanged).toBe(true);
  });

  it("never creates a shelf", () => {
    expect(
      plan({
        contents: feedContents(mostRelevantShelf([5])),
        videos: [
          short({
            index: 50,
            hours: 2
          })
        ]
      })
    ).toBeNull();
  });
});
