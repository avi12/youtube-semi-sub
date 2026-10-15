import { z } from "@/lib/zod";

export const CHANNEL_ID_PATTERN = /^UC[\w-]{22}$/;
export const channelIdSchema = z.string().regex(CHANNEL_ID_PATTERN);

export const channelInfoSchema = z.object({
  channelId: channelIdSchema,
  title: z.string(),
  handle: z.string().optional(),
  avatarUrl: z.url().optional()
});
export type ChannelInfo = z.infer<typeof channelInfoSchema>;
