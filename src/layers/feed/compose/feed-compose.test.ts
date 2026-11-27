import { describe, expect, it } from "vitest";

import {
  CHANNEL_ID,
  continuationItem,
  desktopChannelTabLockup,
  desktopFeedItem,
  feedVideo,
  NOW,
  shortsShelf,
  videoId
} from "#feed/fixtures/feed-fixtures";
import {
  rendererFromContent,
  rendererFromGridItem,
  shelfItemsFromGridItem,
  videoIdFromGridItem,
  videoIdFromShelfItem
} from "#feed/items/feed-items";
import { DEFAULT_TITLE_FILTER, FilterKind } from "@/lib/filter/schema/video-filter-schema";
import type { FeedVideo } from "@/lib/schemas/feed-video";
import type { SemiSubscriptions } from "@/lib/schemas/semi-subscription";

import { composeFeedContents } from "./feed-compose";

const SUBSCRIPTIONS: SemiSubscriptions = {
  [CHANNEL_ID]: {
    channelId: CHANNEL_ID,
    title: "Semi Channel (subscribed name)",
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

function feedContents() {
  return [
    desktopFeedItem({
      index: 1,
      published: "1 hour ago"
    }),
    desktopFeedItem({
      index: 2,
      published: "5 hours ago"
    }),
    shortsShelf([90]),
    desktopFeedItem({
      index: 3,
      published: "2 days ago"
    }),
    continuationItem()
  ];
}

function compose({
  videos,
  removedVideoIds = new Set(),
  contents = feedContents()
}: {
  videos: FeedVideo[];
  removedVideoIds?: ReadonlySet<string>;
  contents?: unknown[];
}) {
  return composeFeedContents({
    contents,
    videos,
    subscriptions: SUBSCRIPTIONS,
    removedVideoIds,
    now: NOW,
    locale: "en",
    findNative: video =>
      video.videoId === videoId(50) ? rendererFromContent({ lockupViewModel: desktopChannelTabLockup(50) }) : null,
    findNativeShort: () => null,
    findAvatarUrl: () => "https://yt3.googleusercontent.com/semi=s900",
    findIsVerified: () => false
  });
}

function ids(contents: readonly unknown[]) {
  return contents.map(item => videoIdFromGridItem(item) ?? "marker");
}

describe("composeFeedContents", () => {
  it("places built tiles in the band and keeps every marker on its row", () => {
    const composed = compose({
      videos: [
        feedVideo({
          index: 50,
          hours: 3
        }),
        feedVideo({
          index: 51,
          hours: 30
        })
      ]
    });
    expect(composed?.insertedIds).toEqual([videoId(50), videoId(51)]);
    expect(ids(composed?.contents ?? [])).toEqual([
      videoId(1),
      videoId(50),
      "marker",
      videoId(2),
      videoId(51),
      videoId(3),
      "marker"
    ]);
  });

  it("names the channel as subscribed and falls back to the channel page's avatar", () => {
    const composed = compose({
      videos: [
        feedVideo({
          index: 51,
          hours: 3
        })
      ]
    });
    const built = rendererFromGridItem(composed?.contents[1]);
    expect(built?.renderer).toMatchObject({
      metadata: {
        lockupMetadataViewModel: {
          image: {
            decoratedAvatarViewModel: {
              avatar: {
                avatarViewModel: {
                  image: {
                    sources: [{ url: "https://yt3.googleusercontent.com/semi=s900" }]
                  }
                }
              }
            }
          },
          metadata: {
            contentMetadataViewModel: {
              metadataRows: [
                {
                  metadataParts: [
                    {
                      text: {
                        content: "Semi Channel (subscribed name)"
                      }
                    }
                  ]
                },
                {
                  metadataParts: [
                    {
                      text: {
                        content: "3 hours ago"
                      }
                    }
                  ]
                }
              ]
            }
          }
        }
      }
    });
  });

  it("takes out removed tiles", () => {
    const composed = compose({
      videos: [],
      removedVideoIds: new Set([videoId(2)])
    });
    expect(composed?.removedIds).toEqual([videoId(2)]);
    expect(ids(composed?.contents ?? [])).toEqual([videoId(1), videoId(3), "marker", "marker"]);
  });

  it("returns null when the feed already shows everything", () => {
    const first = compose({
      videos: [
        feedVideo({
          index: 50,
          hours: 3
        })
      ]
    });
    expect(
      compose({
        contents: first?.contents,
        videos: [
          feedVideo({
            index: 50,
            hours: 3
          })
        ]
      })
    ).toBeNull();
  });

  it("puts Shorts in the Shorts shelf only, leaving the band and the shelf's place as they are", () => {
    const composed = compose({
      videos: [
        feedVideo({
          index: 50,
          hours: 3
        }),
        feedVideo({
          index: 60,
          hours: 2,
          isShort: true
        })
      ]
    });
    const contents = composed?.contents ?? [];
    expect(composed?.insertedIds).toEqual([videoId(50), videoId(60)]);
    expect(ids(contents)).toEqual([videoId(1), videoId(50), "marker", videoId(2), videoId(3), "marker"]);
    expect(shelfItemsFromGridItem(contents[2]).map(videoIdFromShelfItem)).toEqual([videoId(60), videoId(90)]);
  });

  it("takes a Short out of the shelf", () => {
    const composed = compose({
      videos: [],
      removedVideoIds: new Set([videoId(90)])
    });
    expect(composed?.removedIds).toEqual([videoId(90)]);
    expect(shelfItemsFromGridItem(composed?.contents[2])).toEqual([]);
  });

  it("leaves Shorts out of a feed without a Shorts shelf", () => {
    expect(
      compose({
        contents: feedContents().filter(item => shelfItemsFromGridItem(item).length === 0),
        videos: [
          feedVideo({
            index: 60,
            hours: 2,
            isShort: true
          })
        ]
      })
    ).toBeNull();
  });
});
