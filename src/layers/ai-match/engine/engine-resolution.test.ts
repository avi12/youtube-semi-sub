import { type AiEngineProbes, type LiteRtSupport, resolveAiEngine } from "./engine-resolution";
import { BuiltInAvailability } from "./prompt-api";
import { AiEngine, type AiEngineChoice, AiUnavailableReason } from "@/lib/ai/ai-status";
import { describe, expect, it, vi } from "vitest";

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

const BUILT_IN: AiEngineChoice = { engine: AiEngine.builtIn };
const LITE_RT: AiEngineChoice = { engine: AiEngine.liteRt };

function createProbes({ builtInAvailability, liteRtSupport }: {
  builtInAvailability: BuiltInAvailability | null;
  liteRtSupport: LiteRtSupport;
}) {
  const probes: AiEngineProbes = {
    readBuiltInAvailability: vi.fn(async () => builtInAvailability),
    probeLiteRtSupport: vi.fn(async () => liteRtSupport)
  };
  return probes;
}

describe("resolveAiEngine", () => {
  // A browser is just a combination of answers: Chrome with Nano, Edge whose worker lacks LanguageModel, Firefox...
  it.each([
    ["Chrome with the model on disk", BuiltInAvailability.available, NO_WEBGPU, BUILT_IN],
    ["Chrome before the download", BuiltInAvailability.downloadable, FULL_SUPPORT, BUILT_IN],
    ["Chrome mid-download", BuiltInAvailability.downloading, FULL_SUPPORT, BUILT_IN],
    ["a device that can't run the built-in model", BuiltInAvailability.unavailable, FULL_SUPPORT, LITE_RT],
    ["no Prompt API in the worker (Firefox, Edge, Opera...)", null, FULL_SUPPORT, LITE_RT],
    ["no Prompt API and no WebGPU", null, NO_WEBGPU, {
      engine: AiEngine.none,
      reason: AiUnavailableReason.noWebGpu
    }],
    ["no Prompt API and wasm without JSPI or relaxed SIMD", null, OLD_WASM, {
      engine: AiEngine.none,
      reason: AiUnavailableReason.outdatedBrowser
    }],
    ["an unusable built-in model and no WebGPU", BuiltInAvailability.unavailable, NO_WEBGPU, {
      engine: AiEngine.none,
      reason: AiUnavailableReason.noWebGpu
    }]
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
      builtInAvailability: BuiltInAvailability.available,
      liteRtSupport: FULL_SUPPORT
    });
    await resolveAiEngine(probes);
    expect(probes.probeLiteRtSupport).not.toHaveBeenCalled();
  });
});
