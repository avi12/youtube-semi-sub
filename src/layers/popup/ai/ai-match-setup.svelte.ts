import { type AiDownload, AiEngine, type AiStatus, isAiEngineAvailable } from "@/lib/ai/ai-status";
import { MessageType, onMessage, sendMessage } from "@/lib/messaging/extension-messaging";
import { isAiEnabledItem } from "@/lib/storage";
import { downloadBuiltInModel } from "#ai-match";

// The popup's one AI match opt-in flow, shared by the settings card and the filter editor's "turn it on" prompt, so
// both show the same download and never start a second one

export const aiMatchSetup = $state<{
  status: AiStatus | null;
  download: AiDownload | null;
  isFailed: boolean;
}>({
  status: null,
  download: null,
  isFailed: false
});

let builtInDownload: AbortController | null = null;

export async function refreshAiStatus() {
  const status = await sendMessage(MessageType.getAiStatus).catch(() => null);
  aiMatchSetup.status = status;
  // A download that outlived an earlier popup (or runs in the browser) shows up here when this one opens
  const isDownloadedByThisPopup = builtInDownload !== null;
  if (isAiEngineAvailable(status) && !isDownloadedByThisPopup) {
    aiMatchSetup.download = status.download;
  }
}

/** The local model's progress, broadcast by the page downloading it; null means it ended */
export function followModelDownload() {
  return onMessage(MessageType.aiModelDownloadChanged, ({ fraction }) => {
    if (fraction !== null) {
      aiMatchSetup.download = { fraction };
      return;
    }

    aiMatchSetup.download = null;
    void refreshAiStatus();
  });
}

function downloadBuiltIn() {
  builtInDownload = new AbortController();
  aiMatchSetup.download = { fraction: 0 };
  return downloadBuiltInModel({
    signal: builtInDownload.signal,
    onProgress(fraction) {
      aiMatchSetup.download = { fraction };
    }
  }).finally(() => {
    builtInDownload = null;
  });
}

async function downloadLocal() {
  aiMatchSetup.download = { fraction: 0 };
  // The background only downloads for a user who has switched AI match on - so the switch is stored first
  await isAiEnabledItem.setValue(true);
  return await sendMessage(MessageType.downloadAiModel).catch(() => false);
}

/**
 * Turns AI match on, downloading the model when it isn't on disk. Call it synchronously from the click: the built-in
 * model's create() needs that gesture, so it starts before anything is awaited. A download that fails turns the
 * switch back off
 */
export async function turnOnAiMatch() {
  const { status } = aiMatchSetup;
  const isTurnable = isAiEngineAvailable(status) && !aiMatchSetup.download;
  if (!isTurnable) {
    return;
  }

  aiMatchSetup.isFailed = false;

  if (status.isModelReady) {
    await isAiEnabledItem.setValue(true);
    return;
  }

  let isDownloaded: boolean;
  if (status.engine === AiEngine.builtIn) {
    const download = downloadBuiltIn();
    await isAiEnabledItem.setValue(true);
    isDownloaded = await download;
  } else {
    isDownloaded = await downloadLocal();
  }

  aiMatchSetup.download = null;
  const isStillWanted = await isAiEnabledItem.getValue();
  if (!isDownloaded && isStillWanted) {
    aiMatchSetup.isFailed = true;
    await isAiEnabledItem.setValue(false);
  }

  await refreshAiStatus();
}

/** Off, and cancel: AI filters pause, and the background stops and deletes the local model */
export async function turnOffAiMatch() {
  builtInDownload?.abort();
  aiMatchSetup.download = null;
  aiMatchSetup.isFailed = false;
  await isAiEnabledItem.setValue(false);
  await refreshAiStatus();
}
