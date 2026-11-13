import { shortsLockupFromItem, videoIdFromContent } from "#feed/items/feed-items";
import { isPolymerElement } from "@/lib/youtube/page/polymer";
import {
  getYouTubeSite,
  SHORTS_PATH_PATTERN,
  VIDEO_LINK_SELECTOR,
  WATCH_VIDEO_PARAM,
  YouTubeSite
} from "@/lib/youtube/site";
import { z } from "@/lib/zod";

// The live subscriptions grid. www: a Polymer element whose model is written with `set("data.contents", ...)`.
// m: the grid is rendered by a signals framework that is not known to expose its model - a `data` property is
// written when present, though m has not been seen re-rendering its grid or Shorts shelf from one; the response and
// ytInitialData hooks are what cover m

const DESKTOP_GRID_SELECTOR = 'ytd-browse[page-subtype="subscriptions"] ytd-rich-grid-renderer';
/** The elements a feed tile renders as */
export enum FeedTileTag {
  DESKTOP = "ytd-rich-item-renderer",
  MOBILE = "ytm-rich-item-renderer",
  /** m's Shorts shelf lists bare lockups */
  MOBILE_SHORT = "ytm-shorts-lockup-view-model"
}

const DESKTOP_TILE_SELECTOR = `:scope > #contents > ${FeedTileTag.DESKTOP}`;
const DESKTOP_SHELF_TILE_SELECTOR = `:scope > #contents > ytd-rich-section-renderer ${FeedTileTag.DESKTOP}`;
const MOBILE_GRID_SELECTOR = "ytm-rich-grid-renderer";
const CONTENTS_PATH = "data.contents";

const gridDataSchema = z.looseObject({ contents: z.array(z.unknown()) });
const tileDataSchema = z.looseObject({ content: z.unknown() });

/** The element's `data` in the expected shape, or null when it has none or another */
function readElementData<TSchema extends z.ZodType>({ element, schema }: { element: HTMLElement; schema: TSchema }) {
  const parsed = "data" in element ? schema.safeParse(element.data) : null;
  return parsed?.success ? parsed.data : null;
}

function readDataContents(element: HTMLElement) {
  return (
    readElementData({
      element,
      schema: gridDataSchema
    })?.contents ?? null
  );
}

function writeDataContents({ element, contents }: { element: HTMLElement; contents: unknown[] }) {
  if (isPolymerElement(element)) {
    element.set(CONTENTS_PATH, contents);
    return;
  }

  const data = readElementData({
    element,
    schema: gridDataSchema
  });
  if ("data" in element && data) {
    element.data = {
      ...data,
      contents
    };
  }
}

export interface FeedGrid {
  element: HTMLElement;
  readContents(): unknown[] | null;
  writeContents(contents: unknown[]): void;
  /** The root-level tiles, and the Shorts shelf's */
  findTiles(): HTMLElement[];
  findShortsShelfTiles(): HTMLElement[];
}

function isShortsTile(elTile: HTMLElement) {
  const data = readElementData({
    element: elTile,
    schema: tileDataSchema
  });
  return !!data && shortsLockupFromItem(data.content) !== null;
}

/**
 * A Short sits nowhere but the Shorts shelf, so its tile is the only one with its video id - unlike the videos in
 * "Most relevant", which the band repeats. www only: m's grid is not written live
 */
function findShortsShelfTiles(elGrid: HTMLElement) {
  return [...elGrid.querySelectorAll<HTMLElement>(DESKTOP_SHELF_TILE_SELECTOR)].filter(isShortsTile);
}

function findGridElement() {
  const isMobile = getYouTubeSite() === YouTubeSite.MOBILE;
  return document.querySelector<HTMLElement>(isMobile ? MOBILE_GRID_SELECTOR : DESKTOP_GRID_SELECTOR);
}

/** null when the grid is not rendered yet; `isSupported: false` when it exposes no model to write */
export function findFeedGrid() {
  const element = findGridElement();
  if (!element) {
    return null;
  }

  const isMobile = getYouTubeSite() === YouTubeSite.MOBILE;
  const tileSelector = isMobile ? FeedTileTag.MOBILE : DESKTOP_TILE_SELECTOR;
  const grid: FeedGrid = {
    element,
    readContents() {
      return readDataContents(element);
    },
    writeContents(contents) {
      writeDataContents({
        element,
        contents
      });
    },
    findTiles() {
      return [...element.querySelectorAll<HTMLElement>(tileSelector), ...findShortsShelfTiles(element)];
    },
    findShortsShelfTiles() {
      return findShortsShelfTiles(element);
    }
  };
  return {
    grid,
    isSupported: "data" in element
  };
}

function videoIdFromLink(elTile: HTMLElement) {
  const elLink = elTile.querySelector<HTMLAnchorElement>(VIDEO_LINK_SELECTOR);
  if (!elLink) {
    return null;
  }

  const url = new URL(elLink.href, location.href);
  return url.searchParams.get(WATCH_VIDEO_PARAM) ?? SHORTS_PATH_PATTERN.exec(url.pathname)?.[1] ?? null;
}

export function videoIdFromTile(elTile: HTMLElement) {
  const data = readElementData({
    element: elTile,
    schema: tileDataSchema
  });
  const videoId = data ? videoIdFromContent(data.content) : null;
  return videoId ?? videoIdFromLink(elTile);
}
