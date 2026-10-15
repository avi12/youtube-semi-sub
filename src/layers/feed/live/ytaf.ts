// YouTube Auto Feed (avi12/youtube-auto-feed) rewrites the feed grid from its own /browse polls and drops what
// they lack, so while it runs the grid is never written here: the patched response carries the videos, and ytaf
// is asked to refetch - over the BroadcastChannel it already listens on for subscription changes

const YTAF_PRESENCE_GLOBAL = "__ytafFeedMessenger";
const YTAF_CHANNEL_NAME = "ytaf";

enum YtafMessageType {
  subscriptionChange = "subscription-change"
}

/** Read lazily: the two extensions' content scripts load in no guaranteed order */
export function isYouTubeAutoFeedPresent() {
  return YTAF_PRESENCE_GLOBAL in globalThis;
}

export function nudgeYouTubeAutoFeed() {
  const channel = new BroadcastChannel(YTAF_CHANNEL_NAME);
  channel.postMessage({ type: YtafMessageType.subscriptionChange });
  channel.close();
}
