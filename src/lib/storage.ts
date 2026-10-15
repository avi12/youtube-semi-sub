import { channelIdSchema } from "@/lib/channel";
import { channelVideosCacheSchema } from "@/lib/feed-video";
import { semiSubscriptionsSchema } from "@/lib/semi-subscription";
import { z } from "@/lib/zod";
import { storage } from "#imports";
import type { StorageItemKey } from "wxt/utils/storage";

const STORAGE_SCHEMA_VERSION = 1;

/**
 * A storage item whose type comes from its zod schema: every read (getValue, watch) is validated and falls back on a
 * malformed value, and every write is validated before it lands
 */
function defineSchemaItem<Schema extends z.ZodType>({ key, schema, fallback, version }: {
  key: StorageItemKey;
  schema: Schema;
  fallback: z.infer<Schema>;
  version?: number;
}) {
  const item = storage.defineItem<z.infer<Schema>>(key, {
    fallback,
    ...version !== undefined && {
      version
    }
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
  schema: semiSubscriptionsSchema,
  fallback: {},
  version: STORAGE_SCHEMA_VERSION
});

/** The latest uploads the background fetched per semi-subscribed channel - unfiltered, the filter is applied on read */
export const channelVideosItem = defineSchemaItem({
  key: "local:channelVideos",
  schema: channelVideosCacheSchema,
  fallback: {},
  version: STORAGE_SCHEMA_VERSION
});

/**
 * When each semi-subscribed channel was last fetched, for the refresh throttle. Kept out of `channelVideos` so a fetch
 * that finds nothing new writes nothing the pages watch
 */
export const channelCheckedAtItem = defineSchemaItem({
  key: "local:channelCheckedAt",
  schema: z.record(channelIdSchema, z.number()),
  fallback: {}
});

export const isExtensionEnabledItem = defineSchemaItem({
  key: "sync:isExtensionEnabled",
  schema: z.boolean(),
  fallback: true
});

export const isAnimationsEnabledItem = defineSchemaItem({
  key: "local:isAnimationsEnabled",
  schema: z.boolean(),
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
