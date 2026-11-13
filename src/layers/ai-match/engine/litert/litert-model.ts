// Gemma 4 E2B, the smaller web build for LiteRT-LM (WebGPU/wasm). Downloaded once on opt-in, deleted on opt-out
const LITERT_MODEL_FILE = "gemma-4-E2B-it-web.litertlm";
export const LITERT_MODEL_URL = `https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/${LITERT_MODEL_FILE}`;
/** For the opt-in explanation */
export const LITERT_MODEL_SIZE_LABEL = "1.9 GB";

// Our own Cache bucket rather than the runtime's opaque cache: a delete is one caches.delete, and a cancelled download
// never leaves a partial entry behind. Named by the model file, so swapping models starts a new bucket
const LITERT_MODEL_CACHE = `yss-litert-model:${LITERT_MODEL_FILE}`;

/** CacheStorage is per extension origin, so the service worker sees the same bucket the offscreen page fills */
export function openLiteRtModelCache() {
  return caches.open(LITERT_MODEL_CACHE);
}

/** No CacheStorage (Firefox without history, or tests): nothing is cached and nothing can be */
function isCacheStorageAvailable() {
  return typeof caches !== "undefined";
}

async function matchCachedModel() {
  const hasBucket = await caches.has(LITERT_MODEL_CACHE);
  if (!hasBucket) {
    return null;
  }

  const cache = await openLiteRtModelCache();
  return (await cache.match(LITERT_MODEL_URL)) ?? null;
}

/** The cache is the source of truth for "downloaded" - no separate flag that could drift from the bytes on disk */
export async function isLiteRtModelCached() {
  if (!isCacheStorageAvailable()) {
    return false;
  }

  return await matchCachedModel().then(Boolean, () => false);
}

export async function readLiteRtModelBlob() {
  const response = isCacheStorageAvailable() ? await matchCachedModel() : null;
  return response ? await response.blob() : null;
}

export async function deleteLiteRtModelCache() {
  if (isCacheStorageAvailable()) {
    await caches.delete(LITERT_MODEL_CACHE).catch(() => false);
  }
}
