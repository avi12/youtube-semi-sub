import { labelFromFormatted } from "#feed/items/feed-items";
import type { VideoRenderer } from "#feed/items/feed-schemas";
import type { FeedVideo } from "@/lib/schemas/feed-video";
import { buildWatchEndpoint } from "@/lib/youtube/endpoints";
import { LOCKUP_VIDEO_CONTENT_TYPE, RendererKind } from "@/lib/youtube/schemas/renderers";
import { readText } from "@/lib/youtube/schemas/text";
import { findLockupDurationBadge } from "@/lib/youtube/video/video-duration";

const DEFAULT_BADGE_STYLE = "THUMBNAIL_OVERLAY_BADGE_STYLE_DEFAULT";

export function detailsFromNative(native: VideoRenderer | null) {
  if (!native) {
    return {};
  }

  if (native.kind !== RendererKind.LOCKUP_VIEW_MODEL) {
    const { renderer } = native;
    return {
      thumbnailSources: renderer.thumbnail?.thumbnails,
      durationText: readText(renderer.lengthText) || undefined,
      durationLabel: labelFromFormatted(renderer.lengthText),
      viewCountText: readText(renderer.shortViewCountText ?? renderer.viewCountText) || undefined,
      publishedText: readText(renderer.publishedTimeText) || undefined
    };
  }

  const { renderer } = native;
  const thumbnail = renderer.contentImage?.thumbnailViewModel;
  const badge = findLockupDurationBadge(renderer);
  const rows = renderer.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows ?? [];
  const parts = rows.findLast(row => (row.metadataParts?.length ?? 0) > 0)?.metadataParts ?? [];
  const isViewCountShown = parts.length > 1;
  return {
    thumbnailSources: thumbnail?.image?.sources,
    durationText: badge?.text,
    durationLabel: badge?.rendererContext?.accessibilityContext?.label,
    viewCountText: isViewCountShown ? parts[0]?.text?.content : undefined,
    publishedText: parts.at(-1)?.text?.content
  };
}

export type VideoDetails = ReturnType<typeof detailsFromNative>;

export function fabricateLockup({
  video,
  details,
  publishedText
}: {
  video: FeedVideo;
  details: VideoDetails;
  publishedText: string;
}) {
  const durationOverlay = {
    thumbnailBottomOverlayViewModel: {
      badges: [
        {
          thumbnailBadgeViewModel: {
            text: details.durationText,
            badgeStyle: DEFAULT_BADGE_STYLE,
            ...(details.durationLabel && {
              rendererContext: {
                accessibilityContext: {
                  label: details.durationLabel
                }
              }
            })
          }
        }
      ]
    }
  };
  const metadataParts = [
    ...(details.viewCountText
      ? [
          {
            text: {
              content: details.viewCountText
            }
          }
        ]
      : []),
    {
      text: {
        content: publishedText
      }
    }
  ];
  return {
    contentId: video.videoId,
    contentType: LOCKUP_VIDEO_CONTENT_TYPE,
    contentImage: {
      thumbnailViewModel: {
        image: {
          sources: details.thumbnailSources ?? [{ url: video.thumbnailUrl }]
        },
        overlays: details.durationText ? [durationOverlay] : []
      }
    },
    metadata: {
      lockupMetadataViewModel: {
        title: {
          content: video.title
        },
        metadata: {
          contentMetadataViewModel: {
            metadataRows: [{ metadataParts }]
          }
        }
      }
    },
    rendererContext: {
      accessibilityContext: {
        label: video.title
      },
      commandContext: {
        onTap: {
          innertubeCommand: buildWatchEndpoint(video.videoId)
        }
      }
    }
  };
}
