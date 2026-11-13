import { z } from "@/lib/zod";

/** Which model judges AI filters, resolved at runtime by one rule on every browser (see `resolveAiEngine`) */
export enum AiEngine {
  /** The browser's own model through the Prompt API (`LanguageModel`), e.g. Gemini Nano in Chrome */
  BUILT_IN = "built-in",
  /** Gemma through LiteRT-LM on WebGPU, downloaded by the extension on opt-in */
  LITE_RT = "litert",
  NONE = "none"
}

export enum AiUnavailableReason {
  /** No built-in model, and no usable WebGPU adapter to run the local one */
  NO_WEB_GPU = "no-webgpu",
  /** WebGPU is there, but this browser's WebAssembly lacks what the local runtime needs (JSPI, relaxed SIMD) */
  OUTDATED_BROWSER = "outdated-browser"
}

/** How much of a model download is done, from 0 to 1 */
export const downloadFractionSchema = z.number().min(0).max(1);

/** A model download in progress; `fraction` is null when the browser downloads it without reporting progress */
const aiDownloadSchema = z.object({
  fraction: downloadFractionSchema.nullable()
});
export type AiDownload = z.infer<typeof aiDownloadSchema>;

const readinessShape = {
  /** The model is on disk, so classification can run without any download */
  isModelReady: z.boolean(),
  download: aiDownloadSchema.nullable()
};

const builtInStatusSchema = z.object({
  engine: z.literal(AiEngine.BUILT_IN),
  ...readinessShape
});

const liteRtStatusSchema = z.object({
  engine: z.literal(AiEngine.LITE_RT),
  ...readinessShape
});

const unavailableStatusSchema = z.object({
  engine: z.literal(AiEngine.NONE),
  reason: z.enum(AiUnavailableReason)
});

const aiEngineChoiceSchema = z.discriminatedUnion("engine", [
  builtInStatusSchema.pick({ engine: true }),
  liteRtStatusSchema.pick({ engine: true }),
  unavailableStatusSchema
]);
export type AiEngineChoice = z.infer<typeof aiEngineChoiceSchema>;

/** What the background reports to the popup and the editor: the engine this browser uses, and whether it's ready */
export const aiStatusSchema = z.discriminatedUnion("engine", [
  builtInStatusSchema,
  liteRtStatusSchema,
  unavailableStatusSchema
]);
export type AiStatus = z.infer<typeof aiStatusSchema>;

/** Whether this browser has an engine to judge AI filters with, its model on disk or not */
export function isAiEngineAvailable(status: AiStatus | null): status is Exclude<AiStatus, { engine: AiEngine.NONE }> {
  return status !== null && status.engine !== AiEngine.NONE;
}

/** Whether AI filters can be judged right now, with nothing left to download */
export function isAiModelReady(status: AiStatus | null) {
  return isAiEngineAvailable(status) && status.isModelReady;
}

/** Broadcast by the page downloading the local model: its progress, then null once the download ended */
export const modelDownloadChangeSchema = aiDownloadSchema;
