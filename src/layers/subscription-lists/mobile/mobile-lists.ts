import MobileChannelsGroup from "./MobileChannelsGroup.svelte";
import MobileStripItems from "./MobileStripItems.svelte";
import { FeedPathname } from "@/lib/youtube/site";
import { listFollowedSubscriptions } from "#subscription-lists/semi-channels";
import { SemiListSurface, startSemiListSurface } from "#subscription-lists/semi-list-surface";

// m.youtube.com has no sidebar. Its channel lists are /feed/channels ("All channels": ytm-shelf-renderer >
// ytm-vertical-list-renderer > ytm-channel-list-item-renderer) and the avatar strip on top of /feed/subscriptions
// (ytm-channel-list-sub-menu-renderer > ytm-channel-list-sub-menu-avatar-renderer). Both need a signed-in session

const APP_SELECTOR = "ytm-app";
const CHANNEL_LIST_ITEM_SELECTOR = "ytm-browse ytm-channel-list-item-renderer";
const CHANNEL_LIST_SHELF_SELECTOR = "ytm-shelf-renderer, ytm-item-section-renderer";
const STRIP_AVATAR_SELECTOR = "ytm-browse ytm-channel-list-sub-menu-avatar-renderer";

function findChannelsPlacement() {
  const elShelf = document.querySelector(CHANNEL_LIST_ITEM_SELECTOR)?.closest(CHANNEL_LIST_SHELF_SELECTOR);
  const elParent = elShelf?.parentElement;
  if (!elShelf || !elParent) {
    return null;
  }

  return {
    target: elParent,
    anchor: elShelf
  };
}

function findStripPlacement() {
  const elFirstAvatar = document.querySelector(STRIP_AVATAR_SELECTOR);
  const elStrip = elFirstAvatar?.parentElement;
  if (!elFirstAvatar || !elStrip) {
    return null;
  }

  return {
    target: elStrip,
    anchor: elFirstAvatar
  };
}

export function startMobileLists() {
  startSemiListSurface({
    surface: SemiListSurface.mobileChannels,
    pathname: FeedPathname.channels,
    observedSelector: APP_SELECTOR,
    findPlacement: findChannelsPlacement,
    component: MobileChannelsGroup
  });
  startSemiListSurface({
    surface: SemiListSurface.mobileStrip,
    pathname: FeedPathname.subscriptions,
    observedSelector: APP_SELECTOR,
    findPlacement: findStripPlacement,
    component: MobileStripItems,
    listShown: listFollowedSubscriptions
  });
}
