import { readInitialDataHtml, readSubscriptionsFeed } from "./feed-response";
import {
  channelVideosTabResponse,
  continuationItem,
  desktopChannelTabLockup,
  desktopFeedItem,
  desktopFeedResponse,
  mobileFeedItem,
  mobileFeedResponse,
  richItem
} from "#feed/fixtures/feed-fixtures";
import { describe, expect, it } from "vitest";

const DESKTOP_CONTENTS = [
  desktopFeedItem({
    index: 1,
    published: "1 hour ago"
  }),
  continuationItem()
];

describe("readSubscriptionsFeed", () => {
  it("recognizes the www feed by its tracked browse id", () => {
    const feed = readSubscriptionsFeed(desktopFeedResponse(DESKTOP_CONTENTS));
    expect(feed?.contents).toEqual(DESKTOP_CONTENTS);
  });

  it("recognizes the m feed by its tab identifier and grid target", () => {
    const contents = [mobileFeedItem({
      index: 1,
      published: "1 hour ago"
    })];
    expect(readSubscriptionsFeed(mobileFeedResponse(contents))?.contents).toEqual(contents);
  });

  it("ignores a channel's Videos tab", () => {
    const response = channelVideosTabResponse([richItem({ lockupViewModel: desktopChannelTabLockup(1) })]);
    expect(readSubscriptionsFeed(response)).toBeNull();
  });

  it("ignores continuations and anything that is not a browse response", () => {
    const continuation = {
      responseContext: {},
      onResponseReceivedActions: [{
        appendContinuationItemsAction: {
          continuationItems: []
        }
      }]
    };
    expect(readSubscriptionsFeed(continuation)).toBeNull();
    expect(readSubscriptionsFeed(null)).toBeNull();
    expect(readSubscriptionsFeed("<html>")).toBeNull();
  });

  it("swaps the grid contents in a copy, keeping everything else", () => {
    const response = desktopFeedResponse(DESKTOP_CONTENTS);
    const patched = readSubscriptionsFeed(response)?.withContents({
      contents: ["new"],
      hiddenVideoIds: null
    });
    expect(readSubscriptionsFeed(patched)?.contents).toEqual(["new"]);
    expect(patched).toMatchObject({
      header: response.header,
      responseContext: response.responseContext
    });
    expect(response.contents.twoColumnBrowseResultsRenderer.tabs[0]?.tabRenderer.content.richGridRenderer.contents)
      .toBe(DESKTOP_CONTENTS);
    expect(JSON.stringify(patched)).not.toContain("yssHiddenVideoIds");
  });

  it("lists the hidden ids beside the grid contents when given them", () => {
    const patched = readSubscriptionsFeed(desktopFeedResponse(DESKTOP_CONTENTS))?.withContents({
      contents: [],
      hiddenVideoIds: ["aaaaaaaaaaa"]
    });
    expect(patched?.contents.twoColumnBrowseResultsRenderer?.tabs[0]?.tabRenderer?.content?.richGridRenderer)
      .toMatchObject({
        contents: [],
        yssHiddenVideoIds: ["aaaaaaaaaaa"]
      });
  });
});

describe("readInitialDataHtml", () => {
  it("reads and replaces the ytInitialData object, escaping script-closing text", () => {
    const html = `<script>var ytInitialData = {"a":1};</script><script>var other = 2;</script>`;
    const initialData = readInitialDataHtml(html);
    expect(initialData?.data).toEqual({ a: 1 });
    const replaced = initialData?.withData({ title: "</script>" });
    const backslash = "\\";
    const escapedJson = `{"title":"${backslash}u003c/script>"}`;
    expect(replaced).toBe(`<script>var ytInitialData = ${escapedJson};</script><script>var other = 2;</script>`);
    expect(readInitialDataHtml(replaced ?? "")?.data).toEqual({ title: "</script>" });
  });

  it("returns null without ytInitialData", () => {
    expect(readInitialDataHtml("<html></html>")).toBeNull();
  });
});
