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
    kind: z.literal(RendererKind.LOCKUP_VIEW_MODEL),
    renderer: lockupSchema
  }),
  z.object({
    kind: z.enum(CLASSIC_RENDERER_KINDS),
    renderer: classicRendererSchema
  })
]);
export type VideoRenderer = z.infer<typeof videoRendererSchema>;

export const VERIFIED_ICON_NAME = "CHECK_CIRCLE_FILLED";

const channelHeaderSchema = z.looseObject({
  pageHeaderRenderer: z
    .looseObject({
      content: z
        .looseObject({
          pageHeaderViewModel: z
            .looseObject({
              title: z
                .looseObject({
                  dynamicTextViewModel: z
                    .looseObject({
                      text: z
                        .looseObject({
                          attachmentRuns: z
                            .array(
                              z.looseObject({
                                element: z
                                  .looseObject({
                                    type: z
                                      .looseObject({
                                        imageType: z
                                          .looseObject({
                                            image: z.looseObject({
                                              sources: z
                                                .array(
                                                  z.looseObject({
                                                    clientResource: z
                                                      .looseObject({
                                                        imageName: z.string().optional()
                                                      })
                                                      .optional()
                                                  })
                                                )
                                                .optional()
                                            })
                                          })
                                          .optional()
                                      })
                                      .optional()
                                  })
                                  .optional()
                              })
                            )
                            .optional()
                        })
                        .optional()
                    })
                    .optional()
                })
                .optional()
            })
            .optional()
        })
        .optional()
    })
    .optional()
});

export function isVerifiedChannelHeader(header: unknown) {
  const parsed = channelHeaderSchema.safeParse(header);
  if (!parsed.success) {
    return false;
  }

  const runs =
    parsed.data.pageHeaderRenderer?.content?.pageHeaderViewModel?.title?.dynamicTextViewModel?.text?.attachmentRuns ??
    [];
  return runs.some(run =>
    run.element?.type?.imageType?.image?.sources?.some(
      source => source.clientResource?.imageName === VERIFIED_ICON_NAME
    )
  );
}

export const browseResponseSchema = z.looseObject({
  header: z.unknown().optional(),
  responseContext: z
    .looseObject({
      serviceTrackingParams: z
        .array(
          z.looseObject({
            params: z
              .array(
                z.looseObject({
                  key: z.string(),
                  value: z.string()
                })
              )
              .optional()
          })
        )
        .optional()
    })
    .optional(),
  contents: z.looseObject({
    twoColumnBrowseResultsRenderer: tabbedColumnSchema.optional(),
    singleColumnBrowseResultsRenderer: tabbedColumnSchema.optional()
  }),
  metadata: z
    .looseObject({
      channelMetadataRenderer: z
        .looseObject({
          avatar: thumbnailListSchema.partial().optional()
        })
        .optional()
    })
    .optional()
});
export type BrowseResponse = z.infer<typeof browseResponseSchema>;

/** A later page of a feed: its items arrive as a continuation of the grid the first page rendered */
export const continuationResponseSchema = z.looseObject({
  responseContext: browseResponseSchema.shape.responseContext,
  onResponseReceivedActions: z.array(
    z.looseObject({
      appendContinuationItemsAction: z
        .looseObject({
          continuationItems: z.array(z.unknown()),
          targetId: z.string().optional()
        })
        .optional()
    })
  )
});
