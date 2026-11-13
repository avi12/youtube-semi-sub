import { type AiEngineProbes, resolveAiEngine } from "#ai-match/engine/engine-resolution";
import { probeLiteRtSupport } from "#ai-match/engine/litert-support";
import { readLocalModelDownloadFraction } from "#ai-match/engine/litert/litert-client";
import { isLiteRtModelCached } from "#ai-match/engine/litert/litert-model";
import { BuiltInAvailability, readBuiltInAvailability } from "#ai-match/engine/prompt-api";
import { AiEngine, type AiStatus } from "@/lib/ai/ai-status";

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
    download:
      availability === BuiltInAvailability.downloading
        ? {
            fraction: null
          }
        : null
  };
  return status;
}

async function readLiteRtStatus() {
  const [isModelReady, fraction] = await Promise.all([isLiteRtModelCached(), readLocalModelDownloadFraction()]);
  const status: AiStatus = {
    engine: AiEngine.liteRt,
    isModelReady,
    download:
      fraction === null
        ? null
        : {
            fraction
          }
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
    return await readLiteRtStatus();
  }

  const status: AiStatus = choice;
  return status;
}
