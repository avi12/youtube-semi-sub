import { openSemiSubDialog } from "#subscription-lists/components/open-dialog";
import { listsView } from "#subscription-lists/lists-view.svelte";
import { createPageWatcher } from "#subscription-lists/semi-list-surface";
import { isElement } from "@/lib/dom-guards";
import { onPageState } from "@/lib/page/page-state";
import { createFrameScheduler } from "@/lib/utils/dom";
import { isPolymerElement } from "@/lib/youtube/page/elements/polymer";
import { onYouTubeNavigate } from "@/lib/youtube/page/navigation";
import { FeedPathname } from "@/lib/youtube/site";

import { readSemiChannelId, withSemiChannelsSection } from "./channels-shelf";

// www.youtube.com/feed/channels is page "subscriptions-channels" in YouTube's page manager - a ytd-browse of its own.
// The semi-subscriptions are a section of its section list's data (see `channels-shelf`); YouTube replaces that data
// on every sort, so each pass puts the section back where it is missing or out of date

const PAGE_MANAGER_SELECTOR = "ytd-page-manager";
const SECTION_LIST_SELECTOR = "ytd-browse[page-subtype='subscriptions-channels'] ytd-section-list-renderer";
const CHANNEL_RENDERER_SELECTOR = "ytd-channel-renderer";
/** Where a channel row stamps its `subscribeButton` - for ours, the manage button */
const CHANNEL_BUTTON_SELECTOR = `${CHANNEL_RENDERER_SELECTOR} #subscribe-button button`;

function syncChannelsSection() {
  const elSectionList = document.querySelector(SECTION_LIST_SELECTOR);
  const isWithoutSectionList = !elSectionList || !isPolymerElement(elSectionList);
  if (isWithoutSectionList) {
    return;
  }

  const data = withSemiChannelsSection({
    data: elSectionList.data,
    subscriptions: listsView.subscriptions,
    isAiEnabled: listsView.isAiEnabled
  });
  if (data) {
    elSectionList.data = data;
  }
}

/** Our rows' buttons carry no command of their own: a click opens the dialog for that row's channel */
function handleManageButtonClick(event: MouseEvent) {
  const elButton = isElement(event.target) ? event.target.closest(CHANNEL_BUTTON_SELECTOR) : null;
  const elChannel = elButton?.closest(CHANNEL_RENDERER_SELECTOR);
  const isPolymerChannel = elChannel && isPolymerElement(elChannel);
  const channelId = isPolymerChannel ? readSemiChannelId(elChannel.data) : null;
  const subscription = listsView.subscriptions.find(listed => listed.channelId === channelId);
  if (!subscription) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  openSemiSubDialog(subscription);
}

export function startChannelsPageList() {
  const scheduleSync = createFrameScheduler(sync);
  const watchPage = createPageWatcher({
    pathname: FeedPathname.CHANNELS,
    observedSelector: PAGE_MANAGER_SELECTOR,
    onChange: scheduleSync
  });

  function sync() {
    if (watchPage()) {
      syncChannelsSection();
    }
  }

  addEventListener("click", handleManageButtonClick, { capture: true });
  onYouTubeNavigate(scheduleSync);
  onPageState(scheduleSync);
  scheduleSync();
}
