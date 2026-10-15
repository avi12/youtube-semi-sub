import type { ChannelInfo } from "@/lib/schemas/channel";
import type { FeedVideo } from "@/lib/schemas/feed-video";
import type { SemiSubscriptions } from "@/lib/schemas/semi-subscription";
import type { ShortsLockup } from "@/lib/youtube/schemas/renderers";
import { planFeedBand, reflowBandIntoRuns } from "#feed/compose/band/feed-band";
import { buildFeedItem, findTemplate } from "#feed/compose/band/feed-item-builder";
import type { FeedSlot } from "#feed/compose/feed-slot";
import { buildShortsItem } from "#feed/compose/shelf/shorts-item-builder";
import { planShortsShelf } from "#feed/compose/shelf/shorts-shelf";
import type { VideoRenderer } from "#feed/items/feed-schemas";

/**
 * Where the semi-subscribed `videos` go - regular videos into the Latest band, Shorts into the feed's Shorts shelf when
 * it has one - and which of `removedVideoIds` leave either
 */
export function planFeed({ contents, videos, now, removedVideoIds }: Parameters<typeof planFeedBand>[0]) {
  const band = planFeedBand({
    contents,
    videos,
    now,
    removedVideoIds
  });
  const shelf = planShortsShelf({
    contents,
    videos,
    removedVideoIds,
    isWithinLoadedSpan: band.isWithinLoadedSpan
  });
  return {
    band,
    shelf,
    insertedVideos: [...band.insertedVideos, ...shelf?.insertedShorts ?? []],
    removedIds: [...band.removedIds, ...shelf?.removedIds ?? []],
    isChanged: band.isChanged || !!shelf?.isChanged
  };
}

/** Each slot's item: the one the feed holds, or one built for its video - unless nothing can be built for it */
function fillSlots({ slots, build }: {
  slots: readonly FeedSlot[];
  build: (video: FeedVideo) => unknown;
}) {
  const items: unknown[] = [];
  const insertedIds: string[] = [];
  for (const slot of slots) {
    if ("item" in slot) {
      items.push(slot.item);
      continue;
    }

    const item = build(slot.video);
    if (item) {
      items.push(item);
      insertedIds.push(slot.videoId);
    }
  }
  return {
    items,
    insertedIds
  };
}

/**
 * The feed contents with the semi-subscribed `videos` placed and `removedVideoIds` taken out, or null when nothing
 * changes. Synchronous: native renderers and avatars are looked up, never fetched
 */
export function composeFeedContents({
  contents,
  videos,
  subscriptions,
  removedVideoIds,
  now,
  locale,
  findNative,
  findNativeShort,
  findAvatarUrl
}: Parameters<typeof planFeed>[0] & {
  subscriptions: SemiSubscriptions;
  locale: string;
  findNative: (video: FeedVideo) => VideoRenderer | null;
  findNativeShort: (video: FeedVideo) => ShortsLockup | null;
  findAvatarUrl: (channelId: string) => string | null;
}) {
  const plan = planFeed({
    contents,
    videos,
    now,
    removedVideoIds
  });
  if (!plan.isChanged) {
    return null;
  }

  function channelFor(video: FeedVideo) {
    const subscription = subscriptions[video.channelId];
    const channel: ChannelInfo = {
      channelId: video.channelId,
      title: subscription?.title ?? video.channelTitle,
      handle: subscription?.handle,
      avatarUrl: subscription?.avatarUrl ?? findAvatarUrl(video.channelId) ?? undefined
    };
    return channel;
  }

  const bandTemplate = findTemplate(contents);
  const band = plan.band.isChanged && bandTemplate
    ? fillSlots({
      slots: plan.band.slots,
      build: video => buildFeedItem({
        video,
        channel: channelFor(video),
        native: findNative(video),
        template: bandTemplate,
        now,
        locale
      })
    })
    : null;
  const { shelf } = plan;
  const shelfItems = shelf?.isChanged
    ? fillSlots({
      slots: shelf.slots,
      build: video => buildShortsItem({
        video,
        native: findNativeShort(video),
        template: shelf.template,
        shelfKind: shelf.shelf.kind,
        now,
        locale
      })
    })
    : null;

  const bandRemovedIds = band ? plan.band.removedIds : [];
  const shelfRemovedIds = shelfItems ? shelf?.removedIds ?? [] : [];
  const insertedIds = [...band?.insertedIds ?? [], ...shelfItems?.insertedIds ?? []];
  const removedIds = [...bandRemovedIds, ...shelfRemovedIds];
  const isChanged = insertedIds.length > 0 || removedIds.length > 0;
  if (!isChanged) {
    return null;
  }

  const withShelf = shelf && shelfItems
    ? contents.with(shelf.iItem, shelf.shelf.withItems(shelfItems.items))
    : contents;
  return {
    contents: band
      ? reflowBandIntoRuns({
        contents: withShelf,
        runs: plan.band.runs,
        band: band.items
      })
      : [...withShelf],
    insertedIds,
    removedIds
  };
}
