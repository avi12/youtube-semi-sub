import { type ChannelUploads, fetchChannelUploads, withVideosTabDetails } from "#background/uploads/channel-uploads";
import { countAiVerdicts, pruneAiVerdicts } from "@/lib/filter/ai-verdicts";
import type { ChannelVideosCache } from "@/lib/schemas/feed-video";
import { isUploadsWatched, isVideosTabRead, type SemiSubscriptions } from "@/lib/schemas/semi-subscription";
import {
  aiVerdictsItem,
  channelCheckedAtItem,
  channelVideosItem,
  mutateStorageItem,
  semiSubscriptionsItem,
  type StorageItem
} from "@/lib/storage";
import { MILLISECONDS_PER_MINUTE } from "@/lib/utils/time";

import { mapWithConcurrency } from "./concurrency";
import { isVideoListUnchanged, mergeChannelVideos } from "./merge-channel-videos";

const MIN_REFRESH_INTERVAL_MS = 5 * MILLISECONDS_PER_MINUTE;
const MAX_CONCURRENT_FETCHES = 4;
export const UPLOADS_UNAVAILABLE_ERROR = "Couldn't load uploads from YouTube";

function keepSubscribedChannels<Value>({
  record,
  subscriptions
}: {
  record: Record<string, Value>;
  subscriptions: SemiSubscriptions;
}) {
  const kept: Record<string, Value> = {};
  for (const channelId of Object.keys(record)) {
    const value = record[channelId];
    const isKept = value !== undefined && Object.hasOwn(subscriptions, channelId);
    if (isKept) {
      kept[channelId] = value;
    }
  }
  return kept;
}

function hasUnsubscribedChannels({
  record,
  subscriptions
}: {
  record: Record<string, unknown>;
  subscriptions: SemiSubscriptions;
}) {
  for (const channelId of Object.keys(record)) {
    if (!Object.hasOwn(subscriptions, channelId)) {
      return true;
    }
  }
  return false;
}

/** Unchanged entries keep their object identity, so a no-op is detectable by reference */
function applyUploads({
  cache,
  uploadsList,
  subscriptions,
  now
}: {
  cache: ChannelVideosCache;
  uploadsList: ChannelUploads[];
  subscriptions: SemiSubscriptions;
  now: number;
}) {
  const nextCache = keepSubscribedChannels({
    record: cache,
    subscriptions
  });
  for (const uploads of uploadsList) {
    const isSubscribed = Object.hasOwn(subscriptions, uploads.channelId);
    if (!isSubscribed) {
      continue;
    }

    const entry = nextCache[uploads.channelId];
    const previous = entry?.videos ?? [];
    const videos = mergeChannelVideos({
      previous,
      uploads
    });
    const isUnchanged =
      entry !== undefined &&
      isVideoListUnchanged({
        previous,
        next: videos
      });
    if (!isUnchanged) {
      nextCache[uploads.channelId] = {
        fetchedAt: now,
        videos
      };
    }
  }
  return nextCache;
}

function isSameCache({ previous, next }: { previous: ChannelVideosCache; next: ChannelVideosCache }) {
  const previousChannelIds = Object.keys(previous);
  return (
    previousChannelIds.length === Object.keys(next).length &&
    previousChannelIds.every(channelId => previous[channelId] === next[channelId])
  );
}

async function storeUploads({
  uploadsList,
  subscriptions
}: Pick<Parameters<typeof applyUploads>[0], "uploadsList" | "subscriptions">) {
  const now = Date.now();
  const cache = await channelVideosItem.getValue();
  const isUnchanged = isSameCache({
    previous: cache,
    next: applyUploads({
      cache,
      uploadsList,
      subscriptions,
      now
    })
  });
  if (isUnchanged) {
    return;
  }

  await mutateStorageItem({
    item: channelVideosItem,
    mutator: current =>
      applyUploads({
        cache: current,
        uploadsList,
        subscriptions,
        now
      })
  });
}

async function recordCheckedAt({
  channelIds,
  subscriptions
}: {
  channelIds: string[];
  subscriptions: SemiSubscriptions;
}) {
  const now = Date.now();
  await mutateStorageItem({
    item: channelCheckedAtItem,
    mutator(checkedAtByChannel) {
      const next = keepSubscribedChannels({
        record: checkedAtByChannel,
        subscriptions
      });
      for (const channelId of channelIds) {
        const isSubscribed = Object.hasOwn(subscriptions, channelId);
        if (isSubscribed) {
          next[channelId] = now;
        }
      }
      return next;
    }
  });
}

async function filterDueChannels(channelIds: string[]) {
  const checkedAtByChannel = await channelCheckedAtItem.getValue();
  const now = Date.now();
  return channelIds.filter(channelId => now - (checkedAtByChannel[channelId] ?? 0) >= MIN_REFRESH_INTERVAL_MS);
}

/** A channel's uploads, with the Videos tab's details when they matter (`isVideosTabRead`) or an editor asks */
async function fetchUploadsForCache({
  channelId,
  isTabDetailNeeded
}: {
  channelId: string;
  isTabDetailNeeded: boolean;
}) {
  const uploads = await fetchChannelUploads(channelId);
  const subscription = (await semiSubscriptionsItem.getValue())[channelId];
  const isTabRead = isTabDetailNeeded || (!!subscription && isVideosTabRead(subscription));
  if (!uploads || !isTabRead) {
    return uploads;
  }

  return await withVideosTabDetails({
    uploads,
    knownVideos: (await channelVideosItem.getValue())[channelId]?.videos ?? []
  });
}

/**
 * Fetches the given semi-subscribed channels and caches what changed; unless forced, recently fetched ones are skipped.
 * Resolves to false when not a single due channel could be fetched (offline, or YouTube is down)
 */
export async function refreshChannels({
  channelIds,
  isForced,
  isTabDetailNeeded = false
}: {
  channelIds: string[];
  isForced: boolean;
  isTabDetailNeeded?: boolean;
}) {
  const dueChannelIds = isForced ? channelIds : await filterDueChannels(channelIds);
  if (dueChannelIds.length === 0) {
    return true;
  }

  const results = await mapWithConcurrency({
    items: dueChannelIds,
    limit: MAX_CONCURRENT_FETCHES,
    task: channelId =>
      fetchUploadsForCache({
        channelId,
        isTabDetailNeeded
      })
  });
  const uploadsList = results.filter(uploads => uploads !== null);
  // Read after the fetches, so a channel removed meanwhile is not cached
  const subscriptions = await semiSubscriptionsItem.getValue();
  await storeUploads({
    uploadsList,
    subscriptions
  });
  await recordCheckedAt({
    channelIds: dueChannelIds,
    subscriptions
  });
  return uploadsList.length > 0;
}

export async function refreshAllChannels({ isForced }: Pick<Parameters<typeof refreshChannels>[0], "isForced">) {
  const subscriptions = await semiSubscriptionsItem.getValue();
  return await refreshChannels({
    channelIds: Object.values(subscriptions)
      .filter(isUploadsWatched)
      .map(subscription => subscription.channelId),
    isForced
  });
}

/**
 * A channel's uploads, unfiltered, with their lengths - an editor asks, and may add a length condition. Only a
 * semi-subscribed channel is cached - the dialog previews others first
 */
export async function refreshChannel(channelId: string) {
  const isSubscribed = Object.hasOwn(await semiSubscriptionsItem.getValue(), channelId);
  if (!isSubscribed) {
    const uploads = await fetchUploadsForCache({
      channelId,
      isTabDetailNeeded: true
    });
    if (!uploads) {
      throw new Error(UPLOADS_UNAVAILABLE_ERROR);
    }

    return uploads.videos;
  }

  // A failed refetch still serves what is cached
  await refreshChannels({
    channelIds: [channelId],
    isForced: true,
    isTabDetailNeeded: true
  });
  const cache = await channelVideosItem.getValue();
  const videos = cache[channelId]?.videos;
  if (!videos) {
    throw new Error(UPLOADS_UNAVAILABLE_ERROR);
  }

  return videos;
}

async function pruneItem<Value>({
  item,
  subscriptions
}: {
  item: StorageItem<Record<string, Value>>;
  subscriptions: SemiSubscriptions;
}) {
  const isPruneNeeded = hasUnsubscribedChannels({
    record: await item.getValue(),
    subscriptions
  });
  if (!isPruneNeeded) {
    return;
  }

  await mutateStorageItem({
    item,
    mutator: current =>
      keepSubscribedChannels({
        record: current,
        subscriptions
      })
  });
}

/** Runs after the channel caches are pruned, since a verdict is kept only for a video still cached */
async function pruneVerdicts(subscriptions: SemiSubscriptions) {
  const channelVideos = await channelVideosItem.getValue();
  const aiVerdicts = await aiVerdictsItem.getValue();
  const isPruneNeeded =
    countAiVerdicts(aiVerdicts) !==
    countAiVerdicts(
      pruneAiVerdicts({
        aiVerdicts,
        subscriptions,
        channelVideos
      })
    );
  if (!isPruneNeeded) {
    return;
  }

  await mutateStorageItem({
    item: aiVerdictsItem,
    mutator: current =>
      pruneAiVerdicts({
        aiVerdicts: current,
        subscriptions,
        channelVideos
      })
  });
}

/** Drops cached data of channels that are no longer semi-subscribed, and AI verdicts no filter can use anymore */
export async function pruneChannelCaches() {
  const subscriptions = await semiSubscriptionsItem.getValue();
  await Promise.all([
    pruneItem({
      item: channelVideosItem,
      subscriptions
    }),
    pruneItem({
      item: channelCheckedAtItem,
      subscriptions
    })
  ]);
  await pruneVerdicts(subscriptions);
}
