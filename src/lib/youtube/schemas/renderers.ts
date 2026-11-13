import { formattedTextSchema } from "@/lib/youtube/schemas/text";
import { thumbnailListSchema, thumbnailSchema } from "@/lib/youtube/schemas/thumbnail";
import { z } from "@/lib/zod";

// The renderers a video tile is drawn from, in grid items (`{ richItemRenderer: { content } }`). Every field is
// optional and passes unmodelled siblings through, and a renderer that fails its schema is dropped (`catch`) instead
// of failing the whole item

export enum RendererKind {
  LOCKUP_VIEW_MODEL = "lockupViewModel",
  VIDEO_WITH_CONTEXT_RENDERER = "videoWithContextRenderer",
  VIDEO_RENDERER = "videoRenderer",
  COMPACT_VIDEO_RENDERER = "compactVideoRenderer",
  GRID_VIDEO_RENDERER = "gridVideoRenderer",
  /** A Short's tile: in the feed's Shorts shelf and on a channel's Shorts tab */
  SHORTS_LOCKUP_VIEW_MODEL = "shortsLockupViewModel"
}

export const LOCKUP_VIDEO_CONTENT_TYPE = "LOCKUP_CONTENT_TYPE_VIDEO";

export const CLASSIC_RENDERER_KINDS = [
  RendererKind.VIDEO_WITH_CONTEXT_RENDERER,
  RendererKind.VIDEO_RENDERER,
  RendererKind.COMPACT_VIDEO_RENDERER,
  RendererKind.GRID_VIDEO_RENDERER
] as const;

const textContentSchema = z.looseObject({ content: z.string() });

const metadataPartSchema = z.looseObject({
  text: textContentSchema.optional(),
  accessibilityLabel: z.string().optional()
});

/** A badge under a lockup's title, such as "Members only" */
const badgeViewModelSchema = z.looseObject({
  badgeViewModel: z.looseObject({ badgeStyle: z.string().optional() }).optional()
});

const metadataRowSchema = z.looseObject({
  metadataParts: z.array(metadataPartSchema).optional(),
  badges: z.array(badgeViewModelSchema).optional().catch(undefined)
});
export type MetadataRow = z.infer<typeof metadataRowSchema>;

const thumbnailBadgeSchema = z.looseObject({
  thumbnailBadgeViewModel: z
    .looseObject({
      text: z.string().optional(),
      rendererContext: z
        .looseObject({
          accessibilityContext: z.looseObject({ label: z.string().optional() }).optional()
        })
        .optional()
    })
    .optional()
});

/** A view model's image: every size YouTube offers */
const sourcedImageSchema = z.looseObject({ sources: z.array(thumbnailSchema).optional() });

export const lockupSchema = z.looseObject({
  contentId: z.string(),
  contentType: z.string().optional(),
  contentImage: z
    .looseObject({
      thumbnailViewModel: z
        .looseObject({
          image: sourcedImageSchema.optional(),
          overlays: z
            .array(
              z.looseObject({
                thumbnailBottomOverlayViewModel: z
                  .looseObject({
                    badges: z.array(thumbnailBadgeSchema).optional()
                  })
                  .optional()
              })
            )
            .optional()
        })
        .optional()
    })
    .optional(),
  metadata: z
    .looseObject({
      lockupMetadataViewModel: z
        .looseObject({
          title: textContentSchema.partial().optional(),
          image: z
            .looseObject({
              decoratedAvatarViewModel: z
                .looseObject({
                  avatar: z
                    .looseObject({
                      avatarViewModel: z.looseObject({ avatarImageSize: z.string().optional() }).optional()
                    })
                    .optional()
                })
                .optional()
            })
            .optional(),
          metadata: z
            .looseObject({
              contentMetadataViewModel: z
                .looseObject({
                  metadataRows: z.array(metadataRowSchema).optional(),
                  delimiter: z.string().optional()
                })
                .optional()
            })
            .optional()
        })
        .optional()
    })
    .optional()
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
  thumbnail: thumbnailListSchema.partial().optional(),
  badges: z
    .array(
      z.looseObject({
        metadataBadgeRenderer: z.looseObject({ style: z.string().optional() }).optional()
      })
    )
    .optional()
    .catch(undefined)
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
  overlayMetadata: z
    .looseObject({
      primaryText: textContentSchema.optional(),
      secondaryText: textContentSchema.optional()
    })
    .optional(),
  thumbnailViewModel: z
    .looseObject({
      thumbnailViewModel: z.looseObject({ image: sourcedImageSchema.optional() }).optional()
    })
    .optional(),
  titleTruncationStyle: z.string().optional()
});
export type ShortsLockup = z.infer<typeof shortsLockupSchema>;

export const richItemContentSchema = z.looseObject({
  [RendererKind.LOCKUP_VIEW_MODEL]: lockupSchema.optional().catch(undefined),
  [RendererKind.VIDEO_WITH_CONTEXT_RENDERER]: classicRendererSchema.optional().catch(undefined),
  [RendererKind.VIDEO_RENDERER]: classicRendererSchema.optional().catch(undefined),
  [RendererKind.COMPACT_VIDEO_RENDERER]: classicRendererSchema.optional().catch(undefined),
  [RendererKind.GRID_VIDEO_RENDERER]: classicRendererSchema.optional().catch(undefined),
  [RendererKind.SHORTS_LOCKUP_VIEW_MODEL]: shortsLockupSchema.optional().catch(undefined)
});

/** The shelves a feed section holds */
export enum ShelfRendererKind {
  /** www's shelves (Shorts, "Most relevant"): grid items in `contents` */
  RICH = "richShelfRenderer",
  /** m's Shorts shelf: bare `shortsLockupViewModel`s in `items` */
  REEL = "reelShelfRenderer"
}

/** A section marker: a titled break in the grid, or a shelf with items of its own */
export const sectionItemSchema = z.looseObject({
  richSectionRenderer: z.looseObject({
    content: z
      .looseObject({
        [ShelfRendererKind.RICH]: z.looseObject({ contents: z.array(z.unknown()).optional() }).optional(),
        [ShelfRendererKind.REEL]: z.looseObject({ items: z.array(z.unknown()).optional() }).optional()
      })
      .optional()
  })
});

export const gridItemSchema = z.looseObject({
  richItemRenderer: z.looseObject({ content: richItemContentSchema }).optional().catch(undefined),
  richSectionRenderer: sectionItemSchema.shape.richSectionRenderer.optional().catch(undefined)
});
