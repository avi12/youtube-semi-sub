import { videoIdFromTile } from "./feed-grid";
import {
  FeedMotionClass,
  glide,
  isInGlide,
  isInViewport,
  nextFrame,
  pinAtOffset
} from "./feed-motion";
import { isYouTubeAutoFeedActive } from "./ytaf";
import { elementSchema, htmlElementSchema } from "@/lib/schemas/dom";
import { ironDropdownElementSchema, isIronDropdown } from "@/lib/youtube/page/iron-dropdown";
import { z } from "@/lib/zod";

// A tile's "More actions" menu is a fixed-position dropdown lined up with the tile's menu button when it opens, and its
// actions act on that tile's video. A grid write rebinds tiles in place, so once the video moves, the button the menu
// was lined up with shows another video (or is gone) and the menu would hang over the wrong tile. The menu's video is
// read when it opens; every write lines the menu up with that video's button again, or closes it when the video left
// the feed or the screen.
// YouTube refits the menu on a window resize against that button, which any re-render of the tile replaces - so a
// resize lines the menu up too. A resize mid-glide moves the slot its tile glides to, so the menu drops its own glide
// and is refit to its moving button every frame until the tile settles. While YouTube Auto Feed runs, the grid and its
// menus are its own

const TILE_SELECTOR = "ytd-rich-item-renderer";

const openMenuSchema = z.object({
  elDropdown: ironDropdownElementSchema,
  elAnchor: elementSchema,
  elTile: htmlElementSchema,
  videoId: z.string().min(1),
  buttonLabel: z.string().min(1)
});
type OpenMenu = z.infer<typeof openMenuSchema>;

const menuTargetSchema = z.object({
  elButton: htmlElementSchema,
  elTile: htmlElementSchema
});
type MenuTarget = z.infer<typeof menuTargetSchema>;

let openMenu: OpenMenu | null = null;
let isFollowingThroughResize = false;

function recordOpenedMenu(e: Event) {
  const [elDropdown] = e.composedPath();
  if (!isIronDropdown(elDropdown) || !elDropdown.positionTarget) {
    return;
  }

  const elAnchor = elDropdown.positionTarget;
  const elButton = elAnchor.matches("button") ? elAnchor : elAnchor.querySelector("button");
  const elTile = elButton?.closest<HTMLElement>(TILE_SELECTOR);
  const parsed = openMenuSchema.safeParse({
    elDropdown,
    elAnchor,
    elTile,
    videoId: elTile ? videoIdFromTile(elTile) : null,
    buttonLabel: elButton?.getAttribute("aria-label")
  });
  if (!parsed.success) {
    return;
  }

  openMenu = parsed.data;
}

/** The dropdown is shared by every popup, so it is still this menu only while it is lined up where it was left */
function trackedOpenMenu() {
  if (!openMenu || isYouTubeAutoFeedActive()) {
    return null;
  }

  const { elDropdown, elAnchor } = openMenu;
  return elDropdown.opened && elDropdown.positionTarget === elAnchor ? openMenu : null;
}

function distanceBetweenCenters({ left, right }: {
  left: DOMRect;
  right: DOMRect;
}) {
  return Math.hypot(
    left.left + left.width / 2 - (right.left + right.width / 2),
    left.top + left.height / 2 - (right.top + right.height / 2)
  );
}

/**
 * The tile the menu was last lined up with, while it still shows the menu's video. A write rebinds tiles to other
 * videos, and a video can sit in more than one band, so otherwise the copy beside the menu is taken
 */
function findMenuTarget({ menu, menuRect }: {
  menu: OpenMenu;
  menuRect: DOMRect;
}) {
  const { elTile, videoId, buttonLabel } = menu;
  const buttonSelector = `button[aria-label="${CSS.escape(buttonLabel)}"]`;
  const isTileShowingVideo = elTile.isConnected && videoIdFromTile(elTile) === videoId;
  const elCandidates = isTileShowingVideo
    ? [elTile]
    : [...document.querySelectorAll<HTMLElement>(TILE_SELECTOR)]
      .filter(elCandidate => videoIdFromTile(elCandidate) === videoId);
  function distanceFromMenu({ elButton }: MenuTarget) {
    return distanceBetweenCenters({
      left: elButton.getBoundingClientRect(),
      right: menuRect
    });
  }

  const [nearest] = elCandidates
    .flatMap(elCandidate => [...elCandidate.querySelectorAll<HTMLElement>(buttonSelector)]
      .map(elButton => ({
        elButton,
        elTile: elCandidate
      })))
    .sort((left, right) => distanceFromMenu(left) - distanceFromMenu(right));
  return nearest ?? null;
}

/** A tile pinned for its glide still stands at its old slot; this measures it where it comes to rest */
function atRest<TMeasured>({ elTile, measure }: {
  elTile: HTMLElement;
  measure: () => TMeasured;
}) {
  const pinnedTranslate = elTile.style.translate;
  elTile.style.translate = "";
  const measured = measure();
  elTile.style.translate = pinnedTranslate;
  return measured;
}

function lineUpMenu({ menu, target }: {
  menu: OpenMenu;
  target: MenuTarget;
}) {
  const { elDropdown } = menu;
  const { elButton, elTile } = target;
  // The refit offsets the menu's own glide, so a glide left in flight would carry it off the button
  elDropdown.classList.remove(FeedMotionClass.gliding);
  elDropdown.style.translate = "";
  elDropdown.positionTarget = elButton;
  elDropdown.refit();
  openMenu = {
    ...menu,
    elAnchor: elButton,
    elTile
  };
}

/** How far the menu jumped to reach its video's button, and whether its tile is about to glide there */
function followMenuVideo() {
  const menu = trackedOpenMenu();
  if (!menu) {
    return null;
  }

  const { elDropdown } = menu;
  const menuRect = elDropdown.getBoundingClientRect();
  const target = findMenuTarget({
    menu,
    menuRect
  });
  const isOnScreen = !!target && atRest({
    elTile: target.elTile,
    measure: () => isInViewport(target.elButton)
  });
  if (!target || !isOnScreen) {
    elDropdown.close();
    return null;
  }

  atRest({
    elTile: target.elTile,
    measure: () => lineUpMenu({
      menu,
      target
    })
  });
  const realignedRect = elDropdown.getBoundingClientRect();
  return {
    elDropdown,
    isTilePinned: target.elTile.style.translate !== "",
    deltaX: menuRect.left - realignedRect.left,
    deltaY: menuRect.top - realignedRect.top
  };
}

/** Lines the menu up with its video's button where it stands now, unless a glide is carrying it there */
function reanchorOpenMenu() {
  const menu = trackedOpenMenu();
  if (!menu || isInGlide(menu.elDropdown)) {
    return;
  }

  const target = findMenuTarget({
    menu,
    menuRect: menu.elDropdown.getBoundingClientRect()
  });
  if (!target) {
    return;
  }

  lineUpMenu({
    menu,
    target
  });
}

async function followMenuThroughResize({ elDropdown, elTile }: OpenMenu) {
  isFollowingThroughResize = true;
  elDropdown.classList.remove(FeedMotionClass.gliding);
  elDropdown.style.translate = "";
  try {
    while (isInGlide(elTile) && trackedOpenMenu()) {
      elDropdown.refit();
      await nextFrame();
    }
  } finally {
    isFollowingThroughResize = false;
  }

  reanchorOpenMenu();
}

function handleResize() {
  const menu = trackedOpenMenu();
  if (!menu || isFollowingThroughResize) {
    return;
  }

  if (isInGlide(menu.elDropdown)) {
    followMenuThroughResize(menu).catch(() => {});
    return;
  }

  reanchorOpenMenu();
}

/** MAIN world: keeps an open tile menu with its video across grid writes and window resizes */
export function startOpenMenuTracking() {
  document.addEventListener("iron-overlay-opened", recordOpenedMenu, true);
  addEventListener("resize", handleResize);
}

/** After an instant write: the menu jumps to its video's button */
export function alignOpenMenuToItsVideo() {
  followMenuVideo();
}

/**
 * After an animated write, with the survivors pinned: stands the menu back where it was so it glides along with its
 * tile; a tile that jumps takes its menu with it at once
 */
export function pinOpenMenuToItsVideo() {
  const followed = followMenuVideo();
  if (!followed?.isTilePinned) {
    return;
  }

  const { elDropdown, deltaX, deltaY } = followed;
  pinAtOffset({
    element: elDropdown,
    deltaX,
    deltaY
  });
}

/** Glides a pinned menu with its tile, then lines it up again: a resize mid-glide refits it against the moving tile */
export async function releaseOpenMenu() {
  const elDropdown = openMenu?.elDropdown;
  if (!elDropdown?.style.translate) {
    return;
  }

  await glide(elDropdown);
  reanchorOpenMenu();
}
