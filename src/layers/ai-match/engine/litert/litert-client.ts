import { deleteLiteRtModel, downloadLiteRtModel, getLiteRtDownloadFraction, inferWithLiteRt } from "./litert-host";
import { deleteLiteRtModelCache } from "./litert-model";
import { closeOffscreenDocument, hasOffscreenDocument, sendToOffscreenDocument } from "./offscreen-document";
import type { ChatMessage } from "@/lib/ai/chat-message";
import { MessageType, sendMessage } from "@/lib/messaging/extension-messaging";

// The background's handle on LiteRT-LM. Firefox's background is an event page with a DOM and WebGPU, so it hosts the
// model itself; Chromium's service worker hands everything to the offscreen page. The browser check is a build-time
// constant, so each build carries only its own path. It compares BROWSER rather than reading FIREFOX, which is the
// string "false" under vitest

const FIREFOX_BROWSER = "firefox";
const IS_FIREFOX = import.meta.env.BROWSER === FIREFOX_BROWSER;

/** Resolves once the download ended, to whether the model is on disk */
export async function downloadLocalModel() {
  if (IS_FIREFOX) {
    return await downloadLiteRtModel();
  }

  return await sendToOffscreenDocument(() => sendMessage(MessageType.offscreenAiDownload)).catch(() => false);
}

/** 0..1 while a download runs, null otherwise. Never creates the offscreen page just to ask */
export async function readLocalModelDownloadFraction() {
  if (IS_FIREFOX) {
    return getLiteRtDownloadFraction();
  }

  if (!await hasOffscreenDocument()) {
    return null;
  }

  return await sendToOffscreenDocument(() => sendMessage(MessageType.offscreenAiDownloadFraction)).catch(() => null);
}

export async function inferLocally(messages: ChatMessage[]) {
  if (IS_FIREFOX) {
    return await inferWithLiteRt(messages);
  }

  return await sendToOffscreenDocument(() => sendMessage(MessageType.offscreenAiInfer, { messages })).catch(() => null);
}

/** Opt-out: stops a running download, frees the engine and deletes the model */
export async function deleteLocalModel() {
  if (IS_FIREFOX) {
    await deleteLiteRtModel();
    return;
  }

  await closeOffscreenDocument();
  await deleteLiteRtModelCache();
}
