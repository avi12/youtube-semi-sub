import { extractInitialData, parseVideosTab } from "./videos-tab-uploads";
import channelVideosPageHtml from "#background/fixtures/channel-videos-page.html?raw";
import { describe, expect, it } from "vitest";

const CHANNEL_ID = "UCBJycsmduvYEL83R_U4JriQ";
const NOW = Date.parse("2026-10-15T12:00:00Z");
const DAY_MS = 86_400_000;
const AVERAGE_MONTH_DAYS = 30.436875;

function buildResponse(gridContents: unknown[]) {
  return {
    contents: {
      twoColumnBrowseResultsRenderer: {
        tabs: [
          {
            tabRenderer: {
              title: "Home"
            }
          },
          {
            tabRenderer: {
              title: "Videos",
              content: {
                richGridRenderer: {
                  contents: gridContents
                }
              }
            }
          }
        ]
      }
    },
    metadata: {
      channelMetadataRenderer: {
        title: "Channel",
        externalId: CHANNEL_ID
      }
    }
  };
}

describe("extractInitialData", () => {
  it("pulls the embedded InnerTube response out of a real Videos tab page", () => {
    expect(extractInitialData(channelVideosPageHtml)).toMatchObject({
      metadata: {
        channelMetadataRenderer: {
          externalId: CHANNEL_ID
        }
      }
    });
  });

  it.each(["<html><body>Before you continue to YouTube</body></html>", "<script>var ytInitialData = {broken;</script>"])(
    "returns null for %j",
    html => {
      expect(extractInitialData(html)).toBeNull();
    }
  );
});

describe("parseVideosTab", () => {
  it("reads the lockups of a real Videos tab, approximating publish times", () => {
    const videos = parseVideosTab({
      response: extractInitialData(channelVideosPageHtml),
      now: NOW
    });
    expect(videos?.map(video => video.videoId)).toEqual(["QVv3mQzlrN0", "_0G4OG39XjI", "3iRUwVzRDZQ", "7KRabLH7jcE"]);
    expect(videos?.[0]).toEqual({
      videoId: "QVv3mQzlrN0",
      channelId: CHANNEL_ID,
      channelTitle: "Marques Brownlee",
      title: "Apple Homeview Impressions: Not Convinced!",
      publishedAt: NOW - DAY_MS,
      thumbnailUrl: "https://i.ytimg.com/vi/QVv3mQzlrN0/hqdefault.jpg"
    });
    // A collaboration lists its channels before the view count and the time
    expect(videos?.[3]?.publishedAt).toBe(NOW - 3 * AVERAGE_MONTH_DAYS * DAY_MS);
  });

  it("reads videoRenderer items, counting a live video as published now", () => {
    const videos = parseVideosTab({
      response: buildResponse([
        {
          richItemRenderer: {
            content: {
              videoRenderer: {
                videoId: "abcdefghijk",
                title: {
                  runs: [
                    {
                      text: "Part "
                    },
                    {
                      text: "one"
                    }
                  ]
                },
                publishedTimeText: {
                  simpleText: "Streamed 2 days ago"
                }
              }
            }
          }
        },
        {
          richItemRenderer: {
            content: {
              videoRenderer: {
                videoId: "lmnopqrstuv",
                title: {
                  simpleText: "Live now"
                }
              }
            }
          }
        }
      ]),
      now: NOW
    });
    expect(videos?.map(video => [video.title, video.publishedAt])).toEqual([
      ["Part one", NOW - 2 * DAY_MS],
      ["Live now", NOW]
    ]);
  });

  it("skips non-video lockups, malformed items and continuations", () => {
    const videos = parseVideosTab({
      response: buildResponse([
        {
          richItemRenderer: {
            content: {
              lockupViewModel: {
                contentId: "PLabcdefghij",
                contentType: "LOCKUP_CONTENT_TYPE_PLAYLIST",
                metadata: {
                  lockupMetadataViewModel: {
                    title: {
                      content: "A playlist"
                    }
                  }
                }
              }
            }
          }
        },
        {
          richItemRenderer: {
            content: {
              lockupViewModel: {
                contentId: "abcdefghijk"
              }
            }
          }
        },
        {
          continuationItemRenderer: {}
        }
      ]),
      now: NOW
    });
    expect(videos).toEqual([]);
  });

  it.each([null, {}, buildResponse([]).metadata])("returns null for an unrelated response", response => {
    expect(
      parseVideosTab({
        response,
        now: NOW
      })
    ).toBeNull();
  });
});
