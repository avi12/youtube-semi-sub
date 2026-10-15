import { startChannelsPageList } from "./channels-page";
import { startGuideEntries } from "./guide";
import { installGuideResponseHook } from "./guide-response-hook";
import { listsView } from "./lists-view.svelte";
import { startMobileLists } from "./mobile-lists";
import { listSemiSubscriptions } from "./semi-channels";
import { onPageState } from "@/lib/page/page-state";
import { getYouTubeSite, YouTubeSite } from "@/lib/youtube/site";

/** MAIN world, document_start: patch guide responses before YouTube reads them (m.youtube.com has no guide) */
export function installSubscriptionListsHook() {
  const isDesktop = getYouTubeSite() === YouTubeSite.desktop;
  if (isDesktop) {
    installGuideResponseHook();
  }
}

/** MAIN world, document_start: keep semi-subscribed channels listed in the sidebar and on /feed/channels */
export function startSubscriptionLists() {
  onPageState(state => {
    listsView.subscriptions = listSemiSubscriptions(state);
  });

  const isDesktop = getYouTubeSite() === YouTubeSite.desktop;
  if (!isDesktop) {
    startMobileLists();
    return;
  }

  void startGuideEntries();
  startChannelsPageList();
}
