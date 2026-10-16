import type { AiFilter } from "@/lib/filter/title-filter";
import { WHITESPACE_RUN_PATTERN } from "@/lib/utils/text";

/**
 * Part of every AI verdict's cache key: bump it whenever the prompt or the model output changes meaning, so verdicts
 * judged under the old prompt are re-judged instead of reused
 */
export const AI_PROMPT_VERSION = 1;

/** The description exactly as the model reads it - trivial edits (spacing, Unicode form) keep the same verdicts */
export function normalizeAiDescription(description: string) {
  return description.normalize("NFC").trim().replaceAll(WHITESPACE_RUN_PATTERN, " ");
}

/** Synchronous, so `selectFeedVideos` can look verdicts up without waiting on anything */
export function getAiFilterKey({ description }: Pick<AiFilter, "description">) {
  return `v${AI_PROMPT_VERSION}:${normalizeAiDescription(description)}`;
}
