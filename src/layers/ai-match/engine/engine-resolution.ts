import { BuiltInAvailability } from "./prompt-api";
import { AiEngine, type AiEngineChoice, AiUnavailableReason } from "@/lib/ai/ai-status";
import { z } from "@/lib/zod";

/** What the local LiteRT-LM model needs from the browser */
const liteRtSupportSchema = z.object({
  /** A real (not software-fallback) WebGPU adapter */
  isWebGpuAvailable: z.boolean(),
  /** JSPI and relaxed SIMD, which the one shipped LiteRT-LM wasm build relies on */
  isWasmRuntimeSupported: z.boolean()
});
export type LiteRtSupport = z.infer<typeof liteRtSupportSchema>;

/** How the context that runs classification sees each engine. LiteRT is only probed when the built-in one is out */
export interface AiEngineProbes {
  /** null when this context has no `LanguageModel` at all */
  readBuiltInAvailability(): Promise<BuiltInAvailability | null>;
  probeLiteRtSupport(): Promise<LiteRtSupport>;
}

/**
 * The one rule, the same on every browser: the built-in Prompt API whenever this context has it and the device can
 * run it (on disk or downloadable), otherwise LiteRT-LM when WebGPU and the wasm runtime are there, otherwise nothing.
 * There is no per-browser branch - Edge, Firefox and the rest simply answer the probes differently
 */
export async function resolveAiEngine(probes: AiEngineProbes) {
  const builtInAvailability = await probes.readBuiltInAvailability();
  const isBuiltInUsable = builtInAvailability !== null && builtInAvailability !== BuiltInAvailability.unavailable;
  if (isBuiltInUsable) {
    const choice: AiEngineChoice = { engine: AiEngine.builtIn };
    return choice;
  }

  const { isWebGpuAvailable, isWasmRuntimeSupported } = await probes.probeLiteRtSupport();
  if (!isWebGpuAvailable) {
    const choice: AiEngineChoice = {
      engine: AiEngine.none,
      reason: AiUnavailableReason.noWebGpu
    };
    return choice;
  }

  if (!isWasmRuntimeSupported) {
    const choice: AiEngineChoice = {
      engine: AiEngine.none,
      reason: AiUnavailableReason.outdatedBrowser
    };
    return choice;
  }

  const choice: AiEngineChoice = { engine: AiEngine.liteRt };
  return choice;
}
