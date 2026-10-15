import type { FeedVideo } from "@/lib/schemas/feed-video";
import { buildReelWatchEndpoint } from "@/lib/youtube/endpoints";
import { formatRelativeTime } from "@/lib/youtube/relative-time";
import { RendererKind, ShelfRendererKind, type ShortsLockup } from "@/lib/youtube/schemas/renderers";
import { buildShortsThumbnailUrl } from "@/lib/youtube/video-thumbnail";
import { buildSemiSubscribedBareItem, buildSemiSubscribedRichItem } from "#feed/compose/semi-subscribed-tag";

// Builds a Shorts-shelf tile for a semi-subscribed Short. The channel's own Shorts-tab tile ("native") supplies views,
// thumbnails and menu when known. Otherwise the tile is made from the cached upload in the shape of the shelf's own
// Shorts (a sibling is the template), its publish time standing in for the view count

/** The template's per-video entity id, re-pointed at this Short */
function entityIdFor({ template, videoId }: {
  template: ShortsLockup;
  videoId: string;
}) {
  const { entityId } = template;
  const templateVideoId = template.onTap.innertubeCommand.reelWatchEndpoint.videoId;
  if (!entityId?.endsWith(templateVideoId)) {
    return undefined;
  }

  return `${entityId.slice(0, -templateVideoId.length)}${videoId}`;
}

function fabricateShortsLockup({ video, template, publishedText }: {
  video: FeedVideo;
  template: ShortsLockup;
  publishedText: string;
}) {
  const entityId = entityIdFor({
    template,
    videoId: video.videoId
  });
  return {
    ...entityId && {
      entityId
    },
    accessibilityText: video.title,
    onTap: {
      innertubeCommand: buildReelWatchEndpoint(video.videoId)
    },
    ...template.menuOnTapA11yLabel && {
      menuOnTapA11yLabel: template.menuOnTapA11yLabel
    },
    overlayMetadata: {
      primaryText: {
        content: video.title
      },
      secondaryText: {
        content: publishedText
      }
    },
    thumbnailViewModel: {
      thumbnailViewModel: {
        image: {
          sources: [{ url: buildShortsThumbnailUrl(video.videoId) }]
        }
      }
    },
    ...template.titleTruncationStyle && {
      titleTruncationStyle: template.titleTruncationStyle
    }
  };
}

/** A shelf item for `video` in the shelf's own item shape, tagged as semi-subscribed */
export function buildShortsItem({ video, native, template, shelfKind, now, locale }: {
  video: FeedVideo;
  native: ShortsLockup | null;
  template: ShortsLockup;
  shelfKind: ShelfRendererKind;
  now: number;
  locale: string;
}) {
  const fabricated = fabricateShortsLockup({
    video,
    template,
    publishedText: formatRelativeTime({
      time: video.publishedAt,
      now,
      locale
    })
  });
  // The native's own fields win; what it lacks - title, views, thumbnail - is filled in from the cached upload
  const lockup = native
    ? {
      ...fabricated,
      ...native,
      overlayMetadata: {
        ...fabricated.overlayMetadata,
        ...native.overlayMetadata
      }
    }
    : fabricated;
  const content = { [RendererKind.shortsLockupViewModel]: lockup };
  const isRichShelf = shelfKind === ShelfRendererKind.rich;
  // Detached from the cached native, which later responses reuse
  return structuredClone(isRichShelf ? buildSemiSubscribedRichItem(content) : buildSemiSubscribedBareItem(content));
}
