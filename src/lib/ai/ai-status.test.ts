import { describe, expect, it } from "vitest";

import { AiEngine, AiUnavailableReason, isAiEngineAvailable, isAiModelReady } from "@/lib/ai/ai-status";

describe("AI status checks", () => {
  it("counts an engine as available whether its model is on disk or not", () => {
    const waiting = {
      engine: AiEngine.LITE_RT,
      isModelReady: false,
      download: null
    } as const;
    expect(isAiEngineAvailable(waiting)).toBe(true);
    expect(isAiModelReady(waiting)).toBe(false);
    expect(
      isAiModelReady({
        ...waiting,
        engine: AiEngine.BUILT_IN,
        isModelReady: true
      })
    ).toBe(true);
  });

  it("counts no engine, or a status not known yet, as unavailable", () => {
    expect(
      isAiEngineAvailable({
        engine: AiEngine.NONE,
        reason: AiUnavailableReason.NO_WEB_GPU
      })
    ).toBe(false);
    expect(isAiEngineAvailable(null)).toBe(false);
    expect(isAiModelReady(null)).toBe(false);
  });
});
