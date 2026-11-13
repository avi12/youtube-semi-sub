import { thumbnailListSchema } from "@/lib/youtube/schemas/thumbnail";
import { z } from "@/lib/zod";

// Pieces of a /browse response (or the ytInitialData of a browse page) and of the endpoints that lead to one

export const browseEndpointSchema = z.looseObject({
  browseId: z.string(),
  canonicalBaseUrl: z.string().optional()
});

const tabSchema = z.looseObject({
  tabRenderer: z
    .looseObject({
      tabIdentifier: z.string().optional(),
      content: z
        .looseObject({
          richGridRenderer: z
            .looseObject({
              contents: z.array(z.unknown()),
              targetId: z.string().optional()
            })
            .optional()
        })
        .optional()
    })
    .optional()
});
export type BrowseTab = z.infer<typeof tabSchema>;

/** `twoColumnBrowseResultsRenderer` (www) and `singleColumnBrowseResultsRenderer` (m) */
export const tabbedColumnSchema = z.looseObject({ tabs: z.array(tabSchema) });

/** A channel page's own metadata */
export const channelMetadataRendererSchema = z.looseObject({
  externalId: z.string(),
  title: z.string(),
  vanityChannelUrl: z.string().optional(),
  avatar: thumbnailListSchema.optional()
});
