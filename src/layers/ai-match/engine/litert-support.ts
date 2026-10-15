import type { LiteRtSupport } from "./engine-resolution";
import { z } from "@/lib/zod";

/**
 * The relaxed-SIMD check LiteRT-LM's own loader runs:
 * (module (func (result v128) i32.const 1 i8x16.splat i32.const 2 i8x16.splat i8x16.relaxed_swizzle))
 */
const RELAXED_SIMD_PROBE = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1,
  0, 10, 15, 1, 13, 0, 65, 1, 253, 15, 65, 2, 253, 15, 253, 128, 2, 11
]);
const JSPI_GLOBAL = "Suspending";

/** A software adapter would run a 2B-parameter model at a crawl, so it counts as no WebGPU */
const fallbackAdapterSchema = z.looseObject({
  info: z.looseObject({
    isFallbackAdapter: z.literal(true)
  })
});

async function hasHardwareWebGpu() {
  if (!("gpu" in navigator)) {
    return false;
  }

  const adapter = await navigator.gpu.requestAdapter().catch(() => null);
  return adapter !== null && !fallbackAdapterSchema.safeParse(adapter).success;
}

/**
 * Whether this context could run LiteRT-LM. Only the JSPI + relaxed-SIMD wasm build ships (the others would add
 * ~60 MB), so both features are required: Chromium 137+ and Firefox 153+ have them
 */
export async function probeLiteRtSupport() {
  const support: LiteRtSupport = {
    isWebGpuAvailable: await hasHardwareWebGpu(),
    isWasmRuntimeSupported: JSPI_GLOBAL in WebAssembly && WebAssembly.validate(RELAXED_SIMD_PROBE)
  };
  return support;
}
