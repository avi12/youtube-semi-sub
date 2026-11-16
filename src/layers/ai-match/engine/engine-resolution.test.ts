import { describe, expect, it, vi } from "vitest";

import { AiEngine, type AiEngineChoice, AiUnavailableReason } from "@/lib/ai/ai-status";

import { type AiEngineProbes, type LiteRtSupport, resolveAiEngine } from "./engine-resolution";
import { BuiltInAvailability } from "./prompt-api";

const FULL_SUPPORT: LiteRtSupport = {
  isWebGpuAvailable: true,
  isWasmRuntimeSupported: true
};
const NO_WEBGPU: LiteRtSupport = {
  isWebGpuAvailable: false,
  isWasmRuntimeSupported: true
};
const OLD_WASM: LiteRtSupport = {
  isWebGpuAvailable: true,
  isWasmRuntimeSupported: false
};

const BUILT_IN: AiEngineChoice = { engine: AiEngine.BUILT_IN };
const LITE_RT: AiEngineChoice = { engine: AiEngine.LITE_RT };

function createProbes({
  builtInAvailability,
  liteRtSupport
}: {
  builtInAvailability: BuiltInAvailability | null;
  liteRtSupport: LiteRtSupport;
}) {
  return {
    readBuiltInAvailability: vi.fn<AiEngineProbes["readBuiltInAvailability"]>(async () => builtInAvailability),
    probeLiteRtSupport: vi.fn<AiEngineProbes["probeLiteRtSupport"]>(async () => liteRtSupport)
  };
}

describe("resolveAiEngine", () => {
  // A browser is just a combination of answers: Chrome with Nano, Edge whose worker lacks LanguageModel, Firefox...
  it.each([
    ["Chrome with the model on disk", BuiltInAvailability.AVAILABLE, NO_WEBGPU, BUILT_IN],
    ["Chrome before the download", BuiltInAvailability.DOWNLOADABLE, FULL_SUPPORT, BUILT_IN],
    ["Chrome mid-download", BuiltInAvailability.DOWNLOADING, FULL_SUPPORT, BUILT_IN],
    ["a device that can't run the built-in model", BuiltInAvailability.UNAVAILABLE, FULL_SUPPORT, LITE_RT],
    ["no Prompt API in the worker (Firefox, Edge, Opera...)", null, FULL_SUPPORT, LITE_RT],
    [
      "no Prompt API and no WebGPU",
      null,
      NO_WEBGPU,
      {
        engine: AiEngine.NONE,
        reason: AiUnavailableReason.NO_WEB_GPU
      }
    ],
    [
      "no Prompt API and wasm without JSPI or relaxed SIMD",
      null,
      OLD_WASM,
      {
        engine: AiEngine.NONE,
        reason: AiUnavailableReason.OUTDATED_BROWSER
      }
    ],
    [
      "an unusable built-in model and no WebGPU",
      BuiltInAvailability.UNAVAILABLE,
      NO_WEBGPU,
      {
        engine: AiEngine.NONE,
        reason: AiUnavailableReason.NO_WEB_GPU
      }
    ]
  ] satisfies [string, BuiltInAvailability | null, LiteRtSupport, AiEngineChoice][])(
    "%s",
    async (_name, builtInAvailability, liteRtSupport, expected) => {
      expect(
        await resolveAiEngine(
          createProbes({
            builtInAvailability,
            liteRtSupport
          })
        )
      ).toEqual(expected);
    }
  );

  it("never probes WebGPU when the built-in model is usable", async () => {
    const probes = createProbes({
      builtInAvailability: BuiltInAvailability.AVAILABLE,
      liteRtSupport: FULL_SUPPORT
    });
    await resolveAiEngine(probes);
    expect(probes.probeLiteRtSupport).not.toHaveBeenCalled();
  });
});
