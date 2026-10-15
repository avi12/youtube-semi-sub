import { parseJson } from "@/lib/utils/json";
import type { PromptSession } from "#ai-match/engine/prompt-api";
import { vi } from "vitest";

const MATCHING_TITLE_PREFIX = "Review";

/** What a well-behaved model says: a title starting with "Review" matches. Reads the batch back from the prompt */
export function answerFromPrompt(input: string) {
  const verdicts = [];
  for (const line of input.split("\n")) {
    const video = parseJson(line);
    const isVideoLine = typeof video === "object" && video !== null && "id" in video && "title" in video;
    if (isVideoLine) {
      verdicts.push({
        id: video.id,
        match: String(video.title).startsWith(MATCHING_TITLE_PREFIX)
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
