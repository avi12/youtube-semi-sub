import { graftChannel } from "#feed/compose/band/channel-graft";
import { buildContextRenderer } from "#feed/compose/band/context-renderer";
import { detailsFromNative, fabricateLockup } from "#feed/compose/band/video-lockup";
import { buildSemiSubscribedRichItem } from "#feed/compose/semi-subscribed-tag";
import { withSemiUnsubscribeItem } from "#feed/compose/semi-unsubscribe-menu";
import { rendererFromGridItem } from "#feed/items/feed-items";
import type { VideoRenderer } from "#feed/items/feed-schemas";
import type { ChannelInfo } from "@/lib/schemas/channel";
import type { FeedVideo } from "@/lib/schemas/feed-video";
import { RendererKind } from "@/lib/youtube/schemas/renderers";
import { formatRelativeTime } from "@/lib/youtube/video/relative-time";

// Builds a feed tile for a semi-subscribed video in the renderer the feed already uses (a sibling item is the
// template). The channel's own Videos-tab renderer ("native") supplies duration, views and menu when known; the
// channel row and avatar a feed tile carries (and a channel page omits) are grafted on in the template's layout

function renderRenderer({
  video,
  channel,
  native,
  template,
  publishedText
}: {
  video: FeedVideo;
  channel: ChannelInfo;
  native: VideoRenderer | null;
  template: VideoRenderer;
  publishedText: string;
}) {
  const details = detailsFromNative(native);
  if (template.kind === RendererKind.LOCKUP_VIEW_MODEL) {
    const lockup =
      native?.kind === RendererKind.LOCKUP_VIEW_MODEL
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

  if (template.kind === RendererKind.VIDEO_WITH_CONTEXT_RENDERER) {
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
    if (video?.kind === RendererKind.LOCKUP_VIEW_MODEL) {
      return video;
    }

    fallback ??= video;
  }
  return fallback;
}

export function buildFeedItem({
  video,
  channel,
  native,
  template,
  now,
  locale
}: {
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
  return structuredClone(
    buildSemiSubscribedRichItem({
      [template.kind]: withSemiUnsubscribeItem({
        kind: template.kind,
        renderer,
        channelId: channel.channelId
      })
    })
  );
}
