import { channelInfoSchema } from "@/lib/schemas/channel";
import { z } from "@/lib/zod";

export enum PageKind {
  WATCH = "watch",
  CHANNEL = "channel"
}

export const pageDataSchema = z.looseObject({
  response: z.unknown().optional(),
  playerResponse: z.unknown().optional()
});
export type PageData = z.infer<typeof pageDataSchema>;

/** The channel a watch or channel page is about, plus what the page data says about the viewer's relation to it */
export const pageChannelSchema = z.object({
  kind: z.enum(PageKind),
  channel: channelInfoSchema,
  videoId: z.string().optional(),
  isOwnedByViewer: z.boolean(),
  hasSubscribeControl: z.boolean(),
  officialSubscription: z.boolean().optional(),
  /** Every channel of a collaboration, uploader included; empty for a video with one channel */
  collaborators: z.array(channelInfoSchema.extend({ isSubscribed: z.boolean().optional() }))
});
export type PageChannel = z.infer<typeof pageChannelSchema>;
