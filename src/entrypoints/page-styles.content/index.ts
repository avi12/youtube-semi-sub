import "@/features/channel-button/channel-button.css";
import "@/features/feed/feed.css";
import "@/features/subscription-lists/subscription-lists.css";
import { YOUTUBE_MATCHES } from "@/lib/youtube/site";

export default defineContentScript({
  matches: YOUTUBE_MATCHES,
  main() {}
});
