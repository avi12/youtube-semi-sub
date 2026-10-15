import { aiVerdictsSchema } from "@/lib/filter/ai-verdicts";
import { channelVideosCacheSchema } from "@/lib/schemas/feed-video";
import { semiSubscriptionsSchema } from "@/lib/schemas/semi-subscription";
import { z } from "@/lib/zod";

/** What the extension keeps in storage and every surface shows: the settings, the semi-subscriptions, their uploads */
export const storedStateSchema = z.object({
  isExtensionEnabled: z.boolean(),
  isAnimationsEnabled: z.boolean(),
  /** The user opted in to AI match; until then AI filters are paused and nothing AI runs or downloads */
  isAiEnabled: z.boolean(),
  subscriptions: semiSubscriptionsSchema,
  channelVideos: channelVideosCacheSchema,
  aiVerdicts: aiVerdictsSchema
});
export type StoredState = z.infer<typeof storedStateSchema>;
