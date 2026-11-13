import { settleBefore } from "@/lib/utils/promise";
import { flushPolymer } from "@/lib/youtube/page/polymer";

import { type FeedGrid, videoIdFromTile } from "./feed-grid";
import {
  FeedMotionClass,
  glide,
  isInReflowZone,
  isInViewport,
  nextFrame,
  pinAtOffset,
  whenMotionFinishes
} from "./feed-motion";
import { alignOpenMenuToItsVideo, pinOpenMenuToItsVideo, releaseOpenMenu } from "./open-menu";

// The animated grid write (FLIP): leaving tiles fade out in place, then the model is written, surviving tiles are
// pinned to their old positions and released to glide into their new slots while new tiles scale and fade in. The
// Shorts shelf moves the same way inside its row; a Short that slides into view from behind "Show more" fades in like a
// new one. An open tile menu rides along with its video

const THUMBNAIL_DECODE_BUDGET_MS = 1500;
const TILE_STAMP_MICROTASK_LIMIT = 20;
const TILE_STAMP_FRAME_LIMIT = 10;

function decodeImage(url: string) {
  const elImage = new Image();
  elImage.src = url;
  return elImage.decode().catch(() => {});
}

/** New tiles animate in over their real thumbnail instead of a blank one still downloading */
async function predecodeThumbnails(urls: readonly string[]) {
  await settleBefore({
    promise: Promise.all(urls.map(decodeImage)),
    deadline: Date.now() + THUMBNAIL_DECODE_BUDGET_MS
  });
}

function findTilesByVideoId({ grid, videoIds }: { grid: FeedGrid; videoIds: ReadonlySet<string> }) {
  return grid.findTiles().filter(elTile => videoIds.has(videoIdFromTile(elTile) ?? ""));
}

async function fadeOutLeavingTiles({ grid, removedIds }: { grid: FeedGrid; removedIds: ReadonlySet<string> }) {
  const elLeaving = findTilesByVideoId({
    grid,
    videoIds: removedIds
  }).filter(isInViewport);
  for (const elTile of elLeaving) {
    elTile.classList.add(FeedMotionClass.LEAVING);
  }
  await Promise.all(elLeaving.map(whenMotionFinishes));
}

function recordTileRects(grid: FeedGrid) {
  const rects = new Map<string, DOMRect>();
  for (const elTile of grid.findTiles().filter(isInReflowZone)) {
    const videoId = videoIdFromTile(elTile);
    if (videoId) {
      rects.set(videoId, elTile.getBoundingClientRect());
    }
  }
  return rects;
}

/** Polymer stamps new tiles across microtasks, then frames; each one stays hidden until its entrance */
async function waitForEnteringTiles({ grid, insertedIds }: { grid: FeedGrid; insertedIds: ReadonlySet<string> }) {
  function hideStampedTiles() {
    const elStamped = findTilesByVideoId({
      grid,
      videoIds: insertedIds
    });
    for (const elTile of elStamped) {
      elTile.classList.add(FeedMotionClass.PENDING);
    }
    return elStamped.length >= insertedIds.size;
  }

  for (let i = 0; i < TILE_STAMP_MICROTASK_LIMIT && !hideStampedTiles(); i++) {
    await Promise.resolve();
  }

  for (let i = 0; i < TILE_STAMP_FRAME_LIMIT && !hideStampedTiles(); i++) {
    await nextFrame();
  }

  return findTilesByVideoId({
    grid,
    videoIds: insertedIds
  });
}

function pinSurvivors({
  grid,
  oldRects,
  insertedIds
}: {
  grid: FeedGrid;
  oldRects: ReadonlyMap<string, DOMRect>;
  insertedIds: ReadonlySet<string>;
}) {
  const elPinned: HTMLElement[] = [];
  for (const elTile of grid.findTiles().filter(isInReflowZone)) {
    const videoId = videoIdFromTile(elTile);
    const isExisting = videoId && !insertedIds.has(videoId);
    const oldRect = isExisting ? oldRects.get(videoId) : undefined;
    if (!oldRect) {
      continue;
    }

    elTile.style.translate = "";
    const newRect = elTile.getBoundingClientRect();
    const isPinned = pinAtOffset({
      element: elTile,
      deltaX: oldRect.left - newRect.left,
      deltaY: oldRect.top - newRect.top
    });
    if (isPinned) {
      elPinned.push(elTile);
    }
  }
  return elPinned;
}

/** Shelf tiles that only came into view with the write: they stood behind the shelf's "Show more" */
function hideRevealedShelfTiles({
  grid,
  oldRects,
  insertedIds
}: {
  grid: FeedGrid;
  oldRects: ReadonlyMap<string, DOMRect>;
  insertedIds: ReadonlySet<string>;
}) {
  const elRevealed = grid.findShortsShelfTiles().filter(elTile => {
    const videoId = videoIdFromTile(elTile);
    return !!videoId && !insertedIds.has(videoId) && !oldRects.has(videoId) && isInViewport(elTile);
  });
  for (const elTile of elRevealed) {
    elTile.classList.add(FeedMotionClass.PENDING);
  }
  return elRevealed;
}

async function enter(elTile: HTMLElement) {
  elTile.classList.remove(FeedMotionClass.PENDING);

  if (!isInViewport(elTile)) {
    return;
  }

  elTile.classList.add(FeedMotionClass.ENTERING);
  await whenMotionFinishes(elTile);
  elTile.classList.remove(FeedMotionClass.ENTERING);
}

function clearMotionClasses(grid: FeedGrid) {
  for (const elTile of grid.findTiles()) {
    elTile.classList.remove(FeedMotionClass.LEAVING, FeedMotionClass.PENDING);
  }
}

/**
 * Writes `contents` to the grid; `isCurrent` is re-checked right before the write so a grid YouTube re-rendered
 * meanwhile is never overwritten with stale contents. Resolves to whether the write happened
 */
export async function writeGridContents({
  grid,
  contents,
  insertedIds,
  removedIds,
  thumbnailUrls,
  isAnimated,
  isCurrent
}: {
  grid: FeedGrid;
  contents: unknown[];
  insertedIds: ReadonlySet<string>;
  removedIds: ReadonlySet<string>;
  thumbnailUrls: readonly string[];
  isAnimated: boolean;
  isCurrent: () => boolean;
}) {
  if (!isAnimated) {
    const isWritable = isCurrent();
    if (isWritable) {
      grid.writeContents(contents);
      alignOpenMenuToItsVideo();
    }

    return isWritable;
  }

  await predecodeThumbnails(thumbnailUrls);
  await fadeOutLeavingTiles({
    grid,
    removedIds
  });

  if (!isCurrent()) {
    clearMotionClasses(grid);
    return false;
  }

  const oldRects = recordTileRects(grid);
  grid.writeContents(contents);
  flushPolymer();
  // Polymer reuses tile elements across indexes, so a faded-out element may now hold a surviving video
  clearMotionClasses(grid);
  const elEntering = await waitForEnteringTiles({
    grid,
    insertedIds
  });
  const elPinned = pinSurvivors({
    grid,
    oldRects,
    insertedIds
  });
  const elRevealed = hideRevealedShelfTiles({
    grid,
    oldRects,
    insertedIds
  });
  pinOpenMenuToItsVideo();
  await nextFrame();
  await Promise.all([...elPinned.map(glide), ...[...elEntering, ...elRevealed].map(enter), releaseOpenMenu()]);
  return true;
}
