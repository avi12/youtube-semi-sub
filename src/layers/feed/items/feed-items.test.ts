import { ShelfRendererKind } from "@/lib/youtube/schemas/renderers";
import {
  CHANNEL_ID,
  continuationItem,
  desktopFeedItem,
  mobileShortsShelf,
  richItem,
  shortsShelf,
  videoId
} from "#feed/fixtures/feed-fixtures";
import {
  channelIdsFromGridItem,
  collectContentVideoIds,
  readShelf,
  thumbnailUrlFromGridItem,
  videoIdFromShelfItem
} from "#feed/items/feed-items";
import { describe, expect, it } from "vitest";

const PUBLISHED = "2 hours ago";

describe("channelIdsFromGridItem", () => {
  it("reads the channel a tile links to", () => {
    expect(
      channelIdsFromGridItem(
        desktopFeedItem({
          index: 1,
          published: PUBLISHED,
          channelId: CHANNEL_ID
        })
      )
    ).toEqual(new Set([CHANNEL_ID]));
  });

  it("names every channel of a collaboration, and none for an item without one", () => {
    const tile = desktopFeedItem({
      index: 1,
      published: PUBLISHED,
      channelId: CHANNEL_ID
    });
    const collaboration = richItem({
      ...tile.richItemRenderer.content,
      collaborator: {
        browseEndpoint: {
          browseId: "UCalreadysubscribedchan2"
        }
      }
    });
    expect(channelIdsFromGridItem(collaboration)).toEqual(new Set([CHANNEL_ID, "UCalreadysubscribedchan2"]));
    expect(channelIdsFromGridItem(continuationItem())).toEqual(new Set());
  });
});

describe("readShelf", () => {
  it.each([
    [shortsShelf([90, 91]), ShelfRendererKind.rich],
    [mobileShortsShelf([90, 91]), ShelfRendererKind.reel]
  ])("reads the items of a %#. shelf and swaps them, keeping the rest of it", (shelfItem, kind) => {
    const shelf = readShelf(shelfItem);
    expect(shelf?.kind).toBe(kind);
    expect(shelf?.items.map(videoIdFromShelfItem)).toEqual([videoId(90), videoId(91)]);

    const swapped = shelf?.withItems(shelf.items.slice(1));
    expect(readShelf(swapped)?.items.map(videoIdFromShelfItem)).toEqual([videoId(91)]);
    expect(JSON.stringify(swapped)).toContain("YOUTUBE_SHORTS_BRAND_24");
    expect(readShelf(shelfItem)?.items).toHaveLength(2);
  });

  it("reads no shelf from a video or a continuation", () => {
    expect(
      readShelf(
        desktopFeedItem({
          index: 1,
          published: PUBLISHED
        })
      )
    ).toBeNull();
    expect(readShelf(continuationItem())).toBeNull();
  });
});

describe("collectContentVideoIds", () => {
  it("collects root videos and the Shorts of either shelf", () => {
    const contents = [
      desktopFeedItem({
        index: 1,
        published: PUBLISHED
      }),
      shortsShelf([90]),
      mobileShortsShelf([91])
    ];
    expect(collectContentVideoIds(contents)).toEqual(new Set([videoId(1), videoId(90), videoId(91)]));
  });
});

describe("thumbnailUrlFromGridItem", () => {
  it("reads a Short's thumbnail too", () => {
    const [short] = readShelf(shortsShelf([90]))?.items ?? [];
    expect(thumbnailUrlFromGridItem(short)).toBe(`https://i.ytimg.com/vi/${videoId(90)}/sardefault.jpg?sqp=signed`);
  });
});
