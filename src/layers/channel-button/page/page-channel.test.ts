import { describe, expect, it } from "vitest";

import { MKBHD_ID, OTHER_CHANNEL_ID, RICK_ASTLEY_ID } from "#channel-button/page/fixtures/channel-ids";
import mobileChannelJson from "#channel-button/page/fixtures/m-channel.json?raw";
import mobileWatchJson from "#channel-button/page/fixtures/m-watch.json?raw";
import desktopChannelSignedInJson from "#channel-button/page/fixtures/www-channel-signed-in.json?raw";
import desktopChannelJson from "#channel-button/page/fixtures/www-channel.json?raw";
import desktopWatchJson from "#channel-button/page/fixtures/www-watch.json?raw";
import { PageKind } from "#channel-button/page/page-channel-schema";

import { readPageChannel, readPageChannelByContent } from "./page-channel";

// Fixtures are trimmed copies of real signed-out pages (ytInitialData + ytInitialPlayerResponse) from www and
// m.youtube.com. The signed-in channel header is modelled on the fields YouTube's own subscribe view model reads

function parseFixture(json: string) {
  const parsed: unknown = JSON.parse(json);
  return parsed;
}

describe("readPageChannelByContent", () => {
  it.each([
    ["a www channel page", desktopChannelJson, PageKind.CHANNEL],
    ["an m channel page", mobileChannelJson, PageKind.CHANNEL],
    ["a www watch page", desktopWatchJson, PageKind.WATCH],
    ["an m watch page", mobileWatchJson, PageKind.WATCH]
  ])("tells %s by its data, not by its URL", (_name, json, kind) => {
    expect(readPageChannelByContent(parseFixture(json))?.kind).toBe(kind);
  });

  it.each([
    undefined,
    null,
    {},
    {
      response: {}
    }
  ])("finds no channel in %j", pageData => {
    expect(readPageChannelByContent(pageData)).toBeNull();
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
        kind: PageKind.WATCH
      })
    ).toEqual({
      kind: PageKind.WATCH,
      channel: {
        channelId: RICK_ASTLEY_ID,
        title: "Rick Astley",
        handle: "@RickAstleyYT",
        avatarUrl:
          "https://yt3.ggpht.com/_ShEGOdg-t5YGJse14Ooq6FYBZqX_QSlhaTNjG06miYusm5lWm1UroLyVxnYtahADfRTVLtuVQ=s88-c-k-c0x00ffffff-no-rj"
      },
      videoId: "dQw4w9WgXcQ",
      isOwnedByViewer: false,
      hasSubscribeControl: true,
      officialSubscription: false,
      collaborators: []
    });
  });

  it.each([
    ["www", desktopChannelJson],
    ["m", mobileChannelJson]
  ])("reads a signed-out %s channel page", (_site, json) => {
    expect(
      readPageChannel({
        pageData: parseFixture(json),
        kind: PageKind.CHANNEL
      })
    ).toEqual({
      kind: PageKind.CHANNEL,
      channel: {
        channelId: MKBHD_ID,
        title: "Marques Brownlee",
        handle: "@mkbhd",
        avatarUrl:
          "https://yt3.googleusercontent.com/qu4TmIaYUlS41-dJ9gZ7DUR3nilvmB5_11i6OKSdvNnBNiyOusZP1bMN6ICnuxtjFBb6ioKgRQ=s120-c-k-c0x00ffffff-no-rj"
      },
      videoId: undefined,
      isOwnedByViewer: false,
      hasSubscribeControl: false,
      officialSubscription: undefined,
      collaborators: []
    });
  });

  it("reads the subscription state of a signed-in channel page from its entity mutations", () => {
    const pageChannel = readPageChannel({
      pageData: parseFixture(desktopChannelSignedInJson),
      kind: PageKind.CHANNEL
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
        kind: PageKind.WATCH
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
        kind: PageKind.WATCH
      })?.channel
    ).toEqual({
      channelId: MKBHD_ID,
      title: "Marques Brownlee"
    });
  });

  it("lists every channel of a collaboration from the owner row's dialog", () => {
    function collaborator({ channelId, name, subtitle }: { channelId: string; name: string; subtitle: string }) {
      return {
        listItemViewModel: {
          title: {
            content: name,
            commandRuns: [
              {
                onTap: {
                  innertubeCommand: {
                    browseEndpoint: {
                      browseId: channelId
                    }
                  }
                }
              }
            ]
          },
          subtitle: {
            content: subtitle
          },
          leadingAccessory: {
            avatarViewModel: {
              image: {
                sources: [{ url: "https://yt3.ggpht.com/avatar=s88-c-k-c0x00ffffff-no-rj" }]
              }
            }
          }
        }
      };
    }
    const pageData = {
      response: {
        contents: {
          videoOwnerRenderer: {
            title: {
              runs: [{ text: "Marques Brownlee" }]
            },
            navigationEndpoint: {
              browseEndpoint: {
                browseId: MKBHD_ID
              },
              showDialogCommand: {
                panelLoadingStrategy: {
                  inlineContent: {
                    dialogViewModel: {
                      customContent: {
                        listViewModel: {
                          listItems: [
                            collaborator({
                              channelId: MKBHD_ID,
                              name: "Marques Brownlee",
                              subtitle: "@mkbhd • 21.4M subscribers"
                            }),
                            collaborator({
                              channelId: OTHER_CHANNEL_ID,
                              name: "Auto Focus",
                              subtitle: "@AutoFocus • 1.29M subscribers"
                            })
                          ]
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      playerResponse: {
        videoDetails: {
          videoId: "scwlR0QHGOk",
          channelId: MKBHD_ID,
          author: "Marques Brownlee"
        }
      }
    };
    const collaborators = readPageChannel({
      pageData,
      kind: PageKind.WATCH
    })?.collaborators;
    expect(
      collaborators?.map(({ channelId, title, handle }) => ({
        channelId,
        title,
        handle
      }))
    ).toEqual([
      {
        channelId: MKBHD_ID,
        title: "Marques Brownlee",
        handle: "@mkbhd"
      },
      {
        channelId: OTHER_CHANNEL_ID,
        title: "Auto Focus",
        handle: "@AutoFocus"
      }
    ]);
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
        kind: PageKind.CHANNEL
      })?.channel
    ).toEqual({
      channelId: MKBHD_ID,
      title: "Marques Brownlee"
    });
  });

  it.each([
    null,
    {},
    {
      response: {
        metadata: {}
      }
    }
  ])("finds no channel in %j", pageData => {
    expect(
      readPageChannel({
        pageData,
        kind: PageKind.CHANNEL
      })
    ).toBeNull();
    expect(
      readPageChannel({
        pageData,
        kind: PageKind.WATCH
      })
    ).toBeNull();
  });
});
