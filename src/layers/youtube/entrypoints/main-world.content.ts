import { installSubscriptionEntityWatch, installSubscriptionWatch, startChannelButton } from "#channel-button";
import { installFeedResponseHook, startFeed } from "#feed";
import { installSubscriptionListsHook, startSubscriptionLists } from "#subscription-lists";
import { initPageState } from "@/lib/page/page-state";
import { installPolymerHosts } from "@/lib/youtube/page/elements/polymer-host";
import { YOUTUBE_MATCHES } from "@/lib/youtube/site";

export default defineContentScript({
  matches: YOUTUBE_MATCHES,
  world: "MAIN",
  runAt: "document_start",
  main() {
    installPolymerHosts();
    installFeedResponseHook();
    installSubscriptionListsHook();
    installSubscriptionWatch();
    installSubscriptionEntityWatch();
    initPageState();
    startChannelButton();
    startFeed();
    startSubscriptionLists();
  }
});
