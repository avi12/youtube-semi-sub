import { z } from "@/lib/zod";

// MAIN world: the current page's InnerTube data ({ response, playerResponse }) as YouTube's app holds it. Unlike
// window.ytInitialData, the app's copy follows SPA navigations

declare global {

  var ytInitialData: unknown;

  var ytInitialPlayerResponse: unknown;
}

interface PageManagerElement extends Element {
  getCurrentData(): unknown;
}

const pageManagerSchema = z.looseObject({
  getCurrentData: z.custom<() => unknown>(value => typeof value === "function")
});

/** m.youtube.com's app element keeps the page data as an own property */
const mobileAppSchema = z.looseObject({
  data: z.unknown()
});

const VIDEO_ID_PATH_PATTERN = /^\/live\/([\w-]{11})$/;
const VIDEO_ID_PARAMETER = "v";

function isPageManagerElement(elCandidate: Element | null): elCandidate is PageManagerElement {
  return pageManagerSchema.safeParse(elCandidate).success;
}

export function readPageData() {
  const elPageManager = document.querySelector("ytd-page-manager");
  const desktopData = isPageManagerElement(elPageManager) ? elPageManager.getCurrentData() : undefined;
  if (desktopData) {
    return desktopData;
  }

  const parsedMobileApp = mobileAppSchema.safeParse(document.querySelector("ytm-app"));
  if (parsedMobileApp.success && parsedMobileApp.data.data) {
    return parsedMobileApp.data.data;
  }

  return {
    response: globalThis.ytInitialData,
    playerResponse: globalThis.ytInitialPlayerResponse
  };
}

/** Signed out, YouTube's Subscribe is only a sign-in prompt, so every channel counts as not subscribed */
export function readIsSignedIn() {
  const parsed = z.boolean().safeParse(globalThis.ytcfg?.get("LOGGED_IN"));
  return parsed.success && parsed.data;
}

/** The video the URL points at, to tell the page data of a just-left watch page from the current one */
export function readUrlVideoId() {
  const liveVideoId = VIDEO_ID_PATH_PATTERN.exec(location.pathname)?.[1];
  return new URLSearchParams(location.search).get(VIDEO_ID_PARAMETER) ?? liveVideoId;
}
