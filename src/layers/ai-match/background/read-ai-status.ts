import { AiEngine, type AiStatus } from "@/lib/ai/ai-status";
import { type AiEngineProbes, resolveAiEngine } from "#ai-match/engine/engine-resolution";
import { probeLiteRtSupport } from "#ai-match/engine/litert-support";
import { BuiltInAvailability, readBuiltInAvailability } from "#ai-match/engine/prompt-api";

// The background's own view: classification runs here, so the Prompt API counts only when this very context (the
// Chromium service worker, Firefox's event page) exposes it
const BACKGROUND_PROBES: AiEngineProbes = {
  readBuiltInAvailability,
  probeLiteRtSupport
};

async function readBuiltInStatus() {
  const availability = await readBuiltInAvailability();
  const status: AiStatus = {
    engine: AiEngine.builtIn,
    isModelReady: availability === BuiltInAvailability.available,
    download: availability === BuiltInAvailability.downloading
      ? {
        fraction: null
      }
      : null
  };
  return status;
}

/** The engine this browser uses for AI match and whether its model is on disk - probed fresh on every call */
export async function readAiStatus() {
  const choice = await resolveAiEngine(BACKGROUND_PROBES);
  if (choice.engine === AiEngine.builtIn) {
    return await readBuiltInStatus();
  }

  if (choice.engine === AiEngine.liteRt) {
    const status: AiStatus = {
      engine: AiEngine.liteRt,
      isModelReady: false,
      download: null
    };
    return status;
  }

  const status: AiStatus = choice;
  return status;
}
