import type { ChannelVideosCache } from "@/lib/feed-video";
import type { SemiSubscriptions } from "@/lib/semi-subscription";
import { storage } from "#imports";

const STORAGE_SCHEMA_VERSION = 1;

/** The channels the user semi-subscribed to, keyed by channel id */
export const semiSubscriptionsItem = storage.defineItem<SemiSubscriptions>("local:semiSubscriptions", {
  fallback: {},
  version: STORAGE_SCHEMA_VERSION
});

/** The latest uploads the background fetched per semi-subscribed channel - unfiltered, the filter is applied on read */
export const channelVideosItem = storage.defineItem<ChannelVideosCache>("local:channelVideos", {
  fallback: {},
  version: STORAGE_SCHEMA_VERSION
});

export const isExtensionEnabledItem = storage.defineItem<boolean>("sync:isExtensionEnabled", {
  fallback: true
});

export const isAnimationsEnabledItem = storage.defineItem<boolean>("local:isAnimationsEnabled", {
  fallback: true
});

const pendingMutationByItem = new WeakMap<object, Promise<unknown>>();

/** Serialises read-modify-write per item so concurrent mutations never drop each other's changes */
export function mutateStorageItem<T>({ item, mutator }: {
  item: {
    getValue(): Promise<T>;
    setValue(value: T): Promise<void>;
  };
  mutator: (value: T) => T;
}) {
  const previous = pendingMutationByItem.get(item) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    const value = await item.getValue();
    await item.setValue(mutator(value));
  });
  pendingMutationByItem.set(item, next);
  return next;
}
