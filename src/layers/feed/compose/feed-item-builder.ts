import type { ChannelInfo } from "@/lib/schemas/channel";
import type { FeedVideo } from "@/lib/schemas/feed-video";
import { formatHandle } from "@/lib/youtube/channel-link";
import { buildChannelEndpoint, buildWatchEndpoint } from "@/lib/youtube/endpoints";
import { formatRelativeTime } from "@/lib/youtube/relative-time";
import {
  type Lockup,
  LOCKUP_VIDEO_CONTENT_TYPE,
  type MetadataRow,
  RendererKind
} from "@/lib/youtube/schemas/renderers";
import { readText } from "@/lib/youtube/schemas/text";
import { labelFromFormatted, rendererFromGridItem } from "#feed/items/feed-items";
import type { VideoRenderer } from "#feed/items/feed-schemas";

// Builds a feed tile for a semi-subscribed video in the renderer the feed already uses (a sibling item is the
// template). The channel's own Videos-tab renderer ("native") supplies duration, views and menu when known; the
// channel row and avatar a feed tile carries (and a channel page omits) are grafted on in the template's layout

const DEFAULT_BADGE_STYLE = "THUMBNAIL_OVERLAY_BADGE_STYLE_DEFAULT";
const DEFAULT_AVATAR_SIZE = "AVATAR_SIZE_M";
const AVATAR_PIXELS = 68;

function channelCommand(channel: ChannelInfo) {
  const canonicalBaseUrl = channel.handle ? `/${formatHandle(channel.handle)}` : undefined;
  return buildChannelEndpoint({
    channelId: channel.channelId,
    url: canonicalBaseUrl ?? `/channel/${channel.channelId}`,
    canonicalBaseUrl
  });
}

function detailsFromNative(native: VideoRenderer | null) {
  if (!native) {
    return {};
  }

  if (native.kind !== RendererKind.lockupViewModel) {
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
  const badges = thumbnail?.overlays?.flatMap(overlay => overlay.thumbnailBottomOverlayViewModel?.badges ?? []);
  const badge = badges?.[0]?.thumbnailBadgeViewModel;
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

type VideoDetails = ReturnType<typeof detailsFromNative>;

function fabricateLockup({ video, details, publishedText }: {
  video: FeedVideo;
  details: VideoDetails;
  publishedText: string;
}) {
  const durationOverlay = {
    thumbnailBottomOverlayViewModel: {
      badges: [{
        thumbnailBadgeViewModel: {
          text: details.durationText,
          badgeStyle: DEFAULT_BADGE_STYLE,
          ...details.durationLabel && {
            rendererContext: {
              accessibilityContext: {
                label: details.durationLabel
              }
            }
          }
        }
      }]
    }
  };
  const metadataParts = [
    ...details.viewCountText ? [{
      text: {
        content: details.viewCountText
      }
    }] : [],
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

function avatarImage({ channel, avatarUrl, avatarImageSize }: {
  channel: ChannelInfo;
  avatarUrl: string;
  avatarImageSize: string;
}) {
  return {
    decoratedAvatarViewModel: {
      avatar: {
        avatarViewModel: {
          image: {
            sources: [{
              url: avatarUrl,
              width: AVATAR_PIXELS,
              height: AVATAR_PIXELS
            }]
          },
          avatarImageSize
        }
      },
      a11yLabel: channel.title,
      rendererContext: {
        commandContext: {
          onTap: {
            innertubeCommand: channelCommand(channel)
          }
        }
      }
    }
  };
}

/** The channel name in the template's layout: a row of its own (www) or leading the first row (m) */
function withChannelRow({ rows, templateRows, channel }: {
  rows: MetadataRow[] | undefined;
  templateRows: MetadataRow[] | undefined;
  channel: ChannelInfo;
}) {
  const isChannelOnOwnRow = (templateRows?.[0]?.metadataParts?.length ?? 0) <= 1;
  const [firstRow, ...otherRows] = rows ?? [];
  const channelPart = {
    text: {
      content: channel.title
    }
  };
  if (isChannelOnOwnRow) {
    return [{ metadataParts: [channelPart] }, ...firstRow ? [firstRow] : [], ...otherRows];
  }

  return [{
    ...firstRow,
    metadataParts: [channelPart, ...firstRow?.metadataParts ?? []]
  }, ...otherRows];
}

/** The channel's avatar, only where the template shows one */
function templateAvatarImage({ template, channel }: {
  template: Lockup;
  channel: ChannelInfo;
}) {
  const templateAvatar = template.metadata?.lockupMetadataViewModel?.image?.decoratedAvatarViewModel;
  const avatarUrl = templateAvatar ? channel.avatarUrl : undefined;
  if (!avatarUrl) {
    return undefined;
  }

  return avatarImage({
    channel,
    avatarUrl,
    avatarImageSize: templateAvatar?.avatar?.avatarViewModel?.avatarImageSize ?? DEFAULT_AVATAR_SIZE
  });
}

/** Adds the channel name and avatar in the template's layout */
function graftChannel({ lockup, template, channel }: {
  lockup: Lockup;
  template: Lockup;
  channel: ChannelInfo;
}) {
  const templateContentMetadata = template.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel;
  const lockupMetadata = lockup.metadata?.lockupMetadataViewModel;
  const contentMetadata = lockupMetadata?.metadata?.contentMetadataViewModel;
  const metadataRows = withChannelRow({
    rows: contentMetadata?.metadataRows,
    templateRows: templateContentMetadata?.metadataRows,
    channel
  });
  const image = templateAvatarImage({
    template,
    channel
  });
  const delimiter = templateContentMetadata?.delimiter ?? contentMetadata?.delimiter;
  return {
    ...lockup,
    metadata: {
      ...lockup.metadata,
      lockupMetadataViewModel: {
        ...lockupMetadata,
        ...image && {
          image
        },
        metadata: {
          ...lockupMetadata?.metadata,
          contentMetadataViewModel: {
            ...contentMetadata,
            ...delimiter !== undefined && {
              delimiter
            },
            metadataRows
          }
        }
      }
    }
  };
}

function buildContextRenderer({ video, channel, native, details, publishedText }: {
  video: FeedVideo;
  channel: ChannelInfo;
  native: VideoRenderer | null;
  details: VideoDetails;
  publishedText: string;
}) {
  const classic = native && native.kind !== RendererKind.lockupViewModel ? native.renderer : undefined;
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
      runs: [{
        text: channel.title,
        navigationEndpoint: channelCommand(channel)
      }]
    },
    publishedTimeText: classic?.publishedTimeText ?? { runs: [{ text: publishedText }] },
    ...channel.avatarUrl && {
      channelThumbnail: {
        channelThumbnailWithLinkRenderer: {
          thumbnail: {
            thumbnails: [{
              url: channel.avatarUrl
            }]
          },
          navigationEndpoint: channelCommand(channel),
          accessibility: {
            accessibilityData: {
              label: channel.title
            }
          }
        }
      }
    }
  };
}

function renderRenderer({ video, channel, native, template, publishedText }: {
  video: FeedVideo;
  channel: ChannelInfo;
  native: VideoRenderer | null;
  template: VideoRenderer;
  publishedText: string;
}) {
  const details = detailsFromNative(native);
  if (template.kind === RendererKind.lockupViewModel) {
    const lockup = native?.kind === RendererKind.lockupViewModel
      ? native.renderer
      : fabricateLockup({
        video,
        details,
        publishedText: details.publishedText ?? publishedText
      });
    return graftChannel({
      lockup,
      template: template.renderer,
      channel
    });
  }

  if (template.kind === RendererKind.videoWithContextRenderer) {
    return buildContextRenderer({
      video,
      channel,
      native,
      details,
      publishedText
    });
  }

  return native?.kind === template.kind ? native.renderer : null;
}

/** The first band item's renderer, preferring a lockup - the shape every built tile copies */
export function findTemplate(contents: readonly unknown[]) {
  let fallback: VideoRenderer | null = null;
  for (const item of contents) {
    const video = rendererFromGridItem(item);
    if (video?.kind === RendererKind.lockupViewModel) {
      return video;
    }

    fallback ??= video;
  }
  return fallback;
}

export function buildFeedItem({ video, channel, native, template, now, locale }: {
  video: FeedVideo;
  channel: ChannelInfo;
  native: VideoRenderer | null;
  template: VideoRenderer;
  now: number;
  locale: string;
}) {
  const renderer = renderRenderer({
    video,
    channel,
    native,
    template,
    publishedText: formatRelativeTime({
      time: video.publishedAt,
      now,
      locale
    })
  });
  if (!renderer) {
    return null;
  }

  // Detached from the cached native renderer, which later responses reuse
  return structuredClone({
    richItemRenderer: {
      content: {
        [template.kind]: renderer
      }
    }
  });
}
