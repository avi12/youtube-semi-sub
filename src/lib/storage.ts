import type { StorageItemKey, WxtStorageItemOptions } from "wxt/utils/storage";

import { storage } from "#imports";
import { channelIdSchema } from "@/lib/schemas/channel";
import {
  migrateSemiSubscriptionsToV2,
  migrateSemiSubscriptionsToV3,
  migrateSemiSubscriptionsToV4
} from "@/lib/schemas/semi-subscription";
import { type StoredState, storedStateSchema } from "@/lib/schemas/stored-state";
import { z } from "@/lib/zod";

const SEMI_SUBSCRIPTIONS_VERSION = 4;
/**
 * The cached uploads' shape. v2 marks Shorts, which a cache from before can't tell apart. A cache is refilled from the
 * network, so an upgrade drops it - together with the refresh throttle that guards it, so it is refetched at once
 */
const CHANNEL_VIDEOS_VERSION = 2;

function dropOutdatedCache() {
  return {};
}

const CHANNEL_CACHE_VERSIONING = {
  version: CHANNEL_VIDEOS_VERSION,
  migrations: {
    2: dropOutdatedCache
  }
};

/**
 * A storage item whose type comes from its zod schema: every read (getValue, watch) is validated and falls back on a
 * malformed value, and every write is validated before it lands
 */
function defineSchemaItem<Schema extends z.ZodType>({
  key,
  schema,
  fallback,
  ...versioning
}: Pick<WxtStorageItemOptions<z.infer<Schema>>, "version" | "migrations"> & {
  key: StorageItemKey;
  schema: Schema;
  fallback: z.infer<Schema>;
}) {
  const item = storage.defineItem<z.infer<Schema>>(key, {
    fallback,
    ...versioning
  });

  function parseOrFallback(value: unknown) {
    const parsed = schema.safeParse(value);
    return parsed.success ? parsed.data : fallback;
  }

  return {
    async getValue() {
      return parseOrFallback(await item.getValue());
    },
    setValue(value: z.infer<Schema>) {
      return item.setValue(schema.parse(value));
    },
    watch(callback: (value: z.infer<Schema>, previousValue: z.infer<Schema>) => void) {
      return item.watch((value, previousValue) => callback(parseOrFallback(value), parseOrFallback(previousValue)));
    }
  };
}

/** The channels the user semi-subscribed to, keyed by channel id */
export const semiSubscriptionsItem = defineSchemaItem({
  key: "local:semiSubscriptions",
  schema: storedStateSchema.shape.subscriptions,
  fallback: {},
  version: SEMI_SUBSCRIPTIONS_VERSION,
  migrations: {
    2: migrateSemiSubscriptionsToV2,
    3: migrateSemiSubscriptionsToV3,
    4: migrateSemiSubscriptionsToV4
  }
});

/** The latest uploads the background fetched per semi-subscribed channel - unfiltered, the filter is applied on read */
export const channelVideosItem = defineSchemaItem({
  key: "local:channelVideos",
  schema: storedStateSchema.shape.channelVideos,
  fallback: {},
  ...CHANNEL_CACHE_VERSIONING
});

/**
 * When each semi-subscribed channel was last fetched, for the refresh throttle. Kept out of `channelVideos` so a fetch
 * that finds nothing new writes nothing the pages watch
 */
export const channelCheckedAtItem = defineSchemaItem({
  key: "local:channelCheckedAt",
  schema: z.record(channelIdSchema, z.number()),
  fallback: {},
  ...CHANNEL_CACHE_VERSIONING
});

export const isExtensionEnabledItem = defineSchemaItem({
  key: "sync:isExtensionEnabled",
  schema: storedStateSchema.shape.isExtensionEnabled,
  fallback: true
});

export const isAnimationsEnabledItem = defineSchemaItem({
  key: "local:isAnimationsEnabled",
  schema: storedStateSchema.shape.isAnimationsEnabled,
  fallback: true
});

/** Opt-in: off until the user turns AI match on, and turning it off deletes the downloaded model */
export const isAiEnabledItem = defineSchemaItem({
  key: "local:isAiEnabled",
  schema: storedStateSchema.shape.isAiEnabled,
  fallback: false
});

/**
 * The model's verdicts per AI filter and video - a cache like `channelVideos`, so `selectFeedVideos` stays synchronous.
 * A video without a verdict is pending
 */
export const aiVerdictsItem = defineSchemaItem({
  key: "local:aiVerdicts",
  schema: storedStateSchema.shape.aiVerdicts,
  fallback: {}
});

/** A storage item read and written whole - what `mutateStorageItem` and the item tables take */
export interface StorageItem<T> {
  getValue(): Promise<T>;
  setValue(value: T): Promise<void>;
}

/** The item each `StoredState` field lives in - the one list every reader and watcher of the whole state walks */
const STORED_STATE_ITEMS = {
  isExtensionEnabled: isExtensionEnabledItem,
  isAnimationsEnabled: isAnimationsEnabledItem,
  isAiEnabled: isAiEnabledItem,
  subscriptions: semiSubscriptionsItem,
  channelVideos: channelVideosItem,
  aiVerdicts: aiVerdictsItem
} satisfies { [Key in keyof StoredState]: StorageItem<StoredState[Key]> };

export async function readStoredState() {
  const entries = await Promise.all(
    Object.entries(STORED_STATE_ITEMS).map(async ([key, item]) => [key, await item.getValue()])
  );
  return storedStateSchema.parse(Object.fromEntries(entries));
}

/** Calls back whenever any part of the stored state changes; returns the function that stops watching */
export function watchStoredState(callback: () => void) {
  const unwatchers = Object.values(STORED_STATE_ITEMS).map(item => item.watch(() => callback()));
  return () => {
    for (const unwatch of unwatchers) {
      unwatch();
    }
  };
}

const pendingMutationByItem = new WeakMap<object, Promise<unknown>>();

/** Serialises read-modify-write per item so concurrent mutations never drop each other's changes */
export function mutateStorageItem<T>({ item, mutator }: { item: StorageItem<T>; mutator: (value: T) => T }) {
  const previous = pendingMutationByItem.get(item) ?? Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(async () => {
      const value = await item.getValue();
      await item.setValue(mutator(value));
    });
  pendingMutationByItem.set(item, next);
  return next;
}
