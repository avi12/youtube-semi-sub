import { initPageState } from "@/lib/page/page-state";
import { YOUTUBE_MATCHES } from "@/lib/youtube/site";
import { installSubscriptionEntityWatch, installSubscriptionWatch, startChannelButton } from "#channel-button";
import { installFeedResponseHook, startFeed } from "#feed";
import { installSubscriptionListsHook, startSubscriptionLists } from "#subscription-lists";

export default defineContentScript({
  matches: YOUTUBE_MATCHES,
  world: "MAIN",
  runAt: "document_start",
  main() {
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
