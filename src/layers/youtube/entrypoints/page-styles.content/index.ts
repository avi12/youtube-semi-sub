import { YOUTUBE_MATCHES } from "@/lib/youtube/site";

import "#channel-button/channel-button.css";
import "#feed/feed.css";
import "#subscription-lists/subscription-lists.css";

export default defineContentScript({
  matches: YOUTUBE_MATCHES,
  main() {}
});
