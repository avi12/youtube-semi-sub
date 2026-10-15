import { z } from "@/lib/zod";

/** One size of an image: renderers list them as `thumbnails`, view models as `sources` */
export const thumbnailSchema = z.looseObject({
  url: z.string(),
  width: z.number().optional(),
  height: z.number().optional()
});
export type Thumbnail = z.infer<typeof thumbnailSchema>;

/** A renderer's image: every size YouTube offers */
export const thumbnailListSchema = z.looseObject({
  thumbnails: z.array(thumbnailSchema)
});
