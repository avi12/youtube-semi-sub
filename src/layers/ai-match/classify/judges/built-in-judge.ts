import { parseJson } from "@/lib/utils/json";
import type { BatchJudge } from "#ai-match/classify/classifier";
import { buildBatchPrompt, buildResponseConstraint } from "#ai-match/classify/prompt";
import { parseVerdictReply } from "#ai-match/classify/reply/verdict-parser";
import type { PromptSession } from "#ai-match/engine/prompt-api";

const PROMPT_TIMEOUT_MS = 60_000;
const SESSION_UNAVAILABLE_ERROR = "The built-in model is not available";

/**
 * Judges batches through the Prompt API. The base session (system prompt and worked example) is opened once; each
 * batch runs in its own clone that is destroyed right after, so no batch ever sees another's videos. Without clone(),
 * each batch opens a fresh session instead
 */
export function createBuiltInJudge(openSession: () => Promise<PromptSession | null>) {
  let basePromise: Promise<PromptSession | null> | null = null;

  async function openBatchSession() {
    basePromise ??= openSession();
    const base = await basePromise;
    if (!base) {
      return null;
    }

    if (base.clone) {
      return await base.clone({
        signal: AbortSignal.timeout(PROMPT_TIMEOUT_MS)
      });
    }

    return await openSession();
  }

  const judge: BatchJudge = {
    async judgeBatch(batch) {
      const session = await openBatchSession();
      if (!session) {
        throw new Error(SESSION_UNAVAILABLE_ERROR);
      }

      try {
        const reply = await session.prompt(buildBatchPrompt(batch), {
          responseConstraint: buildResponseConstraint(batch.videos.length),
          signal: AbortSignal.timeout(PROMPT_TIMEOUT_MS)
        });
        return parseVerdictReply({
          reply: parseJson(reply),
          count: batch.videos.length
        });
      } finally {
        session.destroy();
      }
    },
    async close() {
      const base = await basePromise?.catch(() => null);
      base?.destroy();
    }
  };
  return judge;
}
