import { vi } from "vitest";

import { CHANNEL_ID, desktopFeedItem, NOW, VIDEO_ID_DIGITS } from "#feed/fixtures/feed-fixtures";
import { rendererFromGridItem } from "#feed/items/feed-items";
import {
  type AiFilter,
  DEFAULT_TITLE_FILTER,
  FilterKind,
  type RegexFilter,
  type TitleFilter
} from "@/lib/filter/schema/video-filter-schema";
import type { PageState } from "@/lib/messaging/page-messaging";

/** The channels this tab's YouTube data says the user is subscribed to, or not */
export const officialSubscriptions = new Map<string, boolean>();

/** The titles the channels' own tabs show, by video id - what a loaded native renderer would carry */
export const nativeTitles = new Map<string, string>();

export const OTHER_CHANNEL_ID = "UCalreadysubscribedchan2";
export const PUBLISHED = "2 hours ago";
export const KEEP_FILTER: RegexFilter = {
  kind: FilterKind.REGEX,
  pattern: "keep",
  flags: "i"
};
export const AI_FILTER: AiFilter = {
  kind: FilterKind.AI_MATCH,
  description: "Only reviews"
};

/** The native renderer a channel's tab would show for a video, carrying the title `nativeTitles` gives it */
export function findNativeRendererByTitle({ videoId: id }: { videoId: string }) {
  const title = nativeTitles.get(id);
  return title === undefined
    ? null
    : rendererFromGridItem(
        desktopFeedItem({
          index: Number(id.slice(-VIDEO_ID_DIGITS)),
          published: PUBLISHED,
          channelId: CHANNEL_ID,
          title
        })
      );
}

export function pageState({
  isSubscribed,
  followedUploads,
  filter = isSubscribed ? DEFAULT_TITLE_FILTER : KEEP_FILTER,
  hideFilter = DEFAULT_TITLE_FILTER,
  isAiEnabled = false,
  aiVerdicts = {}
}: Pick<PageState, "followedUploads"> &
  Partial<Pick<PageState, "isAiEnabled" | "aiVerdicts">> & {
    isSubscribed: boolean;
    filter?: TitleFilter;
    hideFilter?: TitleFilter;
  }) {
  const state: PageState = {
    isExtensionEnabled: true,
    isAnimationsEnabled: true,
    isAiEnabled,
    aiVerdicts,
    subscriptions: {
      [CHANNEL_ID]: {
        channelId: CHANNEL_ID,
        title: "Semi Channel",
        followFilter: filter,
        hideFilter,
        createdAt: 1,
        isSubscribed
      }
    },
    followedUploads,
    hiddenVideoIds: []
  };
  return state;
}

export function semiChannelItem({ index, title }: { index: number; title?: string }) {
  return desktopFeedItem({
    index,
    published: PUBLISHED,
    channelId: CHANNEL_ID,
    title
  });
}


/** A fresh page session at `NOW`, its modules loaded anew so no state carries over from the last test */
export async function startSession() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  nativeTitles.clear();
  officialSubscriptions.clear();
  vi.resetModules();
  return {
    ...(await import("#feed/session/feed-session")),
    ...(await import("#feed/session/hidden-videos")),
    ...(await import("#feed/session/inserted-videos")),
    ...(await import("#feed/session/resumed-channels"))
  };
}

export type FeedSession = Awaited<ReturnType<typeof startSession>>;
