import { buildFeedItem, findTemplate } from "./feed-item-builder";
import type { ChannelInfo } from "@/lib/schemas/channel";
import {
  CHANNEL_ID,
  contextRendererItem,
  desktopChannelTabLockup,
  desktopFeedItem,
  feedVideo,
  mobileChannelTabRenderer,
  mobileFeedItem,
  NOW,
  richItem,
  videoId
} from "#feed/fixtures/feed-fixtures";
import { rendererFromContent, rendererFromGridItem } from "#feed/items/feed-items";
import { describe, expect, it } from "vitest";

const CHANNEL: ChannelInfo = {
  channelId: CHANNEL_ID,
  title: "Semi Channel",
  handle: "@semichannel",
  avatarUrl: "https://yt3.ggpht.com/semi=s68"
};

const VIDEO = feedVideo({
  index: 50,
  hours: 3
});

function templateOf(item: unknown) {
  const template = rendererFromGridItem(item);
  if (!template) {
    throw new Error("fixture is not a video item");
  }

  return template;
}

function build({ template, native = null, channel = CHANNEL }: {
  template: unknown;
  native?: unknown;
  channel?: ChannelInfo;
}) {
  return buildFeedItem({
    video: VIDEO,
    channel,
    native: native === null ? null : rendererFromContent(native),
    template: templateOf(template),
    now: NOW,
    locale: "en"
  });
}

function lockupOf(item: unknown) {
  const video = rendererFromGridItem(item);
  if (video?.kind !== "lockupViewModel") {
    throw new Error("not a lockup");
  }

  return video.renderer;
}

function metadataTexts(item: unknown) {
  const rows = lockupOf(item).metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows;
  return rows?.map(row => row.metadataParts?.map(part => part.text?.content));
}

const DESKTOP_TEMPLATE = desktopFeedItem({
  index: 1,
  published: "1 hour ago"
});
const MOBILE_TEMPLATE = mobileFeedItem({
  index: 1,
  published: "1 hour ago"
});

describe("buildFeedItem on www", () => {
  it("grafts the channel row and avatar onto the channel's own lockup", () => {
    const native = { lockupViewModel: desktopChannelTabLockup(50) };
    const item = build({
      template: DESKTOP_TEMPLATE,
      native
    });
    const lockup = lockupOf(item);
    expect(lockup.contentId).toBe(videoId(50));
    expect(metadataTexts(item)).toEqual([["Semi Channel"], ["6.8M", "1d ago"]]);
    expect(lockup.metadata?.lockupMetadataViewModel?.menuButton).toMatchObject({
      buttonViewModel: {
        iconName: "MORE_VERT"
      }
    });
    expect(lockup.metadata?.lockupMetadataViewModel?.image).toMatchObject({
      decoratedAvatarViewModel: {
        avatar: {
          avatarViewModel: {
            image: {
              sources: [{ url: CHANNEL.avatarUrl }]
            },
            avatarImageSize: "AVATAR_SIZE_M"
          }
        },
        rendererContext: {
          commandContext: {
            onTap: {
              innertubeCommand: {
                browseEndpoint: {
                  browseId: CHANNEL_ID,
                  canonicalBaseUrl: "/@semichannel"
                }
              }
            }
          }
        }
      }
    });
  });

  it("detaches the built item from the cached native renderer", () => {
    const native = { lockupViewModel: desktopChannelTabLockup(50) };
    const item = build({
      template: DESKTOP_TEMPLATE,
      native
    });
    const nativeTitle = native.lockupViewModel.metadata.lockupMetadataViewModel.title;
    expect(lockupOf(item).metadata?.lockupMetadataViewModel?.title).not.toBe(nativeTitle);
    expect(native.lockupViewModel.metadata.lockupMetadataViewModel).not.toHaveProperty("image");
  });

  it("fabricates a lockup from the feed video when the channel tab lacks it", () => {
    const item = build({ template: DESKTOP_TEMPLATE });
    const lockup = lockupOf(item);
    expect(lockup.contentId).toBe(videoId(50));
    expect(lockup.metadata?.lockupMetadataViewModel?.title?.content).toBe(VIDEO.title);
    expect(lockup.contentImage?.thumbnailViewModel?.image?.sources).toEqual([{ url: VIDEO.thumbnailUrl }]);
    expect(lockup.contentImage?.thumbnailViewModel?.overlays).toEqual([]);
    expect(metadataTexts(item)).toEqual([["Semi Channel"], ["3 hours ago"]]);
    expect(lockup).toMatchObject({
      rendererContext: {
        commandContext: {
          onTap: {
            innertubeCommand: {
              watchEndpoint: {
                videoId: videoId(50)
              }
            }
          }
        }
      }
    });
  });

  it("leaves the avatar out when its picture is unknown", () => {
    const item = build({
      template: DESKTOP_TEMPLATE,
      channel: {
        channelId: CHANNEL_ID,
        title: "Semi Channel"
      }
    });
    expect(lockupOf(item).metadata?.lockupMetadataViewModel).not.toHaveProperty("image");
  });
});

describe("buildFeedItem on m", () => {
  it("leads the single row with the channel and carries the native duration and views", () => {
    const item = build({
      template: MOBILE_TEMPLATE,
      native: {
        compactVideoRenderer: mobileChannelTabRenderer(50)
      }
    });
    const lockup = lockupOf(item);
    expect(metadataTexts(item)).toEqual([["Semi Channel", "6.8M views", "1 day ago"]]);
    expect(lockup.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.delimiter).toBe(" • ");
    expect(lockup.contentImage?.thumbnailViewModel?.overlays?.[0]).toMatchObject({
      thumbnailBottomOverlayViewModel: {
        badges: [{
          thumbnailBadgeViewModel: {
            text: "11:47",
            rendererContext: {
              accessibilityContext: {
                label: "11 minutes, 47 seconds"
              }
            }
          }
        }]
      }
    });
  });

  it("builds a videoWithContextRenderer when the feed uses that renderer", () => {
    const item = build({
      template: contextRendererItem({
        index: 1,
        published: "1 hour ago"
      }),
      native: {
        compactVideoRenderer: mobileChannelTabRenderer(50)
      }
    });
    expect(item).toMatchObject({
      richItemRenderer: {
        content: {
          videoWithContextRenderer: {
            videoId: videoId(50),
            headline: {
              runs: [{ text: VIDEO.title }]
            },
            shortBylineText: {
              runs: [{ text: "Semi Channel" }]
            },
            publishedTimeText: {
              runs: [{ text: "1 day ago" }]
            },
            lengthText: {
              runs: [{ text: "11:47" }]
            },
            channelThumbnail: {
              channelThumbnailWithLinkRenderer: {
                thumbnail: {
                  thumbnails: [{ url: CHANNEL.avatarUrl }]
                }
              }
            }
          }
        }
      }
    });
  });
});

describe("buildFeedItem with another renderer", () => {
  it("only reuses a native renderer of the same kind", () => {
    const template = richItem({
      videoRenderer: {
        videoId: videoId(1),
        publishedTimeText: {
          simpleText: "1 hour ago"
        }
      }
    });
    expect(
      build({
        template,
        native: {
          lockupViewModel: desktopChannelTabLockup(50)
        }
      })
    ).toBeNull();
    expect(
      build({
        template,
        native: {
          videoRenderer: {
            videoId: videoId(50)
          }
        }
      })
    ).toMatchObject(
      richItem({
        videoRenderer: {
          videoId: videoId(50)
        }
      })
    );
  });
});

describe("findTemplate", () => {
  it("prefers a lockup", () => {
    const template = findTemplate([
      contextRendererItem({
        index: 1,
        published: "1 hour ago"
      }),
      DESKTOP_TEMPLATE
    ]);
    expect(template?.kind).toBe("lockupViewModel");
  });
});
