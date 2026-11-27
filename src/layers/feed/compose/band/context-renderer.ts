import { channelCommand, VERIFIED_LABEL } from "#feed/compose/band/channel-graft";
import type { VideoDetails } from "#feed/compose/band/video-lockup";
import type { VideoRenderer } from "#feed/items/feed-schemas";
import type { ChannelInfo } from "@/lib/schemas/channel";
import type { FeedVideo } from "@/lib/schemas/feed-video";
import { buildWatchEndpoint } from "@/lib/youtube/endpoints";
import { RendererKind } from "@/lib/youtube/schemas/renderers";

const VERIFIED_OWNER_BADGE = {
  metadataBadgeRenderer: {
    icon: {
      iconType: "CHECK_CIRCLE_THICK"
    },
    style: "BADGE_STYLE_TYPE_VERIFIED",
    tooltip: VERIFIED_LABEL,
    accessibilityData: {
      label: VERIFIED_LABEL
    }
  }
};

export function buildContextRenderer({
  video,
  channel,
  native,
  details,
  publishedText
}: {
  video: FeedVideo;
  channel: ChannelInfo;
  native: VideoRenderer | null;
  details: VideoDetails;
  publishedText: string;
}) {
  const classic = native && native.kind !== RendererKind.LOCKUP_VIEW_MODEL ? native.renderer : undefined;
  return {
    ...(classic ?? { navigationEndpoint: buildWatchEndpoint(video.videoId) }),
    videoId: video.videoId,
    headline: {
      runs: [{ text: video.title }]
    },
    thumbnail: {
      thumbnails: details.thumbnailSources ?? [{ url: video.thumbnailUrl }]
    },
    shortBylineText: {
      runs: [
        {
          text: channel.title,
          navigationEndpoint: channelCommand(channel)
        }
      ]
    },
    ...(channel.isVerified && {
      ownerBadges: [VERIFIED_OWNER_BADGE]
    }),
    publishedTimeText: classic?.publishedTimeText ?? { runs: [{ text: publishedText }] },
    ...(channel.avatarUrl && {
      channelThumbnail: {
        channelThumbnailWithLinkRenderer: {
          thumbnail: {
            thumbnails: [
              {
                url: channel.avatarUrl
              }
            ]
          },
          navigationEndpoint: channelCommand(channel),
          accessibility: {
            accessibilityData: {
              label: channel.title
            }
          }
        }
      }
    })
  };
}
