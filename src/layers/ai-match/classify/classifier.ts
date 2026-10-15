import { AI_BATCH_SIZE } from "./prompt";
import { feedVideoSchema } from "@/lib/schemas/feed-video";
import { z } from "@/lib/zod";

/** One prompt's worth: the filter's description and up to `AI_BATCH_SIZE` videos, numbered 1..N in the prompt */
const videoBatchSchema = z.object({
  description: z.string(),
  videos: z.array(feedVideoSchema)
});
export type VideoBatch = z.infer<typeof videoBatchSchema>;

/** An engine's way to judge one batch: verdicts by the video's 1-based position; a missing id stays pending */
export interface BatchJudge {
  judgeBatch(batch: VideoBatch): Promise<Map<number, boolean>>;
  /** Frees whatever the judge opened (a base session); the judge isn't used afterwards */
  close(): Promise<void>;
}

function splitIntoBatches<Item>(items: Item[]) {
  const batches: Item[][] = [];
  for (let i = 0; i < items.length; i += AI_BATCH_SIZE) {
    batches.push(items.slice(i, i + AI_BATCH_SIZE));
  }
  return batches;
}

/**
 * Judges videos against one AI filter, batch by batch, handing each batch's verdicts (by video id) to `onVerdicts`
 * as soon as they arrive, so progress survives an interruption. Stops early once `shouldContinue` says so; a judge
 * that throws stops the run and leaves the remaining videos pending
 */
export async function classifyVideos({ description, videos, judge, onVerdicts, shouldContinue }: VideoBatch & {
  judge: BatchJudge;
  onVerdicts: (verdicts: Record<string, boolean>) => Promise<void>;
  shouldContinue: () => Promise<boolean>;
}) {
  for (const batchVideos of splitIntoBatches(videos)) {
    if (!await shouldContinue()) {
      return;
    }

    const verdictsById = await judge.judgeBatch({
      description,
      videos: batchVideos
    });
    const verdicts: Record<string, boolean> = {};
    for (const [id, isMatch] of verdictsById) {
      const video = batchVideos[id - 1];
      if (video) {
        verdicts[video.videoId] = isMatch;
      }
    }

    const hasVerdicts = Object.keys(verdicts).length > 0;
    if (hasVerdicts) {
      await onVerdicts(verdicts);
    }
  }
}
