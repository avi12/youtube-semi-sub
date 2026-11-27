import { channelIdSchema } from "@/lib/schemas/channel";
import { VIDEO_ID_PATTERN } from "@/lib/schemas/feed-video";
import { browseEndpointSchema } from "@/lib/youtube/schemas/browse";
import {
  CLASSIC_RENDERER_KINDS,
  gridItemSchema,
  RendererKind,
  richItemContentSchema,
  sectionItemSchema,
  ShelfRendererKind
} from "@/lib/youtube/schemas/renderers";
import { type FormattedText, readText } from "@/lib/youtube/schemas/text";
import { isMembersOnlyClassicRenderer, isMembersOnlyLockup } from "@/lib/youtube/video/members-only";
import { durationFromClassicRenderer, durationFromLockup } from "@/lib/youtube/video/video-duration";
import { z } from "@/lib/zod";

import type { VideoRenderer } from "./feed-schemas";

// Read-only accessors over raw grid items (`{ richItemRenderer: { content } }`) and their renderers

export function rendererFromContent(content: unknown) {
  const parsed = richItemContentSchema.safeParse(content);
  if (!parsed.success) {
    return null;
  }

  const lockup = parsed.data[RendererKind.LOCKUP_VIEW_MODEL];
  if (lockup) {
    const video: VideoRenderer = {
      kind: RendererKind.LOCKUP_VIEW_MODEL,
      renderer: lockup
    };
    return video;
  }

  for (const kind of CLASSIC_RENDERER_KINDS) {
    const renderer = parsed.data[kind];
    if (renderer) {
      const video: VideoRenderer = {
        kind,
        renderer
      };
      return video;
    }
  }
  return null;
}

function richItemContent(item: unknown) {
  const parsed = gridItemSchema.safeParse(item);
  return parsed.success ? parsed.data.richItemRenderer?.content : undefined;
}

export function rendererFromGridItem(item: unknown) {
  return rendererFromContent(richItemContent(item));
}

function videoIdOrNull(value: string | undefined) {
  const isVideoId = value && VIDEO_ID_PATTERN.test(value);
  return isVideoId ? value : null;
}

export function videoIdFromContent(content: unknown) {
  const video = rendererFromContent(content);
  if (video) {
    const isLockup = video.kind === RendererKind.LOCKUP_VIEW_MODEL;
    return videoIdOrNull(isLockup ? video.renderer.contentId : video.renderer.videoId);
  }

  const parsed = richItemContentSchema.safeParse(content);
  return parsed.success
    ? videoIdOrNull(
        parsed.data[RendererKind.SHORTS_LOCKUP_VIEW_MODEL]?.onTap.innertubeCommand.reelWatchEndpoint.videoId
      )
    : null;
}

/** Any link in an item that opens a channel: its avatar, its name, a collaborator */
const channelLinkSchema = z.looseObject({
  browseEndpoint: browseEndpointSchema.extend({
    browseId: channelIdSchema
  })
});

/** Every channel a root-level item links to: its uploader, and each collaborator on a collaboration */
export function channelIdsFromGridItem(item: unknown) {
  const channelIds = new Set<string>();
  const pending: unknown[] = [richItemContent(item)];
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value !== "object" || value === null) {
      continue;
    }

    const link = channelLinkSchema.safeParse(value);
    if (link.success) {
      channelIds.add(link.data.browseEndpoint.browseId);
    }

    pending.push(...Object.values(value));
  }
  return channelIds;
}

/** The id of a root-level video item, or null for section markers, continuations and non-video items */
export function videoIdFromGridItem(item: unknown) {
  const content = richItemContent(item);
  return content ? videoIdFromContent(content) : null;
}

/** A shelf's item is a grid item (www), or on m's Shorts shelf the bare renderer a grid item would wrap */
function shelfItemContent(item: unknown) {
  return richItemContent(item) ?? item;
}

export function videoIdFromShelfItem(item: unknown) {
  return videoIdFromContent(shelfItemContent(item));
}

/** The Short a shelf item - or a channel's Shorts-tab grid item - shows, or null for any other item */
export function shortsLockupFromItem(item: unknown) {
  const parsed = richItemContentSchema.safeParse(shelfItemContent(item));
  return parsed.success ? (parsed.data[RendererKind.SHORTS_LOCKUP_VIEW_MODEL] ?? null) : null;
}

/** A root item's shelf - www's rich shelf or m's Shorts shelf - and a copy of it with other items; null for none */
export function readShelf(item: unknown) {
  const parsed = sectionItemSchema.safeParse(item);
  const section = parsed.success ? parsed.data.richSectionRenderer : undefined;
  const content = section?.content;
  const richShelf = content?.[ShelfRendererKind.RICH];
  const reelShelf = content?.[ShelfRendererKind.REEL];
  const items = richShelf?.contents ?? reelShelf?.items;
  if (!parsed.success || !section || !content || !items) {
    return null;
  }

  const isRich = !!richShelf?.contents;
  return {
    kind: isRich ? ShelfRendererKind.RICH : ShelfRendererKind.REEL,
    items,
    withItems(nextItems: unknown[]) {
      const shelfRenderer = isRich
        ? {
            [ShelfRendererKind.RICH]: {
              ...richShelf,
              contents: nextItems
            }
          }
        : {
            [ShelfRendererKind.REEL]: {
              ...reelShelf,
              items: nextItems
            }
          };
      return {
        ...parsed.data,
        richSectionRenderer: {
          ...section,
          content: {
            ...content,
            ...shelfRenderer
          }
        }
      };
    }
  };
}

export function shelfItemsFromGridItem(item: unknown) {
  return readShelf(item)?.items ?? [];
}

/** Every video id in the contents, shelves included */
export function collectContentVideoIds(contents: readonly unknown[]) {
  const videoIds = new Set<string>();
  for (const item of contents) {
    for (const videoId of [videoIdFromGridItem(item), ...shelfItemsFromGridItem(item).map(videoIdFromShelfItem)]) {
      if (videoId) {
        videoIds.add(videoId);
      }
    }
  }
  return videoIds;
}

export function labelFromFormatted(text: FormattedText | undefined) {
  return text?.accessibility?.accessibilityData?.label;
}

/** Every text that may hold the item's published time - the accessibility label first, it is never abbreviated */
export function publishedTextsFromGridItem(item: unknown) {
  const video = rendererFromGridItem(item);
  if (!video) {
    return [];
  }

  if (video.kind !== RendererKind.LOCKUP_VIEW_MODEL) {
    return [readText(video.renderer.publishedTimeText)];
  }

  const rows = video.renderer.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows;
  const texts: string[] = [];
  for (const row of rows ?? []) {
    for (const part of row.metadataParts ?? []) {
      texts.push(part.accessibilityLabel ?? "", part.text?.content ?? "");
    }
  }
  return texts.filter(Boolean);
}

export function titleFromRenderer(video: VideoRenderer) {
  return video.kind === RendererKind.LOCKUP_VIEW_MODEL
    ? (video.renderer.metadata?.lockupMetadataViewModel?.title?.content ?? null)
    : readText(video.renderer.title ?? video.renderer.headline) || null;
}

/** The length the renderer's thumbnail badge shows; undefined for a live or upcoming video */
export function durationFromRenderer(video: VideoRenderer) {
  const durationSeconds =
    video.kind === RendererKind.LOCKUP_VIEW_MODEL
      ? durationFromLockup(video.renderer)
      : durationFromClassicRenderer(video.renderer);
  return durationSeconds ?? undefined;
}

export function isMembersOnlyRenderer(video: VideoRenderer) {
  return video.kind === RendererKind.LOCKUP_VIEW_MODEL
    ? isMembersOnlyLockup(video.renderer)
    : isMembersOnlyClassicRenderer(video.renderer);
}

export function durationFromGridItem(item: unknown) {
  const video = rendererFromGridItem(item);
  return video ? durationFromRenderer(video) : undefined;
}

export function titleFromGridItem(item: unknown) {
  const video = rendererFromGridItem(item);
  return video ? titleFromRenderer(video) : null;
}

export function thumbnailUrlFromGridItem(item: unknown) {
  const video = rendererFromGridItem(item);
  if (!video) {
    return shortsLockupFromItem(item)?.thumbnailViewModel?.thumbnailViewModel?.image?.sources?.[0]?.url ?? null;
  }

  const sources =
    video.kind === RendererKind.LOCKUP_VIEW_MODEL
      ? video.renderer.contentImage?.thumbnailViewModel?.image?.sources
      : video.renderer.thumbnail?.thumbnails;
  return sources?.at(-1)?.url ?? null;
}
