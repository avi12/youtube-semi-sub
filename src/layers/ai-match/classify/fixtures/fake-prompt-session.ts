import { vi } from "vitest";

import { promptVideoSchema } from "#ai-match/classify/prompt";
import type { PromptSession } from "#ai-match/engine/prompt-api";
import { parseJson } from "@/lib/utils/json";

const MATCHING_TITLE_PREFIX = "Review";

/** What a well-behaved model says: a title starting with "Review" matches. Reads the batch back from the prompt */
export function answerFromPrompt(input: string) {
  const verdicts = [];
  for (const line of input.split("\n")) {
    const parsed = promptVideoSchema.safeParse(parseJson(line));
    if (parsed.success) {
      verdicts.push({
        id: parsed.data.id,
        match: parsed.data.title.startsWith(MATCHING_TITLE_PREFIX)
      });
    }
  }
  return JSON.stringify({ verdicts });
}

export function createSessionMock(answer: (input: string) => string) {
  return {
    prompt: vi.fn<PromptSession["prompt"]>(async input => answer(input)),
    destroy: vi.fn<PromptSession["destroy"]>()
  };
}

/** A fake base session whose clones answer like a model would, each tracked for the assertions */
export function createFakeBase(answer: (input: string) => string = answerFromPrompt) {
  const clones: ReturnType<typeof createSessionMock>[] = [];
  const base = {
    ...createSessionMock(answer),
    clone: vi.fn<NonNullable<PromptSession["clone"]>>(async () => {
      const clone = createSessionMock(answer);
      clones.push(clone);
      return clone;
    })
  };
  return {
    base,
    clones
  };
}
