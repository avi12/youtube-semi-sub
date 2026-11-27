import { SEMI_UNSUBSCRIBE_LABEL } from "#feed/compose/semi-unsubscribe-menu";
import { isElement } from "@/lib/dom-guards";
import { PageMessage, pageMessenger } from "@/lib/messaging/page-messaging";
import { getPageState } from "@/lib/page/page-state";
import { IRON_DROPDOWN_SELECTOR, isIronDropdown } from "@/lib/youtube/page/iron-dropdown";

import { FeedTileTag, videoIdFromTile } from "./feed-grid";

// Handles the "Semi-unsubscribe" item the built tiles carry in their menus. Its command is not one YouTube knows, so
// the tap is taken in the capture phase before YouTube resolves it. A menu is detached from its tile, so the tile a
// menu was opened from is remembered when it is tapped

// m's Shorts shelf lists bare lockups, with no rich item around them
const TILE_SELECTOR = Object.values(FeedTileTag).join(", ");
const MENU_ITEM_SELECTOR = [
  "yt-list-item-view-model",
  "ytd-menu-service-item-renderer",
  "ytm-menu-service-item-renderer",
  "ytm-menu-item"
].join(", ");
const ESCAPE_KEY = "Escape";

let lastTileChannelId: string | null = null;

function channelIdOfTile(elTile: HTMLElement) {
  const videoId = videoIdFromTile(elTile);
  const video = getPageState()?.followedUploads.find(upload => upload.videoId === videoId);
  return video?.channelId ?? null;
}

function closeMenu(elItem: Element) {
  const elDropdown = elItem.closest(IRON_DROPDOWN_SELECTOR);
  if (isIronDropdown(elDropdown)) {
    elDropdown.close();
    return;
  }

  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: ESCAPE_KEY,
      bubbles: true
    })
  );
}

function handleClick(event: MouseEvent) {
  if (!isElement(event.target)) {
    return;
  }

  const elTile = event.target.closest<HTMLElement>(TILE_SELECTOR);
  if (elTile) {
    lastTileChannelId = channelIdOfTile(elTile);
    return;
  }

  const elItem = event.target.closest(MENU_ITEM_SELECTOR);
  const isOwnItem = elItem?.textContent?.trim() === SEMI_UNSUBSCRIBE_LABEL;
  if (!elItem || !isOwnItem) {
    return;
  }

  event.stopPropagation();
  event.preventDefault();
  closeMenu(elItem);

  if (!lastTileChannelId) {
    return;
  }

  pageMessenger.sendMessage(PageMessage.SEMI_UNSUBSCRIBE, { channelId: lastTileChannelId }).catch(() => {});
}

export function startSemiUnsubscribeMenu() {
  addEventListener("click", handleClick, { capture: true });
}
