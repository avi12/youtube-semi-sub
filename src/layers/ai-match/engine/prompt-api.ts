import { downloadFractionSchema } from "@/lib/ai/ai-status";
import type { ChatMessage } from "@/lib/ai/chat-message";
import { z } from "@/lib/zod";

export enum BuiltInAvailability {
  unavailable = "unavailable",
  downloadable = "downloadable",
  downloading = "downloading",
  available = "available"
}

const SESSION_TIMEOUT_MS = 30_000;

const builtInAvailabilitySchema = z.enum(BuiltInAvailability);

const languageModelOptionsSchema = z.object({
  expectedOutputs: z.array(
    z.object({
      type: z.literal("text"),
      languages: z.array(z.string())
    })
  )
});
type LanguageModelOptions = z.infer<typeof languageModelOptionsSchema>;

/** `downloadprogress` reports `loaded` as a fraction */
const downloadProgressEventSchema = z.looseObject({
  loaded: downloadFractionSchema
});

// The reply is JSON with English keys, so English is the one output language declared. Input languages are left
// out on purpose: titles and descriptions come in any language
const LANGUAGE_MODEL_OPTIONS: LanguageModelOptions = {
  expectedOutputs: [{
    type: "text",
    languages: ["en"]
  }]
};

interface LanguageModelDownloadMonitor {
  addEventListener(type: "downloadprogress", listener: (e: Event) => void): void;
}

/** A Prompt API session; a fake with the same three members stands in for it in tests */
export interface PromptSession {
  prompt(input: string, options?: {
    responseConstraint?: unknown;
    signal?: AbortSignal;
  }): Promise<string>;
  /** Missing in some implementations - then each batch opens its own session */
  clone?(options?: { signal?: AbortSignal }): Promise<PromptSession>;
  destroy(): void;
}

interface LanguageModelFactory {
  availability(options?: LanguageModelOptions): Promise<unknown>;
  create(options?: LanguageModelOptions & {
    initialPrompts?: ChatMessage[];
    monitor?: (monitor: LanguageModelDownloadMonitor) => void;
    signal?: AbortSignal;
  }): Promise<PromptSession>;
}

declare global {
  // The Prompt API. Missing in Firefox and most Chromium browsers, and Edge may expose it to pages but not to the
  // service worker - so every caller checks for it in its own context
  var LanguageModel: LanguageModelFactory | undefined;
}

function getLanguageModel() {
  return typeof LanguageModel === "undefined" ? null : LanguageModel ?? null;
}

/** null when this context has no Prompt API at all; otherwise what it can do for our options */
export async function readBuiltInAvailability() {
  const languageModel = getLanguageModel();
  if (!languageModel) {
    return null;
  }

  const availability = await languageModel.availability(LANGUAGE_MODEL_OPTIONS).catch(() => null);
  const parsed = builtInAvailabilitySchema.safeParse(availability);
  return parsed.success ? parsed.data : BuiltInAvailability.unavailable;
}

/**
 * A session primed with `initialPrompts`. Only ever opened on a model that is already on disk: create() starts a
 * download otherwise, which must come from a click, never from the background
 */
export async function openBuiltInSession(initialPrompts: ChatMessage[]) {
  const languageModel = getLanguageModel();
  const availability = await readBuiltInAvailability();
  const isReady = languageModel && availability === BuiltInAvailability.available;
  if (!isReady) {
    return null;
  }

  return await languageModel.create({
    ...LANGUAGE_MODEL_OPTIONS,
    initialPrompts,
    signal: AbortSignal.timeout(SESSION_TIMEOUT_MS)
  }).catch(() => null);
}

/**
 * Downloads the built-in model, reporting 0..1 progress. Call it synchronously from a click: the browser only lets
 * create() download with a user gesture, and the gesture expires. Resolves to whether the model ended up on disk
 */
export async function downloadBuiltInModel({ onProgress, signal }: {
  onProgress: (fraction: number) => void;
  signal: AbortSignal;
}) {
  const languageModel = getLanguageModel();
  if (!languageModel) {
    return false;
  }

  try {
    const session = await languageModel.create({
      ...LANGUAGE_MODEL_OPTIONS,
      signal,
      monitor: downloadMonitor => downloadMonitor.addEventListener("downloadprogress", e => {
        const parsed = downloadProgressEventSchema.safeParse(e);
        if (parsed.success) {
          onProgress(parsed.data.loaded);
        }
      })
    });
    session.destroy();
    return true;
  } catch {
    return false;
  }
}
