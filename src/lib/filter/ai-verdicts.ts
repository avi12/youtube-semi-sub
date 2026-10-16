import { getAiFilterKey } from "@/lib/filter/ai-filter-key";
import { FilterKind } from "@/lib/filter/title-filter";
import { type ChannelVideosCache, videoIdSchema } from "@/lib/schemas/feed-video";
import type { SemiSubscription, SemiSubscriptions } from "@/lib/schemas/semi-subscription";
import { z } from "@/lib/zod";

/** What the model said about each video under one AI filter: true when the video fits the description */
const videoVerdictsSchema = z.record(videoIdSchema, z.boolean());
export type VideoVerdicts = z.infer<typeof videoVerdictsSchema>;

/** The verdicts per AI filter key (`getAiFilterKey`) */
export const aiVerdictsSchema = z.record(z.string(), videoVerdictsSchema);
export type AiVerdicts = z.infer<typeof aiVerdictsSchema>;

/** The keys of a channel's AI filters - in either mode, so switching modes back and forth keeps their verdicts */
export function collectAiFilterKeys(subscription: Pick<SemiSubscription, "followFilter" | "hideFilter"> | undefined) {
  const keys = new Set<string>();
  for (const filter of [subscription?.followFilter, subscription?.hideFilter]) {
    if (filter?.kind === FilterKind.aiMatch) {
      keys.add(getAiFilterKey(filter));
    }
  }
  return keys;
}

/** Per AI filter key in use, the videos a channel using it still has cached */
function collectReferencedVideoIds({ subscriptions, channelVideos }: {
  subscriptions: SemiSubscriptions;
  channelVideos: ChannelVideosCache;
}) {
  const videoIdsByKey = new Map<string, Set<string>>();
  for (const channelId in subscriptions) {
    for (const key of collectAiFilterKeys(subscriptions[channelId])) {
      const videoIds = videoIdsByKey.get(key) ?? new Set();
      for (const video of channelVideos[channelId]?.videos ?? []) {
        videoIds.add(video.videoId);
      }
      videoIdsByKey.set(key, videoIds);
    }
  }
  return videoIdsByKey;
}

/**
 * Keeps only the verdicts a semi-subscription can still use: keys of AI filters in use, and within each key the videos
 * still cached for a channel that uses it. A preview's verdicts for a channel that was never saved go too
 */
export function pruneAiVerdicts({ aiVerdicts, subscriptions, channelVideos }: {
  aiVerdicts: AiVerdicts;
  subscriptions: SemiSubscriptions;
  channelVideos: ChannelVideosCache;
}) {
  const referencedVideoIds = collectReferencedVideoIds({
    subscriptions,
    channelVideos
  });
  const pruned: AiVerdicts = {};
  for (const key in aiVerdicts) {
    const videoIds = referencedVideoIds.get(key);
    const verdicts = aiVerdicts[key];
    if (!videoIds || !verdicts) {
      continue;
    }

    const keptVerdicts: VideoVerdicts = {};
    for (const videoId in verdicts) {
      const verdict = verdicts[videoId];
      const isKept = verdict !== undefined && videoIds.has(videoId);
      if (isKept) {
        keptVerdicts[videoId] = verdict;
      }
    }

    const hasVerdicts = Object.keys(keptVerdicts).length > 0;
    if (hasVerdicts) {
      pruned[key] = keptVerdicts;
    }
  }
  return pruned;
}

export function countAiVerdicts(aiVerdicts: AiVerdicts) {
  let count = 0;
  for (const key in aiVerdicts) {
    count += Object.keys(aiVerdicts[key] ?? {}).length;
  }
  return count;
}
