import { parseRssFeed, summarizeDescription } from "./rss-feed";
import { VIDEO_DESCRIPTION_MAX_LENGTH } from "@/lib/schemas/feed-video";
import rssFeedXml from "#background/fixtures/rss-feed.xml?raw";
import { describe, expect, it } from "vitest";

const CHANNEL_ID = "UCBJycsmduvYEL83R_U4JriQ";

function buildFeed(entries: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <title>Channel</title>
 ${entries}
</feed>`;
}

function buildEntry({ videoId, title, group = "" }: {
  videoId: string;
  title: string;
  group?: string;
}) {
  return `<entry>
  <id>yt:video:${videoId}</id>
  <yt:videoId>${videoId}</yt:videoId>
  <yt:channelId>${CHANNEL_ID}</yt:channelId>
  <title>${title}</title>
  <author><name>Channel &amp; Friends</name></author>
  <published>2026-10-01T10:00:00+00:00</published>
  ${group}
 </entry>`;
}

describe("parseRssFeed", () => {
  it("reads every entry of a real feed, newest first", () => {
    const videos = parseRssFeed(rssFeedXml);
    expect(videos?.map(video => video.videoId)).toEqual(["QVv3mQzlrN0", "_0G4OG39XjI", "3iRUwVzRDZQ"]);
    expect(videos?.[0]).toEqual({
      videoId: "QVv3mQzlrN0",
      channelId: CHANNEL_ID,
      channelTitle: "Marques Brownlee",
      title: "Apple Homeview Impressions: Not Convinced!",
      publishedAt: Date.parse("2026-10-13T22:42:38+00:00"),
      thumbnailUrl: "https://i2.ytimg.com/vi/QVv3mQzlrN0/hqdefault.jpg",
      description: "New Smart home display from Apple. With plenty of quirks and features."
    });
  });

  it("reads a single-entry feed, decoding entities and falling back to the canonical thumbnail", () => {
    const xml = buildFeed(
      buildEntry({
        videoId: "abcdefghijk",
        title: "Tom &amp; Jerry &quot;live&quot; &lt;3 it&#39;s &#x263A;"
      })
    );
    expect(parseRssFeed(xml)).toEqual([
      {
        videoId: "abcdefghijk",
        channelId: CHANNEL_ID,
        channelTitle: "Channel & Friends",
        title: "Tom & Jerry \"live\" <3 it's ☺",
        publishedAt: Date.parse("2026-10-01T10:00:00+00:00"),
        thumbnailUrl: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg"
      }
    ]);
  });

  it("keeps numeric titles as text and skips malformed entries", () => {
    const xml = buildFeed(
      [
        buildEntry({
          videoId: "abcdefghijk",
          title: "1984",
          group: "<media:group><media:thumbnail url=\"not a url\"/></media:group>"
        }),
        buildEntry({
          videoId: "too-short",
          title: "Broken"
        })
      ].join("")
    );
    const videos = parseRssFeed(xml);
    expect(videos).toHaveLength(1);
    expect(videos?.[0]?.title).toBe("1984");
    expect(videos?.[0]?.thumbnailUrl).toBe("https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg");
  });

  it("keeps the description when the thumbnail is malformed, and leaves out an empty one", () => {
    const xml = buildFeed(
      [
        buildEntry({
          videoId: "abcdefghijk",
          title: "With a description",
          group: "<media:group><media:thumbnail url=\"not a url\"/><media:description>Unboxing day</media:description></media:group>"
        }),
        buildEntry({
          videoId: "lmnopqrstuv",
          title: "Without one",
          group: "<media:group><media:description></media:description></media:group>"
        })
      ].join("")
    );
    const videos = parseRssFeed(xml);
    expect(videos?.[0]?.description).toBe("Unboxing day");
    expect(videos?.[1]).not.toHaveProperty("description");
  });

  it("returns an empty list for a channel without uploads", () => {
    expect(parseRssFeed(buildFeed(""))).toEqual([]);
  });

  it.each(["<!DOCTYPE html><html><body>Error 404</body></html>", "not xml at all", ""])("returns null for %j", text => {
    expect(parseRssFeed(text)).toBeNull();
  });
});

describe("summarizeDescription", () => {
  it("drops links and collapses whitespace", () => {
    expect(summarizeDescription("Full review\n\nSponsor: https://example.com/deal?x=1  \n Thanks!")).toBe("Full review Sponsor: Thanks!");
  });

  it("cuts to the length limit without splitting a character", () => {
    const summary = summarizeDescription("🎬".repeat(VIDEO_DESCRIPTION_MAX_LENGTH + 10));
    expect(Array.from(summary)).toHaveLength(VIDEO_DESCRIPTION_MAX_LENGTH);
    expect(summary.endsWith("🎬")).toBe(true);
  });
});
