import { feedVideoSchema } from "@/lib/schemas/feed-video";
import { z } from "@/lib/zod";

// A planned position in the band or the Shorts shelf: an item the feed already holds, or a semi-subscribed upload to
// build an item for

const feedSlotBaseSchema = z.object({
  videoId: z.string()
});

const feedItemSlotSchema = feedSlotBaseSchema.extend({
  item: z.unknown()
});
export type FeedItemSlot = z.infer<typeof feedItemSlotSchema>;

const feedVideoSlotSchema = feedSlotBaseSchema.extend({
  video: feedVideoSchema
});

const feedSlotSchema = z.union([feedItemSlotSchema, feedVideoSlotSchema]);
export type FeedSlot = z.infer<typeof feedSlotSchema>;

/** Which side of its anchor item a placed video stands on */
export enum AnchorSide {
  AFTER = "after",
  BEFORE = "before"
}

/** The band item a placed video stands next to: the one before it, or the one after it at the band's start */
const placementAnchorSchema = z.object({
  videoId: z.string(),
  side: z.enum(AnchorSide)
});
export type PlacementAnchor = z.infer<typeof placementAnchorSchema>;
