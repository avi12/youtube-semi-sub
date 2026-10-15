import {
  CLASSIC_RENDERER_KINDS,
  type FormattedText,
  gridItemSchema,
  RendererKind,
  richItemContentSchema
} from "./feed-schemas";
import { VIDEO_ID_PATTERN } from "@/lib/feed-video";

// Read-only accessors over raw grid items (`{ richItemRenderer: { content } }`) and their renderers

export function rendererFromContent(content: unknown) {
  const parsed = richItemContentSchema.safeParse(content);
  if (!parsed.success) {
    return null;
  }

  const lockup = parsed.data[RendererKind.lockupViewModel];
  if (lockup) {
    return {
      kind: RendererKind.lockupViewModel as const,
      renderer: lockup
    };
  }

  for (const kind of CLASSIC_RENDERER_KINDS) {
    const renderer = parsed.data[kind];
    if (renderer) {
      return {
        kind,
        renderer
      };
    }
  }
  return null;
}

export type VideoRenderer = NonNullable<ReturnType<typeof rendererFromContent>>;

function richItemContent(item: unknown) {
  const parsed = gridItemSchema.safeParse(item);
  return parsed.success ? parsed.data.richItemRenderer?.content : undefined;
}

export function rendererFromGridItem(item: unknown) {
  return rendererFromContent(richItemContent(item));
}

function videoIdOrNull(value: string | undefined) {
  return value && VIDEO_ID_PATTERN.test(value) ? value : null;
}

export function videoIdFromContent(content: unknown) {
  const video = rendererFromContent(content);
  if (video) {
    const isLockup = video.kind === RendererKind.lockupViewModel;
    return videoIdOrNull(isLockup ? video.renderer.contentId : video.renderer.videoId);
  }

  const parsed = richItemContentSchema.safeParse(content);
  return parsed.success
    ? videoIdOrNull(parsed.data.shortsLockupViewModel?.onTap.innertubeCommand.reelWatchEndpoint.videoId)
    : null;
}

/** The id of a root-level video item, or null for section markers, continuations and non-video items */
export function videoIdFromGridItem(item: unknown) {
  const content = richItemContent(item);
  return content ? videoIdFromContent(content) : null;
}

/** Every video id in the contents, shelves included */
export function collectContentVideoIds(contents: readonly unknown[]) {
  const videoIds = new Set<string>();
  for (const item of contents) {
    const parsed = gridItemSchema.safeParse(item);
    if (!parsed.success) {
      continue;
    }

    const shelfContents = parsed.data.richSectionRenderer?.content?.richShelfRenderer?.contents ?? [];
    for (const nestedItem of [item, ...shelfContents]) {
      const videoId = videoIdFromGridItem(nestedItem);
      if (videoId) {
        videoIds.add(videoId);
      }
    }
  }
  return videoIds;
}

export function textFromFormatted(text: FormattedText | undefined) {
  return text?.simpleText ?? text?.runs?.map(run => run.text).join("") ?? "";
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

  if (video.kind !== RendererKind.lockupViewModel) {
    return [textFromFormatted(video.renderer.publishedTimeText)];
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

export function thumbnailUrlFromGridItem(item: unknown) {
  const video = rendererFromGridItem(item);
  if (!video) {
    return null;
  }

  const sources = video.kind === RendererKind.lockupViewModel
    ? video.renderer.contentImage?.thumbnailViewModel?.image?.sources
    : video.renderer.thumbnail?.thumbnails;
  return sources?.at(-1)?.url ?? null;
}
