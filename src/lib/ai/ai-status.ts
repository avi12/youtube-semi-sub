import { z } from "@/lib/zod";

/** Which model judges AI filters, resolved at runtime by one rule on every browser (see `resolveAiEngine`) */
export enum AiEngine {
  /** The browser's own model through the Prompt API (`LanguageModel`), e.g. Gemini Nano in Chrome */
  builtIn = "built-in",
  /** Gemma through LiteRT-LM on WebGPU, downloaded by the extension on opt-in */
  liteRt = "litert",
  none = "none"
}

export enum AiUnavailableReason {
  /** No built-in model, and no usable WebGPU adapter to run the local one */
  noWebGpu = "no-webgpu",
  /** WebGPU is there, but this browser's WebAssembly lacks what the local runtime needs (JSPI, relaxed SIMD) */
  outdatedBrowser = "outdated-browser"
}

/** A model download in progress; `fraction` is null when the browser downloads it without reporting progress */
const aiDownloadSchema = z.object({
  fraction: z.number().min(0).max(1).nullable()
});

const readinessShape = {
  /** The model is on disk, so classification can run without any download */
  isModelReady: z.boolean(),
  download: aiDownloadSchema.nullable()
};

const builtInStatusSchema = z.object({
  engine: z.literal(AiEngine.builtIn),
  ...readinessShape
});

const liteRtStatusSchema = z.object({
  engine: z.literal(AiEngine.liteRt),
  ...readinessShape
});

const unavailableStatusSchema = z.object({
  engine: z.literal(AiEngine.none),
  reason: z.enum(AiUnavailableReason)
});

const aiEngineChoiceSchema = z.discriminatedUnion("engine", [
  builtInStatusSchema.pick({ engine: true }),
  liteRtStatusSchema.pick({ engine: true }),
  unavailableStatusSchema
]);
export type AiEngineChoice = z.infer<typeof aiEngineChoiceSchema>;

/** What the background reports to the popup and the editor: the engine this browser uses, and whether it's ready */
const aiStatusSchema = z.discriminatedUnion("engine", [builtInStatusSchema, liteRtStatusSchema, unavailableStatusSchema]);
export type AiStatus = z.infer<typeof aiStatusSchema>;

/** Broadcast by the page downloading the local model: its 0..1 progress, then null once the download ended */
export const modelDownloadChangeSchema = z.object({
  fraction: z.number().min(0).max(1).nullable()
});
export type ModelDownloadChange = z.infer<typeof modelDownloadChangeSchema>;
