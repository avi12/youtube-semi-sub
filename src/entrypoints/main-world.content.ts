import { installSubscriptionWatch, startChannelButton } from "@/features/channel-button";
import { installFeedResponseHook, startFeed } from "@/features/feed";
import { initPageState } from "@/lib/page/page-state";
import { YOUTUBE_MATCHES } from "@/lib/youtube/site";

export default defineContentScript({
  matches: YOUTUBE_MATCHES,
  world: "MAIN",
  runAt: "document_start",
  main() {
    installFeedResponseHook();
    installSubscriptionWatch();
    initPageState();
    startChannelButton();
    startFeed();
  }
});
