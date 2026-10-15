import { MessageType, onMessage } from "@/lib/messaging/extension-messaging";
import { channelVideosItem, isAiEnabledItem, semiSubscriptionsItem } from "@/lib/storage";
import { classifyPendingVideos, classifyRequestSchema } from "#ai-match/background/classification";
import { readAiStatus } from "#ai-match/background/read-ai-status";

const INVALID_CLASSIFY_REQUEST_ERROR = "Invalid classification request";

/** Fire and forget: a pass reports its own errors and the triggers don't wait on it */
function scheduleClassification() {
  void classifyPendingVideos();
}

/**
 * Background: answers the popup's and the editor's AI questions and keeps verdicts current. Every trigger runs a pass
 * that does nothing unless AI match is on and its model is on disk; the background never starts a model download
 */
export function startAiMatch() {
  onMessage(MessageType.getAiStatus, () => readAiStatus());

  onMessage(MessageType.classifyVideos, ({ data }) => {
    const parsed = classifyRequestSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(INVALID_CLASSIFY_REQUEST_ERROR);
    }

    // Answered at once: the preview watches the verdict cache rather than waiting on this message
    void classifyPendingVideos(parsed.data);
  });

  isAiEnabledItem.watch(isAiEnabled => {
    if (isAiEnabled) {
      scheduleClassification();
    }
  });
  // New uploads were cached, or a filter was added or edited
  channelVideosItem.watch(scheduleClassification);
  semiSubscriptionsItem.watch(scheduleClassification);

  // Picks up whatever an earlier pass left pending (the worker was stopped, the model wasn't ready yet)
  scheduleClassification();
}
