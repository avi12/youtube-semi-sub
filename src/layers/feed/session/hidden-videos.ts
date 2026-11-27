import { readOfficialSubscription } from "#channel-button";
import {
  channelIdsFromGridItem,
  durationFromGridItem,
  shelfItemsFromGridItem,
  titleFromGridItem,
  videoIdFromShelfItem
} from "#feed/items/feed-items";
import { createSubscribedHideCheck } from "@/lib/filter/title-filter";
import type { PageState } from "@/lib/messaging/page-messaging";
import { isUploadsTabDetailFiltered } from "@/lib/schemas/semi-subscription";

let previousHideSettingsKey: string | null = null;
/** What hides videos changed since the feed last caught up with it */
let isHideSettingsChanged = false;

/** Everything that decides what is hidden, besides the uploads and verdicts: the switch, each mode, each hide filter */
function readHideSettingsKey({ isExtensionEnabled, subscriptions }: PageState) {
  const channelSettings = Object.entries(subscriptions)
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([channelId, { isSubscribed, hideFilter, followFilter }]) => [
      channelId,
      isSubscribed,
      hideFilter,
      followFilter
    ]);
  return JSON.stringify([isExtensionEnabled, channelSettings]);
}

/** Follows every page state for a hide filter edited, a mode switched or the extension switched */
export function trackHideSettings(state: PageState) {
  const key = readHideSettingsKey(state);
  const isChanged = previousHideSettingsKey !== null && key !== previousHideSettingsKey;
  previousHideSettingsKey = key;
  isHideSettingsChanged ||= isChanged;
}

/** Whether what hides videos changed since the last call - a YouTube Auto Feed has to refetch to show it */
export function takeHideSettingsChange() {
  const isChanged = isHideSettingsChanged;
  isHideSettingsChanged = false;
  return isChanged;
}

/**
 * Whether the subscribed channels' filters hide a feed item, judged by the title and length the item shows - a YouTube
 * title test can make the title differ from the cached one. A collaboration is hidden only when every channel on it
 * the user is subscribed to would hide it: one that keeps it - a subscribed channel whose filters let it through, or a
 * plain YouTube subscription - is reason enough to show it. Null for an item that names no channel, such as a Short:
 * only the cached uploads know whose it is - and for one a length or type filter judges, which the cached uploads
 * know from the channel's tabs
 */
function createShownTitleHideCheck(state: PageState) {
  return function isHiddenByShownTitle({ item, videoId }: { item: unknown; videoId: string }) {
    const channelIds = [...channelIdsFromGridItem(item)];
    if (channelIds.length === 0) {
      return null;
    }

    const isKeptByPlainSubscription = channelIds.some(
      channelId => !state.subscriptions[channelId] && readOfficialSubscription(channelId) === true
    );
    const filteredSubscriptions = channelIds.flatMap(channelId => {
      const subscription = state.subscriptions[channelId];
      return subscription?.isSubscribed ? [subscription] : [];
    });
    if (isKeptByPlainSubscription || filteredSubscriptions.length === 0) {
      return false;
    }

    const video = {
      videoId,
      title: titleFromGridItem(item) ?? "",
      durationSeconds: durationFromGridItem(item)
    };
    // A tile shows no upload type, and a live one no length - the cached uploads, filled from the channel's tabs, know
    const isTabDetailRead = filteredSubscriptions.some(isUploadsTabDetailFiltered);
    if (isTabDetailRead) {
      return null;
    }

    return filteredSubscriptions.every(subscription => {
      const isHidden = createSubscribedHideCheck({
        subscription,
        aiVerdicts: state.aiVerdicts,
        isAiEnabled: state.isAiEnabled
      });
      return !!isHidden && isHidden(video);
    });
  };
}

/**
 * What this session last judged each feed item that names its channels - the cached uploads can't tell a
 * collaboration from a solo upload, so a page that lacks an item keeps the item's own verdict. Dropped whenever what
 * hides videos changes
 */
let shownVerdicts = {
  settingsKey: "",
  isHiddenById: new Map<string, boolean>()
};

function readShownVerdicts(state: PageState) {
  const settingsKey = readHideSettingsKey(state);
  if (shownVerdicts.settingsKey !== settingsKey) {
    shownVerdicts = {
      settingsKey,
      isHiddenById: new Map()
    };
  }

  return shownVerdicts.isHiddenById;
}

/**
 * The videos subscribed channels' hide filters hide - none while switched off: every cached upload they hide, since a
 * page may lack one an earlier page put in the grid, then each feed item that names its channels, in the band or a
 * shelf, judged again by the title it shows - a verdict remembered for the pages that lack the item
 */
export function findHiddenVideoIds({ contents, state }: { contents: readonly unknown[]; state: PageState }) {
  if (!state.isExtensionEnabled) {
    return new Set<string>();
  }

  const isHiddenById = readShownVerdicts(state);
  const hiddenIds = new Set(state.hiddenVideoIds.filter(videoId => isHiddenById.get(videoId) !== false));
  const isHiddenByShownTitle = createShownTitleHideCheck(state);
  for (const item of contents.flatMap(gridItem => [gridItem, ...shelfItemsFromGridItem(gridItem)])) {
    const videoId = videoIdFromShelfItem(item);
    if (!videoId) {
      continue;
    }

    const isHidden = isHiddenByShownTitle({
      item,
      videoId
    });
    if (isHidden === null) {
      continue;
    }

    isHiddenById.set(videoId, isHidden);

    if (isHidden) {
      hiddenIds.add(videoId);
    } else {
      hiddenIds.delete(videoId);
    }
  }
  return hiddenIds;
}
