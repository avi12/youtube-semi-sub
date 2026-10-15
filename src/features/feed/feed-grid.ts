import { videoIdFromContent } from "./feed-items";
import { getYouTubeSite, YouTubeSite } from "@/lib/youtube/site";
import { z } from "@/lib/zod";

// The live subscriptions grid. www: a Polymer element whose model is written with `set("data.contents", ...)`.
// m: the grid is rendered by a signals framework that is not known to expose its model - a `data` property is
// used when present, otherwise the grid is left alone (the response and ytInitialData hooks cover m)

const DESKTOP_GRID_SELECTOR = "ytd-browse[page-subtype=\"subscriptions\"] ytd-rich-grid-renderer";
const DESKTOP_TILE_SELECTOR = ":scope > #contents > ytd-rich-item-renderer";
const MOBILE_GRID_SELECTOR = "ytm-rich-grid-renderer";
const MOBILE_TILE_SELECTOR = "ytm-rich-item-renderer";
const VIDEO_LINK_SELECTOR = "a[href*=\"/watch?v=\"], a[href*=\"/shorts/\"]";
const WATCH_VIDEO_PARAM = "v";
const SHORTS_PATH_PATTERN = /^\/shorts\/([\w-]{11})/;
const CONTENTS_PATH = "data.contents";
const POLYMER_GLOBAL = "Polymer";

const gridDataSchema = z.looseObject({ contents: z.array(z.unknown()) });
const tileDataSchema = z.looseObject({ content: z.unknown() });

interface PolymerElement extends HTMLElement {
  data: unknown;
  set(path: string, value: unknown): void;
}

function isPolymerElement(element: HTMLElement): element is PolymerElement {
  return "data" in element && "set" in element && typeof element.set === "function";
}

export function flushPolymer() {
  const polymer: unknown = Object.getOwnPropertyDescriptor(globalThis, POLYMER_GLOBAL)?.value;
  const flush = typeof polymer === "object" && polymer !== null && "flush" in polymer ? polymer.flush : undefined;
  if (typeof flush === "function") {
    flush.call(polymer);
  }
}

function readDataContents(element: HTMLElement) {
  const parsed = "data" in element ? gridDataSchema.safeParse(element.data) : null;
  return parsed?.success ? parsed.data.contents : null;
}

function writeDataContents({ element, contents }: {
  element: HTMLElement;
  contents: unknown[];
}) {
  if (isPolymerElement(element)) {
    element.set(CONTENTS_PATH, contents);
    return;
  }

  const parsed = "data" in element ? gridDataSchema.safeParse(element.data) : null;
  if ("data" in element && parsed?.success) {
    element.data = {
      ...parsed.data,
      contents
    };
  }
}

export interface FeedGrid {
  element: HTMLElement;
  readContents(): unknown[] | null;
  writeContents(contents: unknown[]): void;
  findTiles(): HTMLElement[];
}

function findGridElement() {
  const isMobile = getYouTubeSite() === YouTubeSite.mobile;
  return document.querySelector<HTMLElement>(isMobile ? MOBILE_GRID_SELECTOR : DESKTOP_GRID_SELECTOR);
}

/** null when the grid is not rendered yet; `isSupported: false` when it exposes no model to write */
export function findFeedGrid() {
  const element = findGridElement();
  if (!element) {
    return null;
  }

  const isMobile = getYouTubeSite() === YouTubeSite.mobile;
  const tileSelector = isMobile ? MOBILE_TILE_SELECTOR : DESKTOP_TILE_SELECTOR;
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
      return [...element.querySelectorAll<HTMLElement>(tileSelector)];
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
  const parsed = "data" in elTile ? tileDataSchema.safeParse(elTile.data) : null;
  const videoId = parsed?.success ? videoIdFromContent(parsed.data.content) : null;
  return videoId ?? videoIdFromLink(elTile);
}
