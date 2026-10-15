import { startLiveFeed } from "#feed/live/live-feed";
import { startOpenMenuTracking } from "#feed/live/open-menu";
import { startSemiUnsubscribeMenu } from "#feed/live/semi-unsubscribe-click";
import { installResponseHooks } from "#feed/response/response-hook";

/** MAIN world, document_start: patch subscriptions-feed responses before YouTube or YouTube Auto Feed reads them */
export function installFeedResponseHook() {
  installResponseHooks();
}

/** MAIN world, document_start: live-insert matching videos into an open subscriptions feed */
export function startFeed() {
  startLiveFeed();
  startSemiUnsubscribeMenu();
  startOpenMenuTracking();
}
