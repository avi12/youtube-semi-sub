import { browser } from "#imports";

// Chromium only: the MV3 service worker has no DOM for LiteRT-LM's loader, and a 1.9 GB download would outlive its
// short lifetime, so both run in one offscreen page the worker talks to

const OFFSCREEN_DOCUMENT_PATH = "/offscreen-ai.html";
const OFFSCREEN_JUSTIFICATION = "Downloads and runs the on-device AI model (LiteRT-LM on WebGPU) the user opted in to";
const SEND_ATTEMPTS = 3;
const SEND_RETRY_DELAY_MS = 250;

let pendingCreation: Promise<void> | null = null;

export async function hasOffscreenDocument() {
  const contexts = await browser.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
  return contexts.length > 0;
}

async function createOffscreenDocument() {
  if (await hasOffscreenDocument()) {
    return;
  }

  await browser.offscreen
    .createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ["BLOBS"],
      justification: OFFSCREEN_JUSTIFICATION
    })
    .catch(() => {
      // Created by a concurrent caller - the one document is there either way
    });
}

function ensureOffscreenDocument() {
  pendingCreation ??= createOffscreenDocument().finally(() => {
    pendingCreation = null;
  });
  return pendingCreation;
}

/** Closing the page aborts its download and frees the engine with it */
export async function closeOffscreenDocument() {
  if (await hasOffscreenDocument()) {
    await browser.offscreen.closeDocument().catch(() => {});
  }
}

function delay(milliseconds: number) {
  return new Promise(resolve => {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * Sends to the offscreen page, creating it first. Its listeners register as it loads, which can lag the creation,
 * so a few early misses are retried before the error is passed on
 */
export async function sendToOffscreenDocument<Result>(send: () => Promise<Result>) {
  await ensureOffscreenDocument();
  for (let attempt = 1; attempt < SEND_ATTEMPTS; attempt++) {
    const outcome = await send().then(
      value => ({ value }),
      () => null
    );
    if (outcome) {
      return outcome.value;
    }

    await delay(SEND_RETRY_DELAY_MS);
  }
  return await send();
}
