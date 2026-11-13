import { untrack } from "svelte";

import { type AiStatus, isAiEngineAvailable } from "@/lib/ai/ai-status";
import { getAiFilterKey } from "@/lib/filter/ai-filter-key";
import { type AiFilter, type AiJudgeContext, isVideoFilterValid } from "@/lib/filter/title-filter";
import { MessageType, sendMessage } from "@/lib/messaging/extension-messaging";
import type { FeedVideo } from "@/lib/schemas/feed-video";
import { aiVerdictsItem, isAiEnabledItem } from "@/lib/storage";

/** Typing pauses this long before the preview's videos are sent off to be judged */
const CLASSIFY_DEBOUNCE_MS = 800;

function isWaitingForModel(aiStatus: AiStatus | null) {
  return isAiEngineAvailable(aiStatus) && !aiStatus.isModelReady;
}

/**
 * The editor's view of AI match, the same in the popup and the in-page dialog: the opt-in and the verdict cache,
 * watched from storage; the engine status, asked only while an AI filter is shown; and a request to judge the
 * preview's videos once typing stops. The verdicts land in the shared cache, keyed by filter and video, so a channel
 * previewed before it is saved needs no judging again once it is
 */
export function watchAiMatchPreview(
  readPreview: () => {
    filter: AiFilter | null;
    videos: FeedVideo[];
  }
) {
  const aiState = $state<AiJudgeContext & { aiStatus: AiStatus | null }>({
    aiVerdicts: {},
    isAiEnabled: false,
    aiStatus: null
  });

  function refreshStatus() {
    sendMessage(MessageType.getAiStatus)
      .then(aiStatus => {
        aiState.aiStatus = aiStatus;
      })
      .catch(() => {});
  }

  $effect(() => {
    isAiEnabledItem
      .getValue()
      .then(isAiEnabled => {
        aiState.isAiEnabled = isAiEnabled;
      })
      .catch(() => {});
    aiVerdictsItem
      .getValue()
      .then(aiVerdicts => {
        aiState.aiVerdicts = aiVerdicts;
      })
      .catch(() => {});
    const unwatchers = [
      isAiEnabledItem.watch(isAiEnabled => {
        aiState.isAiEnabled = isAiEnabled;
      }),
      aiVerdictsItem.watch(aiVerdicts => {
        aiState.aiVerdicts = aiVerdicts;
      })
    ];
    return () => {
      for (const unwatch of unwatchers) {
        unwatch();
      }
    };
  });

  // A boolean, so typing in the description doesn't ask again on every key
  const isAiFilterShown = $derived(readPreview().filter !== null);

  // Asked again whenever the opt-in flips, since turning it on is what downloads the model
  $effect(() => {
    void aiState.isAiEnabled;

    if (isAiFilterShown) {
      refreshStatus();
    }
  });

  // The first verdicts after a download are the sign the model is ready now
  $effect(() => {
    void aiState.aiVerdicts;

    if (untrack(() => isWaitingForModel(aiState.aiStatus))) {
      refreshStatus();
    }
  });

  $effect(() => {
    const { filter, videos } = readPreview();
    const isRequestable = filter !== null && isVideoFilterValid(filter) && aiState.isAiEnabled && videos.length > 0;
    if (!isRequestable) {
      return;
    }

    const request = $state.snapshot({
      filter,
      videos
    });
    const timer = setTimeout(() => {
      // Read when the timer fires rather than tracked: verdicts streaming in must not re-arm the request
      const verdicts = untrack(() => aiState.aiVerdicts)[getAiFilterKey(request.filter)] ?? {};
      const pendingVideos = request.videos.filter(video => verdicts[video.videoId] === undefined);
      if (pendingVideos.length > 0) {
        sendMessage(MessageType.classifyVideos, {
          filter: request.filter,
          videos: pendingVideos
        }).catch(() => {});
      }
    }, CLASSIFY_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  });

  return aiState;
}
