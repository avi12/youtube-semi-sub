import { formattedTextSchema } from "@/lib/youtube/schemas/text";
import { thumbnailListSchema, thumbnailSchema } from "@/lib/youtube/schemas/thumbnail";
import { z } from "@/lib/zod";

// The renderers a video tile is drawn from, in grid items (`{ richItemRenderer: { content } }`). Every field is
// optional and passes unmodelled siblings through, and a renderer that fails its schema is dropped (`catch`) instead
// of failing the whole item

export enum RendererKind {
  lockupViewModel = "lockupViewModel",
  videoWithContextRenderer = "videoWithContextRenderer",
  videoRenderer = "videoRenderer",
  compactVideoRenderer = "compactVideoRenderer",
  gridVideoRenderer = "gridVideoRenderer",
  /** A Short's tile: in the feed's Shorts shelf and on a channel's Shorts tab */
  shortsLockupViewModel = "shortsLockupViewModel"
}

export const LOCKUP_VIDEO_CONTENT_TYPE = "LOCKUP_CONTENT_TYPE_VIDEO";

export const CLASSIC_RENDERER_KINDS = [
  RendererKind.videoWithContextRenderer,
  RendererKind.videoRenderer,
  RendererKind.compactVideoRenderer,
  RendererKind.gridVideoRenderer
] as const;

const metadataPartSchema = z.looseObject({
  text: z.looseObject({ content: z.string() }).optional(),
  accessibilityLabel: z.string().optional()
});

const metadataRowSchema = z.looseObject({ metadataParts: z.array(metadataPartSchema).optional() });
export type MetadataRow = z.infer<typeof metadataRowSchema>;

const thumbnailBadgeSchema = z.looseObject({
  thumbnailBadgeViewModel: z.looseObject({
    text: z.string().optional(),
    rendererContext: z.looseObject({
      accessibilityContext: z.looseObject({ label: z.string().optional() }).optional()
    }).optional()
  }).optional()
});

/** A view model's image: every size YouTube offers */
const sourcedImageSchema = z.looseObject({ sources: z.array(thumbnailSchema).optional() });

const textContentSchema = z.looseObject({ content: z.string() });

export const lockupSchema = z.looseObject({
  contentId: z.string(),
  contentType: z.string().optional(),
  contentImage: z.looseObject({
    thumbnailViewModel: z.looseObject({
      image: sourcedImageSchema.optional(),
      overlays: z.array(
        z.looseObject({
          thumbnailBottomOverlayViewModel: z.looseObject({
            badges: z.array(thumbnailBadgeSchema).optional()
          }).optional()
        })
      ).optional()
    }).optional()
  }).optional(),
  metadata: z.looseObject({
    lockupMetadataViewModel: z.looseObject({
      title: z.looseObject({ content: z.string().optional() }).optional(),
      image: z.looseObject({
        decoratedAvatarViewModel: z.looseObject({
          avatar: z.looseObject({
            avatarViewModel: z.looseObject({ avatarImageSize: z.string().optional() }).optional()
          }).optional()
        }).optional()
      }).optional(),
      metadata: z.looseObject({
        contentMetadataViewModel: z.looseObject({
          metadataRows: z.array(metadataRowSchema).optional(),
          delimiter: z.string().optional()
        }).optional()
      }).optional()
    }).optional()
  }).optional()
});
export type Lockup = z.infer<typeof lockupSchema>;

/** `videoRenderer` and its siblings in `CLASSIC_RENDERER_KINDS` share these fields */
export const classicRendererSchema = z.looseObject({
  videoId: z.string(),
  title: formattedTextSchema.optional(),
  headline: formattedTextSchema.optional(),
  publishedTimeText: formattedTextSchema.optional(),
  lengthText: formattedTextSchema.optional(),
  viewCountText: formattedTextSchema.optional(),
  shortViewCountText: formattedTextSchema.optional(),
  thumbnail: thumbnailListSchema.partial().optional()
});
export type ClassicRenderer = z.infer<typeof classicRendererSchema>;

export const shortsLockupSchema = z.looseObject({
  entityId: z.string().optional(),
  accessibilityText: z.string().optional(),
  onTap: z.looseObject({
    innertubeCommand: z.looseObject({
      reelWatchEndpoint: z.looseObject({ videoId: z.string() })
    })
  }),
  menuOnTapA11yLabel: z.string().optional(),
  /** The title, and the view count under it */
  overlayMetadata: z.looseObject({
    primaryText: textContentSchema.optional(),
    secondaryText: textContentSchema.optional()
  }).optional(),
  thumbnailViewModel: z.looseObject({
    thumbnailViewModel: z.looseObject({ image: sourcedImageSchema.optional() }).optional()
  }).optional(),
  titleTruncationStyle: z.string().optional()
});
export type ShortsLockup = z.infer<typeof shortsLockupSchema>;

export const richItemContentSchema = z.looseObject({
  [RendererKind.lockupViewModel]: lockupSchema.optional().catch(undefined),
  [RendererKind.videoWithContextRenderer]: classicRendererSchema.optional().catch(undefined),
  [RendererKind.videoRenderer]: classicRendererSchema.optional().catch(undefined),
  [RendererKind.compactVideoRenderer]: classicRendererSchema.optional().catch(undefined),
  [RendererKind.gridVideoRenderer]: classicRendererSchema.optional().catch(undefined),
  [RendererKind.shortsLockupViewModel]: shortsLockupSchema.optional().catch(undefined)
});

/** The shelves a feed section holds */
export enum ShelfRendererKind {
  /** www's shelves (Shorts, "Most relevant"): grid items in `contents` */
  rich = "richShelfRenderer",
  /** m's Shorts shelf: bare `shortsLockupViewModel`s in `items` */
  reel = "reelShelfRenderer"
}

/** A section marker: a titled break in the grid, or a shelf with items of its own */
export const sectionItemSchema = z.looseObject({
  richSectionRenderer: z.looseObject({
    content: z.looseObject({
      [ShelfRendererKind.rich]: z.looseObject({ contents: z.array(z.unknown()).optional() }).optional(),
      [ShelfRendererKind.reel]: z.looseObject({ items: z.array(z.unknown()).optional() }).optional()
    }).optional()
  })
});

export const gridItemSchema = z.looseObject({
  richItemRenderer: z.looseObject({ content: richItemContentSchema }).optional().catch(undefined),
  richSectionRenderer: sectionItemSchema.shape.richSectionRenderer.optional().catch(undefined)
});
