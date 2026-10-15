import { type FeedGrid, flushPolymer, videoIdFromTile } from "./feed-grid";
import { settleBefore } from "./feed-session";

// The animated grid write (FLIP): leaving tiles fade out in place, then the model is written, surviving tiles are
// pinned to their old positions and released to glide into their new slots while new tiles scale and fade in.
// Only tiles in or near the viewport move; the motion itself lives in feed.css

const REFLOW_MARGIN_BELOW_PX = 1200;
const THUMBNAIL_DECODE_BUDGET_MS = 1500;
const TILE_STAMP_MICROTASK_LIMIT = 20;
const TILE_STAMP_FRAME_LIMIT = 10;
const MOTION_NAME_PREFIX = "yss-feed-";
const GLIDE_PROPERTY = "translate";

enum FeedMotionClass {
  pending = "yss-feed-pending",
  entering = "yss-feed-entering",
  leaving = "yss-feed-leaving",
  gliding = "yss-feed-gliding"
}

function nextFrame() {
  return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

function isInViewport(element: Element) {
  const { top, bottom } = element.getBoundingClientRect();
  return bottom > 0 && top < innerHeight;
}

function isInReflowZone(element: Element) {
  const { top, bottom } = element.getBoundingClientRect();
  return bottom > 0 && top < innerHeight + REFLOW_MARGIN_BELOW_PX;
}

function isFeedMotion(animation: Animation) {
  if (animation instanceof CSSAnimation) {
    return animation.animationName.startsWith(MOTION_NAME_PREFIX);
  }

  return animation instanceof CSSTransition && animation.transitionProperty === GLIDE_PROPERTY;
}

/** Only this feature's own motion - an unrelated infinite animation on a tile would never finish */
async function whenMotionFinishes(element: Element) {
  const motions = element.getAnimations().filter(isFeedMotion);
  await Promise.allSettled(motions.map(animation => animation.finished));
}

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

function findTilesByVideoId({ grid, videoIds }: {
  grid: FeedGrid;
  videoIds: ReadonlySet<string>;
}) {
  return grid.findTiles().filter(elTile => videoIds.has(videoIdFromTile(elTile) ?? ""));
}

async function fadeOutLeavingTiles({ grid, removedIds }: {
  grid: FeedGrid;
  removedIds: ReadonlySet<string>;
}) {
  const elLeaving = findTilesByVideoId({
    grid,
    videoIds: removedIds
  }).filter(isInViewport);
  for (const elTile of elLeaving) {
    elTile.classList.add(FeedMotionClass.leaving);
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
async function waitForEnteringTiles({ grid, insertedIds }: {
  grid: FeedGrid;
  insertedIds: ReadonlySet<string>;
}) {
  function hideStampedTiles() {
    const elStamped = findTilesByVideoId({
      grid,
      videoIds: insertedIds
    });
    for (const elTile of elStamped) {
      elTile.classList.add(FeedMotionClass.pending);
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

function pinSurvivors({ grid, oldRects, insertedIds }: {
  grid: FeedGrid;
  oldRects: ReadonlyMap<string, DOMRect>;
  insertedIds: ReadonlySet<string>;
}) {
  const elPinned: HTMLElement[] = [];
  for (const elTile of grid.findTiles().filter(isInReflowZone)) {
    const videoId = videoIdFromTile(elTile);
    const oldRect = videoId && !insertedIds.has(videoId) ? oldRects.get(videoId) : undefined;
    if (!oldRect) {
      continue;
    }

    elTile.style.translate = "";
    const newRect = elTile.getBoundingClientRect();
    const deltaX = oldRect.left - newRect.left;
    const deltaY = oldRect.top - newRect.top;
    const isMoved = Math.abs(deltaX) >= 1 || Math.abs(deltaY) >= 1;
    if (isMoved) {
      elTile.style.translate = `${deltaX}px ${deltaY}px`;
      elPinned.push(elTile);
    }
  }
  return elPinned;
}

async function glide(elTile: HTMLElement) {
  elTile.classList.add(FeedMotionClass.gliding);
  elTile.style.translate = "";
  await whenMotionFinishes(elTile);
  elTile.classList.remove(FeedMotionClass.gliding);
}

async function enter(elTile: HTMLElement) {
  elTile.classList.remove(FeedMotionClass.pending);

  if (!isInViewport(elTile)) {
    return;
  }

  elTile.classList.add(FeedMotionClass.entering);
  await whenMotionFinishes(elTile);
  elTile.classList.remove(FeedMotionClass.entering);
}

function clearMotionClasses(grid: FeedGrid) {
  for (const elTile of grid.findTiles()) {
    elTile.classList.remove(FeedMotionClass.leaving, FeedMotionClass.pending);
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
  await nextFrame();
  await Promise.all([...elPinned.map(glide), ...elEntering.map(enter)]);
  return true;
}
