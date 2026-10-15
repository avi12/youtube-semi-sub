import { CHANNEL_ID, continuationItem, desktopFeedItem, richItem } from "#feed/fixtures/feed-fixtures";
import { channelIdFromGridItem } from "#feed/items/feed-items";
import { describe, expect, it } from "vitest";

const PUBLISHED = "2 hours ago";

describe("channelIdFromGridItem", () => {
  it("reads the channel a tile links to", () => {
    expect(
      channelIdFromGridItem(
        desktopFeedItem({
          index: 1,
          published: PUBLISHED,
          channelId: CHANNEL_ID
        })
      )
    ).toBe(CHANNEL_ID);
  });

  it("names no channel for a collaboration or an item without one", () => {
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
    expect(channelIdFromGridItem(collaboration)).toBeNull();
    expect(channelIdFromGridItem(continuationItem())).toBeNull();
  });
});
