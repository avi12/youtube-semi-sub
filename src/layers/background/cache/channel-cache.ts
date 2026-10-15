import { mapWithConcurrency } from "./concurrency";
import { isVideoListUnchanged, mergeChannelVideos } from "./merge-channel-videos";
import type { ChannelVideosCache } from "@/lib/schemas/feed-video";
import type { SemiSubscriptions } from "@/lib/schemas/semi-subscription";
import { channelCheckedAtItem, channelVideosItem, mutateStorageItem, semiSubscriptionsItem } from "@/lib/storage";
import { type ChannelUploads, fetchChannelUploads } from "#background/uploads/channel-uploads";

const MIN_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const MAX_CONCURRENT_FETCHES = 4;
export const UPLOADS_UNAVAILABLE_ERROR = "Couldn't load uploads from YouTube";

interface ChannelRecordItem<Value> {
  getValue(): Promise<Record<string, Value>>;
  setValue(value: Record<string, Value>): Promise<void>;
}

function keepSubscribedChannels<Value>({ record, subscriptions }: {
  record: Record<string, Value>;
  subscriptions: SemiSubscriptions;
}) {
  const kept: Record<string, Value> = {};
  for (const channelId in record) {
    const value = record[channelId];
    const isKept = value !== undefined && Object.hasOwn(subscriptions, channelId);
    if (isKept) {
      kept[channelId] = value;
    }
  }
  return kept;
}

function hasUnsubscribedChannels({ record, subscriptions }: {
  record: Record<string, unknown>;
  subscriptions: SemiSubscriptions;
}) {
  for (const channelId in record) {
    if (!Object.hasOwn(subscriptions, channelId)) {
      return true;
    }
  }
  return false;
}

/** Unchanged entries keep their object identity, so a no-op is detectable by reference */
function applyUploads({ cache, uploadsList, subscriptions, now }: {
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
    const isUnchanged = entry !== undefined && isVideoListUnchanged({
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

function isSameCache({ previous, next }: {
  previous: ChannelVideosCache;
  next: ChannelVideosCache;
}) {
  const previousChannelIds = Object.keys(previous);
  return previousChannelIds.length === Object.keys(next).length
    && previousChannelIds.every(channelId => previous[channelId] === next[channelId]);
}

async function storeUploads({ uploadsList, subscriptions }: Pick<
  Parameters<typeof applyUploads>[0],
  "uploadsList" | "subscriptions"
>) {
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
    mutator: current => applyUploads({
      cache: current,
      uploadsList,
      subscriptions,
      now
    })
  });
}

async function recordCheckedAt({ channelIds, subscriptions }: {
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

/**
 * Fetches the given semi-subscribed channels and caches what changed; unless forced, recently fetched ones are skipped.
 * Resolves to false when not a single due channel could be fetched (offline, or YouTube is down)
 */
export async function refreshChannels({ channelIds, isForced }: {
  channelIds: string[];
  isForced: boolean;
}) {
  const dueChannelIds = isForced ? channelIds : await filterDueChannels(channelIds);
  if (dueChannelIds.length === 0) {
    return true;
  }

  const results = await mapWithConcurrency({
    items: dueChannelIds,
    limit: MAX_CONCURRENT_FETCHES,
    task: fetchChannelUploads
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
    channelIds: Object.keys(subscriptions),
    isForced
  });
}

/** A channel's uploads, unfiltered. Only a semi-subscribed channel is cached - the dialog previews others first */
export async function refreshChannel(channelId: string) {
  const isSubscribed = Object.hasOwn(await semiSubscriptionsItem.getValue(), channelId);
  if (!isSubscribed) {
    const uploads = await fetchChannelUploads(channelId);
    if (!uploads) {
      throw new Error(UPLOADS_UNAVAILABLE_ERROR);
    }

    return uploads.videos;
  }

  // A failed refetch still serves what is cached
  await refreshChannels({
    channelIds: [channelId],
    isForced: true
  });
  const cache = await channelVideosItem.getValue();
  const videos = cache[channelId]?.videos;
  if (!videos) {
    throw new Error(UPLOADS_UNAVAILABLE_ERROR);
  }

  return videos;
}

async function pruneItem<Value>({ item, subscriptions }: {
  item: ChannelRecordItem<Value>;
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
    mutator: current => keepSubscribedChannels({
      record: current,
      subscriptions
    })
  });
}

/** Drops cached data of channels that are no longer semi-subscribed */
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
}
