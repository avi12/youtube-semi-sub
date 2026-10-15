import { planFeedBand, reflowBandIntoRuns } from "./feed-band";
import { buildFeedItem, findTemplate } from "./feed-item-builder";
import type { ChannelInfo } from "@/lib/schemas/channel";
import type { FeedVideo } from "@/lib/schemas/feed-video";
import type { SemiSubscriptions } from "@/lib/schemas/semi-subscription";
import type { VideoRenderer } from "#feed/items/feed-items";

/**
 * The feed contents with the semi-subscribed `videos` placed into the band and `removedVideoIds` taken out, or null
 * when nothing changes. Synchronous: native renderers and avatars are looked up, never fetched
 */
export function composeFeedContents({
  contents,
  videos,
  subscriptions,
  removedVideoIds,
  now,
  locale,
  findNative,
  findAvatarUrl
}: {
  contents: readonly unknown[];
  videos: readonly FeedVideo[];
  subscriptions: SemiSubscriptions;
  removedVideoIds: ReadonlySet<string>;
  now: number;
  locale: string;
  findNative: (video: FeedVideo) => VideoRenderer | null;
  findAvatarUrl: (channelId: string) => string | null;
}) {
  const plan = planFeedBand({
    contents,
    videos,
    now,
    removedVideoIds
  });
  const template = findTemplate(contents);
  if (!plan.isChanged || !template) {
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

  const band: unknown[] = [];
  const insertedIds: string[] = [];
  for (const slot of plan.slots) {
    if ("item" in slot) {
      band.push(slot.item);
      continue;
    }

    const item = buildFeedItem({
      video: slot.video,
      channel: channelFor(slot.video),
      native: findNative(slot.video),
      template,
      now,
      locale
    });
    if (item) {
      band.push(item);
      insertedIds.push(slot.videoId);
    }
  }

  const isChanged = insertedIds.length > 0 || plan.removedIds.length > 0;
  if (!isChanged) {
    return null;
  }

  return {
    contents: reflowBandIntoRuns({
      contents,
      runs: plan.runs,
      band
    }),
    insertedIds,
    removedIds: plan.removedIds
  };
}
