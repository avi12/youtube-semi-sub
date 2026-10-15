import {
  getPageKind,
  PageKind,
  readPageChannel,
  readSubscriptionEntities,
  toChannelHandle
} from "./channel-page-data";
import mobileChannelJson from "./fixtures/m-channel.json?raw";
import mobileWatchJson from "./fixtures/m-watch.json?raw";
import desktopChannelSignedInJson from "./fixtures/www-channel-signed-in.json?raw";
import desktopChannelJson from "./fixtures/www-channel.json?raw";
import desktopWatchJson from "./fixtures/www-watch.json?raw";
import { describe, expect, it } from "vitest";

// Fixtures are trimmed copies of real signed-out pages (ytInitialData + ytInitialPlayerResponse) from www and
// m.youtube.com. The signed-in channel header is modelled on the fields YouTube's own subscribe view model reads

const RICK_ASTLEY_ID = "UCuAXFkgsw1L7xaCfnd5JJOw";
const MKBHD_ID = "UCBJycsmduvYEL83R_U4JriQ";
const OTHER_CHANNEL_ID = "UCXuqSBlHAE6Xw-yeJA0Tunw";

function parseFixture(json: string) {
  const parsed: unknown = JSON.parse(json);
  return parsed;
}

describe("getPageKind", () => {
  it.each([
    ["/watch", PageKind.watch],
    ["/live/dQw4w9WgXcQ", PageKind.watch],
    ["/@mkbhd", PageKind.channel],
    ["/@mkbhd/videos", PageKind.channel],
    [`/channel/${MKBHD_ID}`, PageKind.channel],
    ["/c/mkbhd", PageKind.channel],
    ["/user/marquesbrownlee/featured", PageKind.channel]
  ])("reads %s as a %s page", (pathname, kind) => {
    expect(getPageKind(pathname)).toBe(kind);
  });

  it.each(["/", "/feed/subscriptions", "/results", "/shorts/dQw4w9WgXcQ", "/playlist", "/watchlater"])(
    "gives %s no channel button",
    pathname => {
      expect(getPageKind(pathname)).toBeNull();
    }
  );
});

describe("toChannelHandle", () => {
  it.each([
    ["/@RickAstleyYT", "@RickAstleyYT"],
    ["http://www.youtube.com/@mkbhd", "@mkbhd"],
    ["https://m.youtube.com/@mkbhd/videos", "@mkbhd"],
    ["/@%D7%A2%D7%91%D7%A8%D7%99%D7%AA", "@עברית"]
  ])("reads %s as %s", (url, handle) => {
    expect(toChannelHandle(url)).toBe(handle);
  });

  it.each([`/channel/${MKBHD_ID}`, undefined])("finds no handle in %s", url => {
    expect(toChannelHandle(url)).toBeUndefined();
  });
});

describe("readSubscriptionEntities", () => {
  it("maps each subscription entity to the channel id its key encodes", () => {
    const entities = readSubscriptionEntities({
      frameworkUpdates: {
        entityBatchUpdate: {
          mutations: [
            {
              payload: {
                subscriptionStateEntity: {
                  key: "EhhVQ3VBWEZrZ3N3MUw3eGFDZm5kNUpKT3cgMygB",
                  subscribed: false
                }
              }
            },
            {
              payload: {
                subscriptionStateEntity: {
                  key: "EhhVQ0JKeWNzbWR1dllFTDgzUl9VNEpyaVEgMygB",
                  subscribed: true
                }
              }
            },
            {
              payload: {
                likeStatusEntity: {
                  key: "x"
                }
              }
            },
            {
              payload: {
                subscriptionStateEntity: {
                  key: "not base64!",
                  subscribed: true
                }
              }
            }
          ]
        }
      }
    });
    expect([...entities]).toEqual([[RICK_ASTLEY_ID, false], [MKBHD_ID, true]]);
  });

  it("returns nothing for a response without framework updates", () => {
    expect(readSubscriptionEntities({}).size).toBe(0);
  });
});

describe("readPageChannel", () => {
  it.each([
    ["www", desktopWatchJson],
    ["m", mobileWatchJson]
  ])("reads the uploader of a %s watch page", (_site, json) => {
    expect(
      readPageChannel({
        pageData: parseFixture(json),
        kind: PageKind.watch
      })
    ).toEqual({
      kind: PageKind.watch,
      channel: {
        channelId: RICK_ASTLEY_ID,
        title: "Rick Astley",
        handle: "@RickAstleyYT",
        avatarUrl: "https://yt3.ggpht.com/_ShEGOdg-t5YGJse14Ooq6FYBZqX_QSlhaTNjG06miYusm5lWm1UroLyVxnYtahADfRTVLtuVQ=s88-c-k-c0x00ffffff-no-rj"
      },
      videoId: "dQw4w9WgXcQ",
      isOwnedByViewer: false,
      hasSubscribeControl: true,
      officialSubscription: false
    });
  });

  it.each([
    ["www", desktopChannelJson],
    ["m", mobileChannelJson]
  ])("reads a signed-out %s channel page", (_site, json) => {
    expect(
      readPageChannel({
        pageData: parseFixture(json),
        kind: PageKind.channel
      })
    ).toEqual({
      kind: PageKind.channel,
      channel: {
        channelId: MKBHD_ID,
        title: "Marques Brownlee",
        handle: "@mkbhd",
        avatarUrl: "https://yt3.googleusercontent.com/qu4TmIaYUlS41-dJ9gZ7DUR3nilvmB5_11i6OKSdvNnBNiyOusZP1bMN6ICnuxtjFBb6ioKgRQ=s120-c-k-c0x00ffffff-no-rj"
      },
      videoId: undefined,
      isOwnedByViewer: false,
      hasSubscribeControl: false,
      officialSubscription: undefined
    });
  });

  it("reads the subscription state of a signed-in channel page from its entity mutations", () => {
    const pageChannel = readPageChannel({
      pageData: parseFixture(desktopChannelSignedInJson),
      kind: PageKind.channel
    });
    expect(pageChannel?.hasSubscribeControl).toBe(true);
    expect(pageChannel?.officialSubscription).toBe(true);
  });

  it("marks the viewer's own video", () => {
    const pageData = {
      playerResponse: {
        videoDetails: {
          videoId: "dQw4w9WgXcQ",
          channelId: MKBHD_ID,
          author: "Marques Brownlee",
          isOwnerViewing: true
        }
      }
    };
    expect(
      readPageChannel({
        pageData,
        kind: PageKind.watch
      })?.isOwnedByViewer
    ).toBe(true);
  });

  it("trusts only the uploader when a collaboration's owner row names another channel", () => {
    const pageData = {
      response: {
        contents: {
          videoOwnerRenderer: {
            title: {
              runs: [{ text: "Someone else" }]
            },
            navigationEndpoint: {
              browseEndpoint: {
                browseId: OTHER_CHANNEL_ID,
                canonicalBaseUrl: "/@someoneelse"
              }
            }
          }
        }
      },
      playerResponse: {
        videoDetails: {
          videoId: "dQw4w9WgXcQ",
          channelId: MKBHD_ID,
          author: "Marques Brownlee"
        }
      }
    };
    expect(
      readPageChannel({
        pageData,
        kind: PageKind.watch
      })?.channel
    ).toEqual({
      channelId: MKBHD_ID,
      title: "Marques Brownlee"
    });
  });

  it("keeps the channel when its avatar URL is malformed", () => {
    const pageData = {
      response: {
        metadata: {
          channelMetadataRenderer: {
            externalId: MKBHD_ID,
            title: "Marques Brownlee",
            avatar: {
              thumbnails: [{ url: "not a url" }]
            }
          }
        }
      }
    };
    expect(
      readPageChannel({
        pageData,
        kind: PageKind.channel
      })?.channel
    ).toEqual({
      channelId: MKBHD_ID,
      title: "Marques Brownlee"
    });
  });

  it.each([null, {}, {
    response: {
      metadata: {}
    }
  }])("finds no channel in %j", pageData => {
    expect(
      readPageChannel({
        pageData,
        kind: PageKind.channel
      })
    ).toBeNull();
    expect(
      readPageChannel({
        pageData,
        kind: PageKind.watch
      })
    ).toBeNull();
  });
});
