import { classifyPendingVideos } from "#ai-match/background/classification";
import { readAiStatus } from "#ai-match/background/read-ai-status";
import {
  deleteLocalModel,
  downloadLocalModel,
  readLocalModelDownloadFraction
} from "#ai-match/engine/litert/litert-client";
import { isLiteRtModelCached } from "#ai-match/engine/litert/litert-model";
import { browser } from "#imports";
import { AiEngine } from "@/lib/ai/ai-status";
import { MessageType, onMessage } from "@/lib/messaging/extension-messaging";
import { channelVideosItem, isAiEnabledItem, semiSubscriptionsItem } from "@/lib/storage";

/** Fire and forget: a pass reports its own errors and the triggers don't wait on it */
function scheduleClassification() {
  void classifyPendingVideos();
}

/**
 * A local-model download ended (either way). With the model on disk, the waiting AI filters get judged; without it
 * the opt-in didn't complete, so the switch goes back off rather than promising matches that never come
 */
async function handleLocalModelDownloadEnded() {
  if (await isLiteRtModelCached()) {
    scheduleClassification();
    return;
  }

  const isAnotherDownloadRunning = (await readLocalModelDownloadFraction()) !== null;
  const shouldDisableAi = !isAnotherDownloadRunning && (await isAiEnabledItem.getValue());
  if (shouldDisableAi) {
    await isAiEnabledItem.setValue(false);
  }
}

/** Only for a user who just switched AI match on, and only on a browser that resolves to the local model */
async function downloadRequestedModel() {
  const [status, isAiEnabled] = await Promise.all([readAiStatus(), isAiEnabledItem.getValue()]);
  const isLocalDownloadWanted = status.engine === AiEngine.LITE_RT && isAiEnabled;
  if (!isLocalDownloadWanted) {
    return false;
  }

  const isDownloaded = await downloadLocalModel();
  await handleLocalModelDownloadEnded();
  return isDownloaded;
}

/** Opt-out deletes the local model; also catches up on a deletion an earlier worker didn't get to finish */
async function deleteModelWhileOff() {
  const isModelLeftOver = !(await isAiEnabledItem.getValue()) && (await isLiteRtModelCached());
  if (isModelLeftOver) {
    await deleteLocalModel();
  }
}

async function openAiSettings() {
  await browser.action.openPopup().catch(() => browser.tabs.create({ url: browser.runtime.getURL("/popup.html") }));
}

/**
 * Background: answers the popup's and the editor's AI questions and keeps verdicts current. Every trigger runs a pass
 * that does nothing unless AI match is on and its model is on disk. The built-in model is never downloaded from here;
 * the local one only when the user asks for it right after opting in
 */
export function startAiMatch() {
  onMessage(MessageType.GET_AI_STATUS, () => readAiStatus());
  onMessage(MessageType.DOWNLOAD_AI_MODEL, () => downloadRequestedModel());
  onMessage(MessageType.OPEN_AI_SETTINGS, () => openAiSettings());

  onMessage(MessageType.CLASSIFY_VIDEOS, request => {
    // Answered at once: the preview watches the verdict cache rather than waiting on this message
    void classifyPendingVideos(request);
  });

  // Chromium's offscreen page announces the end of a download, which also wakes a worker that stopped meanwhile
  onMessage(MessageType.AI_MODEL_DOWNLOAD_CHANGED, async ({ fraction }) => {
    const isDownloadEnded = fraction === null;
    if (isDownloadEnded) {
      await handleLocalModelDownloadEnded();
    }
  });

  isAiEnabledItem.watch(isAiEnabled => {
    if (isAiEnabled) {
      scheduleClassification();
      return;
    }

    deleteLocalModel().catch(console.error);
  });
  // New uploads were cached, or a filter was added or edited
  channelVideosItem.watch(scheduleClassification);
  semiSubscriptionsItem.watch(scheduleClassification);

  // Picks up whatever an earlier pass left pending (the worker was stopped, the model wasn't ready yet)
  scheduleClassification();
  deleteModelWhileOff().catch(console.error);
}
