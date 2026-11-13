import { Engine, getOrLoadGlobalLiteRtLm, unloadLiteRtLm } from "@litert-lm/core";

import type { ChatMessage } from "@/lib/ai/chat-message";
import { MessageType, sendMessage } from "@/lib/messaging/extension-messaging";
import { z } from "@/lib/zod";

import {
  deleteLiteRtModelCache,
  isLiteRtModelCached,
  LITERT_MODEL_URL,
  openLiteRtModelCache,
  readLiteRtModelBlob
} from "./litert-model";

// Runs LiteRT-LM where there is a DOM and WebGPU: Firefox's background event page, or Chromium's offscreen page (its
// service worker has no document for the runtime's <script> loader)

/**
 * The one wasm build the extension ships (copied by wxt.config.ts): JSPI + relaxed SIMD. Loading the file directly
 * skips the runtime's own feature detection, which would otherwise ask for builds that aren't there; the engine
 * resolution only picks LiteRT when both features exist
 */
const LITERT_WASM_LOADER_PATH = "/litertlm-wasm/litertlm_wasm_internal.js";
/** The context window: the worked example plus a batch with descriptions, with room for the reply */
const MAX_CONTEXT_TOKENS = 4096;
/** The engine holds the model in GPU memory - give it back once the previews and passes go quiet */
const ENGINE_IDLE_RELEASE_MS = 60_000;
const PERCENT = 100;

const replyContentSchema = z.union([
  z.string(),
  z.array(
    z.looseObject({
      type: z.string(),
      text: z.string().optional()
    })
  )
]);

const replyMessageSchema = z.looseObject({
  content: replyContentSchema.optional()
});

let enginePromise: Promise<Engine> | null = null;
let idleReleaseTimer: ReturnType<typeof setTimeout> | undefined;
let pendingInference: Promise<unknown> = Promise.resolve();
/** An engine that failed to load (an unsuitable GPU) isn't retried until the model is downloaded again */
let isEngineBroken = false;
let activeDownload: {
  controller: AbortController;
  fraction: number;
  result: Promise<boolean>;
} | null = null;

/** 0..1 while a download runs here, null otherwise */
export function getLiteRtDownloadFraction() {
  return activeDownload?.fraction ?? null;
}

async function streamModelIntoCache({
  signal,
  onProgress
}: {
  signal: AbortSignal;
  onProgress: (fraction: number) => void;
}) {
  const response = await fetch(LITERT_MODEL_URL, { signal });
  if (!response.ok || !response.body) {
    return false;
  }

  const totalBytes = Number(response.headers.get("content-length")) || 0;
  let receivedBytes = 0;
  let reportedPercent = -1;
  const countingStream = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      receivedBytes += chunk.byteLength;
      const percent = totalBytes > 0 ? Math.floor((receivedBytes / totalBytes) * PERCENT) : 0;
      if (percent !== reportedPercent) {
        reportedPercent = percent;
        onProgress(Math.min(percent / PERCENT, 1));
      }

      controller.enqueue(chunk);
    }
  });
  // Piped straight into the cache, so the ~1.9 GB never sits in memory. An abort rejects the put: nothing partial
  // is ever committed
  const cache = await openLiteRtModelCache();
  await cache.put(
    LITERT_MODEL_URL,
    new Response(response.body.pipeThrough(countingStream), {
      headers: response.headers
    })
  );
  return true;
}

/** Tells every extension page (the popup, Chromium's service worker) how far the download got, null once it ended */
function announceDownloadChange(fraction: number | null) {
  sendMessage(MessageType.AI_MODEL_DOWNLOAD_CHANGED, { fraction }).catch(() => {});
}

async function runDownload(controller: AbortController) {
  try {
    return await streamModelIntoCache({
      signal: controller.signal,
      onProgress(fraction) {
        if (activeDownload) {
          activeDownload.fraction = fraction;
        }

        announceDownloadChange(fraction);
      }
    });
  } catch {
    // Cancelled or failed: drop whatever may have landed so "downloaded" never means half a model
    await deleteLiteRtModelCache();
    return false;
  }
}

/**
 * Downloads the model into the cache, announcing its progress (at most once per percent) and its end. A second call
 * while one runs joins it. Resolves to whether the model is on disk, including when it already was
 */
export async function downloadLiteRtModel() {
  if (activeDownload) {
    return await activeDownload.result;
  }

  if (await isLiteRtModelCached()) {
    return true;
  }

  isEngineBroken = false;
  const controller = new AbortController();
  const result = runDownload(controller).finally(() => {
    activeDownload = null;
    announceDownloadChange(null);
  });
  activeDownload = {
    controller,
    fraction: 0,
    result
  };
  return await result;
}

function cancelLiteRtDownload() {
  activeDownload?.controller.abort();
}

async function createEngine(model: Blob) {
  await getOrLoadGlobalLiteRtLm(new URL(LITERT_WASM_LOADER_PATH, globalThis.location.origin).href);
  return await Engine.create({
    model,
    mainExecutorSettings: {
      maxNumTokens: MAX_CONTEXT_TOKENS
    }
  });
}

async function releaseEngine() {
  clearTimeout(idleReleaseTimer);
  const pending = enginePromise;
  enginePromise = null;

  if (!pending) {
    return;
  }

  const engine = await pending.catch(() => null);
  await engine?.delete().catch(() => {});
  // The wasm module too, so a re-downloaded model starts clean
  try {
    unloadLiteRtLm();
  } catch {
    // Still loading - it's dropped with the page
  }
}

async function ensureEngine() {
  if (enginePromise) {
    return await enginePromise;
  }

  const model = await readLiteRtModelBlob();
  if (!model) {
    return null;
  }

  enginePromise = createEngine(model);
  try {
    return await enginePromise;
  } catch (error) {
    isEngineBroken = true;
    throw error;
  }
}

function scheduleIdleRelease() {
  clearTimeout(idleReleaseTimer);
  // The timer lives as long as this page; a page that goes away frees the engine with it anyway
  idleReleaseTimer = setTimeout(() => {
    releaseEngine().catch(() => {});
  }, ENGINE_IDLE_RELEASE_MS);
}

function readReplyText(reply: unknown) {
  const parsed = replyMessageSchema.safeParse(reply);
  const content = parsed.success ? parsed.data.content : undefined;
  if (typeof content === "string") {
    return content || null;
  }

  let text = "";
  for (const part of content ?? []) {
    if (part.text !== undefined) {
      text += part.text;
    }
  }
  return text || null;
}

async function runConversation(messages: ChatMessage[]) {
  const lastMessage = messages.at(-1);
  if (!lastMessage || isEngineBroken) {
    return null;
  }

  const engine = await ensureEngine();
  if (!engine) {
    return null;
  }

  // A fresh conversation per batch: the worked example is its preface, so nothing carries over between batches
  const conversation = await engine.createConversation({
    preface: {
      messages: messages.slice(0, -1)
    }
  });
  try {
    return readReplyText(await conversation.sendMessage(lastMessage.content));
  } finally {
    await conversation.delete().catch(() => {});
  }
}

/**
 * One chat turn through the local model: the messages before the last are the preface, the last is the ask. LiteRT
 * runs one inference at a time, so calls queue behind each other. Null when the model is missing or the run fails
 */
export function inferWithLiteRt(messages: ChatMessage[]) {
  const inference = pendingInference
    .catch(() => {})
    .then(async () => {
      clearTimeout(idleReleaseTimer);
      try {
        return await runConversation(messages);
      } catch {
        await releaseEngine();
        return null;
      } finally {
        scheduleIdleRelease();
      }
    });
  pendingInference = inference;
  return inference;
}

/** Opt-out: stop any download, free the engine and drop the model from disk */
export async function deleteLiteRtModel() {
  cancelLiteRtDownload();
  await activeDownload?.result.catch(() => false);
  await releaseEngine();
  await deleteLiteRtModelCache();
  isEngineBroken = false;
}
