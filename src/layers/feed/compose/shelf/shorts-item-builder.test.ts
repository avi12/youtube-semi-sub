import { buildShortsItem } from "./shorts-item-builder";
import { ShelfRendererKind, type ShortsLockup, shortsLockupSchema } from "@/lib/youtube/schemas/renderers";
import { isSemiSubscribedItem, SEMI_SUBSCRIBED_TAG } from "#feed/compose/semi-subscribed-tag";
import { feedVideo, NOW, shortsLockup, videoId } from "#feed/fixtures/feed-fixtures";
import { shortsLockupFromItem } from "#feed/items/feed-items";
import { describe, expect, it } from "vitest";

const SHORT = feedVideo({
  index: 50,
  hours: 3,
  isShort: true
});
const TEMPLATE = shortsLockupSchema.parse(shortsLockup({ index: 90 }));

function build({ native = null, shelfKind = ShelfRendererKind.rich }: {
  native?: ShortsLockup | null;
  shelfKind?: ShelfRendererKind;
}) {
  return buildShortsItem({
    video: SHORT,
    native,
    template: TEMPLATE,
    shelfKind,
    now: NOW,
    locale: "en"
  });
}

describe("buildShortsItem", () => {
  it("makes a Short from the cached upload in the shape of the shelf's own", () => {
    const item = build({});
    expect(shortsLockupFromItem(item)).toEqual({
      entityId: `subscriptions-shorts-shelf-item-${videoId(50)}`,
      accessibilityText: SHORT.title,
      onTap: {
        innertubeCommand: {
          commandMetadata: {
            webCommandMetadata: {
              url: `/shorts/${videoId(50)}`,
              webPageType: "WEB_PAGE_TYPE_SHORTS",
              rootVe: 37414
            }
          },
          reelWatchEndpoint: {
            videoId: videoId(50)
          }
        }
      },
      menuOnTapA11yLabel: "More actions",
      overlayMetadata: {
        primaryText: {
          content: SHORT.title
        },
        secondaryText: {
          content: "3 hours ago"
        }
      },
      thumbnailViewModel: {
        thumbnailViewModel: {
          image: {
            sources: [{ url: `https://i.ytimg.com/vi/${videoId(50)}/oardefault.jpg` }]
          }
        }
      },
      titleTruncationStyle: TEMPLATE.titleTruncationStyle
    });
  });

  it("never carries over the template's per-video menu", () => {
    expect(shortsLockupFromItem(build({}))).not.toHaveProperty("menuOnTap");
  });

  it("uses the channel's own Short as it is, views and menu included", () => {
    const native = shortsLockupSchema.parse(
      shortsLockup({
        index: 50,
        views: "29M views",
        entityPrefix: "shorts-shelf-item-"
      })
    );
    const lockup = shortsLockupFromItem(build({ native }));
    expect(lockup).toMatchObject({
      entityId: `shorts-shelf-item-${videoId(50)}`,
      overlayMetadata: {
        primaryText: {
          content: "Short 50"
        },
        secondaryText: {
          content: "29M views"
        }
      },
      menuOnTap: native.menuOnTap
    });
    expect(lockup).not.toBe(native);
  });

  it("tags a www shelf item inside its grid item", () => {
    expect(build({})).toMatchObject({
      richItemRenderer: {
        content: {
          shortsLockupViewModel: {
            onTap: {
              innertubeCommand: {
                reelWatchEndpoint: {
                  videoId: videoId(50)
                }
              }
            }
          }
        },
        [SEMI_SUBSCRIBED_TAG]: true
      }
    });
  });

  it("tags an m shelf item beside its bare lockup", () => {
    const item = build({ shelfKind: ShelfRendererKind.reel });
    expect(item).not.toHaveProperty("richItemRenderer");
    expect(item).toMatchObject({
      [SEMI_SUBSCRIBED_TAG]: true
    });
    expect(isSemiSubscribedItem(item)).toBe(true);
    expect(shortsLockupFromItem(item)?.onTap.innertubeCommand.reelWatchEndpoint.videoId).toBe(videoId(50));
  });
});
