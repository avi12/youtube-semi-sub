import { AiEngine, isAiModelReady } from "@/lib/ai/ai-status";
import { getAiFilterKey, normalizeAiDescription } from "@/lib/filter/ai-filter-key";
import type { VideoVerdicts } from "@/lib/filter/ai-verdicts";
import { FilterKind } from "@/lib/filter/title-filter";
import type { ClassifyRequest } from "@/lib/messaging/extension-messaging";
import { sortNewestFirst } from "@/lib/schemas/feed-video";
import { getActiveFilter } from "@/lib/schemas/semi-subscription";
import type { StoredState } from "@/lib/schemas/stored-state";
import {
  aiVerdictsItem,
  channelVideosItem,
  isAiEnabledItem,
  mutateStorageItem,
  semiSubscriptionsItem
} from "@/lib/storage";
import { z } from "@/lib/zod";
import { readAiStatus } from "#ai-match/background/read-ai-status";
import { type BatchJudge, classifyVideos, videoBatchSchema } from "#ai-match/classify/classifier";
import { createBuiltInJudge } from "#ai-match/classify/judges/built-in-judge";
import { createLiteRtJudge } from "#ai-match/classify/judges/litert-judge";
import { buildPrefaceMessages } from "#ai-match/classify/prompt";
import { inferLocally } from "#ai-match/engine/litert/litert-client";
import { openBuiltInSession } from "#ai-match/engine/prompt-api";

/** Editor requests kept while the model isn't ready yet - older ones are previews the user has moved on from */
const MAX_QUEUED_REQUESTS = 8;

/** Every video one filter still has to judge, under the key its verdicts are stored by */
const classificationJobSchema = videoBatchSchema.extend({
  key: z.string()
});
type ClassificationJob = z.infer<typeof classificationJobSchema>;

/**
 * What a pass has to judge, grouped by filter key: the editor's requests first (someone is watching the preview), then
 * the cached uploads of each channel whose current mode applies an AI filter, newest first. Videos that already have a
 * verdict are left out, and a video is judged once per key even when several requests and channels share it
 */
export function collectClassificationJobs({ requests, subscriptions, channelVideos, aiVerdicts }: {
  requests: ClassifyRequest[];
} & Pick<StoredState, "subscriptions" | "channelVideos" | "aiVerdicts">) {
  const jobsByKey = new Map<string, ClassificationJob>();
  const queuedVideoIdsByKey = new Map<string, Set<string>>();

  function addVideos({ filter, videos }: ClassifyRequest) {
    const key = getAiFilterKey(filter);
    const judged = aiVerdicts[key] ?? {};
    const job = jobsByKey.get(key) ?? {
      key,
      description: normalizeAiDescription(filter.description),
      videos: []
    };
    const queuedVideoIds = queuedVideoIdsByKey.get(key) ?? new Set();
    for (const video of videos) {
      const isKnown = judged[video.videoId] !== undefined || queuedVideoIds.has(video.videoId);
      if (!isKnown) {
        queuedVideoIds.add(video.videoId);
        job.videos.push(video);
      }
    }
    jobsByKey.set(key, job);
    queuedVideoIdsByKey.set(key, queuedVideoIds);
  }

  for (const request of requests) {
    addVideos(request);
  }

  for (const channelId in subscriptions) {
    const subscription = subscriptions[channelId];
    const filter = subscription && getActiveFilter(subscription);
    if (filter?.kind === FilterKind.aiMatch) {
      addVideos({
        filter,
        videos: sortNewestFirst(channelVideos[channelId]?.videos ?? [])
      });
    }
  }

  return [...jobsByKey.values()].filter(job => job.videos.length > 0);
}

/** A judge for the engine this browser resolves to - only when its model is already on disk, so nothing downloads */
async function openReadyJudge() {
  const status = await readAiStatus();
  if (!isAiModelReady(status)) {
    return null;
  }

  if (status.engine === AiEngine.builtIn) {
    return createBuiltInJudge(() => openBuiltInSession(buildPrefaceMessages()));
  }

  return createLiteRtJudge(inferLocally);
}

function storeVerdicts({ key, verdicts }: {
  key: string;
  verdicts: VideoVerdicts;
}) {
  return mutateStorageItem({
    item: aiVerdictsItem,
    mutator: aiVerdicts => ({
      ...aiVerdicts,
      [key]: {
        ...aiVerdicts[key],
        ...verdicts
      }
    })
  });
}

async function runJobs({ jobs, judge }: {
  jobs: ClassificationJob[];
  judge: BatchJudge;
}) {
  for (const { key, description, videos } of jobs) {
    await classifyVideos({
      description,
      videos,
      judge,
      onVerdicts: verdicts => storeVerdicts({
        key,
        verdicts
      }),
      // Turning AI match off stops the pass at the next batch
      shouldContinue: () => isAiEnabledItem.getValue()
    });
  }
}

const queuedRequests: ClassifyRequest[] = [];

async function runPass() {
  if (!await isAiEnabledItem.getValue()) {
    queuedRequests.length = 0;
    return;
  }

  const requests = [...queuedRequests];

  const [subscriptions, channelVideos, aiVerdicts] = await Promise.all([
    semiSubscriptionsItem.getValue(),
    channelVideosItem.getValue(),
    aiVerdictsItem.getValue()
  ]);
  const jobs = collectClassificationJobs({
    requests,
    subscriptions,
    channelVideos,
    aiVerdicts
  });
  if (jobs.length === 0) {
    queuedRequests.splice(0, requests.length);
    return;
  }

  // Without a ready model the editor's requests wait, so a preview typed during the download is judged after it
  const judge = await openReadyJudge();
  if (!judge) {
    return;
  }

  queuedRequests.splice(0, requests.length);

  try {
    await runJobs({
      jobs,
      judge
    });
  } finally {
    await judge.close();
  }
}

let currentRun: Promise<void> | null = null;
let isRerunNeeded = false;

async function runUntilSettled() {
  do {
    isRerunNeeded = false;
    await runPass().catch(console.error);
  } while (isRerunNeeded);
}

/**
 * Judges whatever AI filters still have to judge, one pass at a time: a call while a pass runs queues one more pass
 * after it, so triggers in a burst (new uploads, a filter edit, a preview) coalesce. Does nothing while AI match is
 * off or the model isn't on disk. An editor `request` is judged first
 */
export function classifyPendingVideos(request?: ClassifyRequest) {
  if (request) {
    queuedRequests.push(request);
    queuedRequests.splice(0, queuedRequests.length - MAX_QUEUED_REQUESTS);
  }

  if (currentRun) {
    isRerunNeeded = true;
    return currentRun;
  }

  currentRun = runUntilSettled().finally(() => {
    currentRun = null;
  });
  return currentRun;
}
