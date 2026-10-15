import { tabbedColumnSchema } from "@/lib/youtube/schemas/browse";
import {
  CLASSIC_RENDERER_KINDS,
  classicRendererSchema,
  lockupSchema,
  RendererKind
} from "@/lib/youtube/schemas/renderers";
import { thumbnailListSchema } from "@/lib/youtube/schemas/thumbnail";
import { z } from "@/lib/zod";

// The feed's own InnerTube shapes, built from the shared ones in @/lib/youtube/schemas

/** A video item's renderer, tagged with the key it sits under */
export const videoRendererSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal(RendererKind.lockupViewModel),
    renderer: lockupSchema
  }),
  z.object({
    kind: z.enum(CLASSIC_RENDERER_KINDS),
    renderer: classicRendererSchema
  })
]);
export type VideoRenderer = z.infer<typeof videoRendererSchema>;

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
      avatar: thumbnailListSchema.partial().optional()
    }).optional()
  }).optional()
});
export type BrowseResponse = z.infer<typeof browseResponseSchema>;

/** A later page of a feed: its items arrive as a continuation of the grid the first page rendered */
export const continuationResponseSchema = z.looseObject({
  responseContext: browseResponseSchema.shape.responseContext,
  onResponseReceivedActions: z.array(
    z.looseObject({
      appendContinuationItemsAction: z.looseObject({
        continuationItems: z.array(z.unknown()),
        targetId: z.string().optional()
      }).optional()
    })
  )
});
