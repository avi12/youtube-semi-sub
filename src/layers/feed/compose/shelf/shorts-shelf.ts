import type { FeedSlot } from "#feed/compose/feed-slot";
import { isSemiSubscribedItem } from "#feed/compose/semi-subscribed-tag";
import { collectContentVideoIds, readShelf, shortsLockupFromItem, videoIdFromShelfItem } from "#feed/items/feed-items";
import { type FeedVideo, sortNewestFirst } from "@/lib/schemas/feed-video";

// The feed's Shorts shelf is the only place a semi-subscribed Short goes, and only when YouTube put one in the feed -
// none is ever created, and the shelf stays where it is. Shorts carry no publish time there, so semi-subscribed ones
// lead the shelf, newest first: each goes before the first semi-subscribed Short older than it, and before every Short
// YouTube put there. Like the band, it only takes Shorts within the loaded span

/** The first root-level shelf holding a Short, its index, and one of its Shorts to model built ones on */
export function findShortsShelf(contents: readonly unknown[]) {
  for (const [iItem, item] of contents.entries()) {
    const shelf = readShelf(item);
    const template = shelf?.items.map(shortsLockupFromItem).find(lockup => lockup !== null);
    if (shelf && template) {
      return {
        iItem,
        shelf,
        template
      };
    }
  }
  return null;
}

/**
 * Plans the Shorts shelf with the Shorts among `videos` inserted and `removedVideoIds` taken out; null when the feed
 * has no Shorts shelf
 */
export function planShortsShelf({
  contents,
  videos,
  removedVideoIds,
  isWithinLoadedSpan
}: {
  contents: readonly unknown[];
  videos: readonly FeedVideo[];
  removedVideoIds: ReadonlySet<string>;
  isWithinLoadedSpan: (video: FeedVideo) => boolean;
}) {
  const found = findShortsShelf(contents);
  if (!found) {
    return null;
  }

  const shelfSlots = found.shelf.items.map(item => ({
    videoId: videoIdFromShelfItem(item) ?? "",
    item
  }));
  const keptSlots = shelfSlots.filter(slot => !removedVideoIds.has(slot.videoId));
  const removedIds = shelfSlots.filter(slot => removedVideoIds.has(slot.videoId)).map(slot => slot.videoId);
  const shorts = videos.filter(video => video.isShort);
  const presentIds = collectContentVideoIds(contents);
  const insertedShorts = sortNewestFirst(
    shorts.filter(short => !presentIds.has(short.videoId) && isWithinLoadedSpan(short))
  );

  const publishedAtById = new Map(shorts.map(short => [short.videoId, short.publishedAt]));
  const pending = insertedShorts.map(video => ({
    videoId: video.videoId,
    video
  }));
  const slots: FeedSlot[] = [];
  for (const slot of keptSlots) {
    const publishedAt = isSemiSubscribedItem(slot.item) ? publishedAtById.get(slot.videoId) : undefined;
    while (pending[0] && (publishedAt === undefined || pending[0].video.publishedAt > publishedAt)) {
      slots.push(...pending.splice(0, 1));
    }
    slots.push(slot);
  }
  slots.push(...pending);

  return {
    ...found,
    slots,
    insertedShorts,
    removedIds,
    isChanged: insertedShorts.length > 0 || removedIds.length > 0
  };
}
