import { channelVideosCacheSchema } from "@/lib/schemas/feed-video";
import { semiSubscriptionsSchema } from "@/lib/schemas/semi-subscription";
import { z } from "@/lib/zod";

/** What the extension keeps in storage and every surface shows: the settings, the semi-subscriptions, their uploads */
export const storedStateSchema = z.object({
  isExtensionEnabled: z.boolean(),
  isAnimationsEnabled: z.boolean(),
  subscriptions: semiSubscriptionsSchema,
  channelVideos: channelVideosCacheSchema
});
export type StoredState = z.infer<typeof storedStateSchema>;
