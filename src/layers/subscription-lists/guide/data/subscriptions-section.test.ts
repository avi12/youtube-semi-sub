import { describe, expect, it } from "vitest";

import { patchGuideResponse } from "#subscription-lists/guide/data/guide-patch";
import {
  cloneItems,
  ENTRIES,
  HANDLE_CHANNEL,
  SUBSCRIPTIONS_KEY
} from "#subscription-lists/guide/fixtures/guide-fixtures";
import signedInGuide from "#subscription-lists/guide/fixtures/guide-signed-in.json";
import signedOutGuide from "#subscription-lists/guide/fixtures/guide-signed-out.json";
import { z } from "@/lib/zod";

import { readGuideSubscriptions } from "./subscriptions-section";

describe("readGuideSubscriptions", () => {
  const shownChannelId = "UC4REwc30LXHzKSkpqSwhR-Q";
  const underShowMoreChannelId = "UCjkyfFH-MWZhasolgds05EA";
  const unlistedChannelId = "UCX6OQ3DkcsbYNE6H8uQQuVA";

  it("reads every listed subscription, those under Show more too, and nothing else as subscribed", () => {
    const readIsSubscribed = readGuideSubscriptions(signedInGuide);
    expect(readIsSubscribed?.(shownChannelId)).toBe(true);
    expect(readIsSubscribed?.(underShowMoreChannelId)).toBe(true);
    expect(readIsSubscribed?.(unlistedChannelId)).toBe(false);
  });

  it("never counts the channels the extension added", () => {
    const patched = patchGuideResponse({
      response: signedInGuide,
      entries: ENTRIES
    });
    expect(readGuideSubscriptions(patched)?.(HANDLE_CHANNEL.channelId)).toBe(false);
  });

  it("can't tell about an unlisted channel when the section loads more later", () => {
    const [firstItem, subscriptionsItem, ...otherItems] = cloneItems(signedInGuide);
    const parsed = z
      .looseObject({
        [SUBSCRIPTIONS_KEY]: z.looseObject({ items: z.array(z.unknown()) })
      })
      .parse(subscriptionsItem);
    const cutShort = {
      items: [
        firstItem,
        {
          [SUBSCRIPTIONS_KEY]: {
            ...parsed[SUBSCRIPTIONS_KEY],
            items: [
              ...parsed[SUBSCRIPTIONS_KEY].items,
              {
                continuationItemRenderer: {}
              }
            ]
          }
        },
        ...otherItems
      ]
    };
    const readIsSubscribed = readGuideSubscriptions(cutShort);
    expect(readIsSubscribed?.(shownChannelId)).toBe(true);
    expect(readIsSubscribed?.(unlistedChannelId)).toBeUndefined();
  });

  it("says nothing signed out", () => {
    expect(readGuideSubscriptions(signedOutGuide)).toBeNull();
  });
});
