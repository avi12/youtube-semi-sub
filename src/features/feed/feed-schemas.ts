import { z } from "@/lib/zod";

// InnerTube shapes the feed reads. Every field is optional and passes unmodelled siblings through, and a
// renderer that fails its schema is dropped (`catch`) instead of failing the whole item

export enum RendererKind {
  lockupViewModel = "lockupViewModel",
  videoWithContextRenderer = "videoWithContextRenderer",
  videoRenderer = "videoRenderer",
  compactVideoRenderer = "compactVideoRenderer",
  gridVideoRenderer = "gridVideoRenderer"
}

export const CLASSIC_RENDERER_KINDS = [
  RendererKind.videoWithContextRenderer,
  RendererKind.videoRenderer,
  RendererKind.compactVideoRenderer,
  RendererKind.gridVideoRenderer
] as const;

const accessibilitySchema = z.looseObject({
  accessibilityData: z.looseObject({ label: z.string() }).optional()
});

const formattedTextSchema = z.looseObject({
  simpleText: z.string().optional(),
  runs: z.array(z.looseObject({ text: z.string() })).optional(),
  accessibility: accessibilitySchema.optional()
});
export type FormattedText = z.infer<typeof formattedTextSchema>;

const imageSourceSchema = z.looseObject({
  url: z.string(),
  width: z.number().optional(),
  height: z.number().optional()
});

const metadataPartSchema = z.looseObject({
  text: z.looseObject({ content: z.string() }).optional(),
  accessibilityLabel: z.string().optional()
});

const metadataRowSchema = z.looseObject({ metadataParts: z.array(metadataPartSchema).optional() });

const thumbnailBadgeSchema = z.looseObject({
  thumbnailBadgeViewModel: z.looseObject({
    text: z.string().optional(),
    rendererContext: z.looseObject({
      accessibilityContext: z.looseObject({ label: z.string().optional() }).optional()
    }).optional()
  }).optional()
});

const lockupSchema = z.looseObject({
  contentId: z.string(),
  contentType: z.string().optional(),
  contentImage: z.looseObject({
    thumbnailViewModel: z.looseObject({
      image: z.looseObject({ sources: z.array(imageSourceSchema).optional() }).optional(),
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

const classicRendererSchema = z.looseObject({
  videoId: z.string(),
  title: formattedTextSchema.optional(),
  headline: formattedTextSchema.optional(),
  publishedTimeText: formattedTextSchema.optional(),
  lengthText: formattedTextSchema.optional(),
  viewCountText: formattedTextSchema.optional(),
  shortViewCountText: formattedTextSchema.optional(),
  thumbnail: z.looseObject({ thumbnails: z.array(imageSourceSchema).optional() }).optional()
});

const shortsLockupSchema = z.looseObject({
  onTap: z.looseObject({
    innertubeCommand: z.looseObject({
      reelWatchEndpoint: z.looseObject({ videoId: z.string() })
    })
  })
});

export const richItemContentSchema = z.looseObject({
  [RendererKind.lockupViewModel]: lockupSchema.optional().catch(undefined),
  [RendererKind.videoWithContextRenderer]: classicRendererSchema.optional().catch(undefined),
  [RendererKind.videoRenderer]: classicRendererSchema.optional().catch(undefined),
  [RendererKind.compactVideoRenderer]: classicRendererSchema.optional().catch(undefined),
  [RendererKind.gridVideoRenderer]: classicRendererSchema.optional().catch(undefined),
  shortsLockupViewModel: shortsLockupSchema.optional().catch(undefined)
});

export const gridItemSchema = z.looseObject({
  richItemRenderer: z.looseObject({ content: richItemContentSchema }).optional().catch(undefined),
  richSectionRenderer: z.looseObject({
    content: z.looseObject({
      richShelfRenderer: z.looseObject({ contents: z.array(z.unknown()).optional() }).optional()
    }).optional()
  }).optional().catch(undefined)
});

const tabSchema = z.looseObject({
  tabRenderer: z.looseObject({
    tabIdentifier: z.string().optional(),
    content: z.looseObject({
      richGridRenderer: z.looseObject({
        contents: z.array(z.unknown()),
        targetId: z.string().optional()
      }).optional()
    }).optional()
  }).optional()
});
export type BrowseTab = z.infer<typeof tabSchema>;

const tabbedColumnSchema = z.looseObject({ tabs: z.array(tabSchema) });

export const browseResponseSchema = z.looseObject({
  responseContext: z.looseObject({
    serviceTrackingParams: z.array(
      z.looseObject({
        params: z.array(
          z.looseObject({
            key: z.string(),
            value: z.string()
          })
        ).optional()
      })
    ).optional()
  }).optional(),
  contents: z.looseObject({
    twoColumnBrowseResultsRenderer: tabbedColumnSchema.optional(),
    singleColumnBrowseResultsRenderer: tabbedColumnSchema.optional()
  }),
  metadata: z.looseObject({
    channelMetadataRenderer: z.looseObject({
      avatar: z.looseObject({ thumbnails: z.array(imageSourceSchema).optional() }).optional()
    }).optional()
  }).optional()
});
export type BrowseResponse = z.infer<typeof browseResponseSchema>;
