import { describe, expect, it } from "vitest";

import { AiEngine, AiUnavailableReason, isAiEngineAvailable, isAiModelReady } from "@/lib/ai/ai-status";

describe("AI status checks", () => {
  it("counts an engine as available whether its model is on disk or not", () => {
    const waiting = {
      engine: AiEngine.liteRt,
      isModelReady: false,
      download: null
    } as const;
    expect(isAiEngineAvailable(waiting)).toBe(true);
    expect(isAiModelReady(waiting)).toBe(false);
    expect(
      isAiModelReady({
        ...waiting,
        engine: AiEngine.builtIn,
        isModelReady: true
      })
    ).toBe(true);
  });

  it("counts no engine, or a status not known yet, as unavailable", () => {
    expect(
      isAiEngineAvailable({
        engine: AiEngine.none,
        reason: AiUnavailableReason.noWebGpu
      })
    ).toBe(false);
    expect(isAiEngineAvailable(null)).toBe(false);
    expect(isAiModelReady(null)).toBe(false);
  });
});
