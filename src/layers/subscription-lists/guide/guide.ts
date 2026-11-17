import { mount, unmount } from "svelte";

import { listsView } from "#subscription-lists/lists-view.svelte";
import { listFilteredSubscribedChannelIds, listFollowedSubscriptions } from "#subscription-lists/semi-channels";
import { onPageState } from "@/lib/page/page-state";
import { createFrameScheduler, observeSubtree, waitForElement, whenDocumentParsed } from "@/lib/utils/dom";
import { isPolymerElement, type PolymerElement } from "@/lib/youtube/page/polymer";

import {
  buildSemiGuideEntry,
  guideDataSchema,
  patchGuideItems,
  readSemiGuideEntryChannelId,
  readSubscribedGuideEntryChannelId,
  withoutCachedSubscriptionsFlyout
} from "./guide-data";
import GuideEntryAction from "./GuideEntryAction.svelte";

// www.youtube.com sidebar: the guide data is written through YouTube's own model, so the entries render, navigate
// and highlight natively. Only the manage button on each semi-subscribed entry is our own markup - on our entry for a
// followed channel, on YouTube's own entry for a subscribed one

const APP_SELECTOR = "ytd-app";
const GUIDE_DRAWER_SELECTOR = "tp-yt-app-drawer#guide";
const MINI_GUIDE_SELECTOR = "ytd-mini-guide-renderer";
const GUIDE_SELECTOR = "ytd-guide-renderer";
const GUIDE_ENTRY_SELECTOR = `${GUIDE_SELECTOR} ytd-guide-entry-renderer`;
const SEMI_ENTRY_ATTRIBUTE = "data-yss-semi";
const GUIDE_ITEMS_PATH = "data.items";

interface GuidePlacements {
  entries: unknown[];
  pinnedChannelIds: ReadonlySet<string>;
}

const mountedActionByEntry = new Map<
  Element,
  {
    channelId: string;
    component: ReturnType<typeof mount>;
  }
>();
const appliedToMiniGuide = new WeakMap<
  Element,
  {
    data: unknown;
    signature: string;
  }
>();

function readGuideData(element: PolymerElement) {
  const parsed = guideDataSchema.safeParse(element.data);
  return parsed.success ? parsed.data : null;
}

/** A path write on YouTube's own model: untouched sections keep their objects, so only the changed one re-renders */
function syncGuideData({ entries, pinnedChannelIds }: GuidePlacements) {
  for (const elGuide of document.querySelectorAll(GUIDE_SELECTOR)) {
    if (!isPolymerElement(elGuide)) {
      continue;
    }

    const data = readGuideData(elGuide);
    const items =
      data &&
      patchGuideItems({
        items: data.items,
        entries,
        pinnedChannelIds
      });
    if (items) {
      elGuide.set(GUIDE_ITEMS_PATH, items);
    }
  }
}

/**
 * The mini guide builds its Subscriptions flyout (hovering its Subscriptions entry) when `data` itself is assigned,
 * so it gets a fresh object - minus the flyout it cached - whenever the entries change
 */
function syncMiniGuideData({ entries, pinnedChannelIds }: GuidePlacements) {
  const signature = JSON.stringify([entries, [...pinnedChannelIds]]);
  for (const elMiniGuide of document.querySelectorAll(MINI_GUIDE_SELECTOR)) {
    if (!isPolymerElement(elMiniGuide)) {
      continue;
    }

    const applied = appliedToMiniGuide.get(elMiniGuide);
    const isUpToDate = applied !== undefined && applied.data === elMiniGuide.data && applied.signature === signature;
    const data = isUpToDate ? null : readGuideData(elMiniGuide);
    if (!data) {
      continue;
    }

    const items = patchGuideItems({
      items: data.items,
      entries,
      pinnedChannelIds
    });
    const isEntriesChanged = applied !== undefined && applied.signature !== signature;
    const isRebuildNeeded = items !== null || isEntriesChanged;
    if (!isRebuildNeeded) {
      appliedToMiniGuide.set(elMiniGuide, {
        data: elMiniGuide.data,
        signature
      });
      continue;
    }

    const rebuilt = {
      ...data,
      items: withoutCachedSubscriptionsFlyout(items ?? data.items)
    };
    elMiniGuide.data = rebuilt;
    appliedToMiniGuide.set(elMiniGuide, {
      data: rebuilt,
      signature
    });
  }
}

/** The semi-subscribed channel an entry stands for: ours, or YouTube's own for a channel in hide mode */
function readEntryChannelId(elEntry: Element) {
  if (!isPolymerElement(elEntry)) {
    return null;
  }

  const subscribedChannelId = readSubscribedGuideEntryChannelId(elEntry.data);
  const isSubscribedSemiChannel = listsView.subscriptions.some(
    subscription => subscription.channelId === subscribedChannelId && subscription.isSubscribed
  );
  return isSubscribedSemiChannel ? subscribedChannelId : readSemiGuideEntryChannelId(elEntry.data);
}

/** Polymer recycles entry elements between items, so a button follows the entry's current data, not the element */
function syncEntryActions() {
  const listedChannelIds = new Set(listsView.subscriptions.map(subscription => subscription.channelId));
  for (const [elEntry, mounted] of mountedActionByEntry) {
    const isStillSemiEntry = elEntry.isConnected && readEntryChannelId(elEntry) === mounted.channelId;
    const isCurrent = isStillSemiEntry && listedChannelIds.has(mounted.channelId);
    if (isCurrent) {
      continue;
    }

    unmount(mounted.component).catch(() => {});
    elEntry.removeAttribute(SEMI_ENTRY_ATTRIBUTE);
    mountedActionByEntry.delete(elEntry);
  }

  for (const elEntry of document.querySelectorAll(GUIDE_ENTRY_SELECTOR)) {
    const channelId = readEntryChannelId(elEntry);
    const isMounted = mountedActionByEntry.has(elEntry);
    const isSkipped = !channelId || isMounted || !listedChannelIds.has(channelId);
    if (isSkipped) {
      continue;
    }

    elEntry.setAttribute(SEMI_ENTRY_ATTRIBUTE, "");
    mountedActionByEntry.set(elEntry, {
      channelId,
      component: mount(GuideEntryAction, {
        target: elEntry,
        props: {
          channelId
        }
      })
    });
  }
}

function syncGuide() {
  const placements = {
    entries: listFollowedSubscriptions(listsView.subscriptions).map(buildSemiGuideEntry),
    pinnedChannelIds: listFilteredSubscribedChannelIds(listsView.subscriptions)
  };
  syncGuideData(placements);
  syncMiniGuideData(placements);
  syncEntryActions();
}

/** Observes only the guide drawer and the mini guide - both live in ytd-app's template for the whole session */
export async function startGuideEntries() {
  await whenDocumentParsed();
  // Pages without the app shell (a top-level /embed/ player, live chat) have no guide to wait for
  const hasApp = document.querySelector(APP_SELECTOR) !== null;
  if (!hasApp) {
    return;
  }

  const scheduleSync = createFrameScheduler(syncGuide);
  onPageState(scheduleSync);

  const elDrawer = await waitForElement(GUIDE_DRAWER_SELECTOR);
  const elMiniGuide = document.querySelector(MINI_GUIDE_SELECTOR);
  observeSubtree({
    elements: elMiniGuide ? [elDrawer, elMiniGuide] : [elDrawer],
    onChange: scheduleSync
  });
  scheduleSync();
}
