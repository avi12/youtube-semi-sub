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

/** The first character of a channel's title, for an avatar placeholder (a whole emoji or surrogate pair, not half) */
export function getChannelInitial(title: string) {
  return Array.from(title).at(0) ?? "";
}
