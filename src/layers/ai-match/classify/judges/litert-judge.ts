import { type ChatMessage, ChatRole } from "@/lib/ai/chat-message";
import type { BatchJudge } from "#ai-match/classify/classifier";
import { buildBatchPrompt, buildPrefaceMessages } from "#ai-match/classify/prompt";
import { extractJsonFromText } from "#ai-match/classify/reply/extract-json";
import { parseVerdictReply } from "#ai-match/classify/reply/verdict-parser";

/** Each local generation is expensive, and the worked example usually lands valid JSON the first time */
const MAX_ATTEMPTS = 2;
const MODEL_FAILED_ERROR = "The local model couldn't run";

/**
 * Judges batches through LiteRT-LM, which has no structured-output constraint: the worked example pins the reply's
 * shape and the JSON is pulled out of whatever prose surrounds it. A second attempt fills in ids the first one
 * skipped; what is still missing stays pending
 */
export function createLiteRtJudge(infer: (messages: ChatMessage[]) => Promise<string | null>) {
  const judge: BatchJudge = {
    async judgeBatch(batch) {
      const messages: ChatMessage[] = [
        ...buildPrefaceMessages(),
        {
          role: ChatRole.user,
          content: buildBatchPrompt(batch)
        }
      ];
      const verdictsById = new Map<number, boolean>();
      for (let attempt = 0; attempt < MAX_ATTEMPTS && verdictsById.size < batch.videos.length; attempt++) {
        const reply = await infer(messages);
        // No reply at all means the engine itself failed - stop the pass instead of failing every batch slowly
        if (reply === null) {
          throw new Error(MODEL_FAILED_ERROR);
        }

        const verdicts = parseVerdictReply({
          reply: extractJsonFromText(reply),
          count: batch.videos.length
        });
        for (const [id, isMatch] of verdicts) {
          if (!verdictsById.has(id)) {
            verdictsById.set(id, isMatch);
          }
        }
      }
      return verdictsById;
    },
    async close() {}
  };
  return judge;
}
