import { readYtcfg, YtcfgKey } from "@/lib/youtube/page/globals";
import { LIVE_PATH_PATTERN, WATCH_VIDEO_PARAM } from "@/lib/youtube/site";
import { z } from "@/lib/zod";
import { createGuard } from "@/lib/zod-guard";

// MAIN world: the current page's InnerTube data ({ response, playerResponse }) as YouTube's app holds it. Unlike
// window.ytInitialData, the app's copy follows SPA navigations

const isPageManagerElement = createGuard(
  z.object({
    getCurrentData: z.function({
      input: [],
      output: z.unknown()
    })
  })
);

/** m.youtube.com's app element keeps the page data as an own property */
const mobileAppSchema = z.looseObject({
  data: z.unknown()
});

const PAGE_MANAGER_SELECTOR = "ytd-page-manager";
const MOBILE_APP_SELECTOR = "ytm-app";
const isLoggedInSchema = z.boolean();

export function readPageData() {
  const elPageManager = document.querySelector(PAGE_MANAGER_SELECTOR);
  const desktopData = isPageManagerElement(elPageManager) ? elPageManager.getCurrentData() : undefined;
  if (desktopData) {
    return desktopData;
  }

  const parsedMobileApp = mobileAppSchema.safeParse(document.querySelector(MOBILE_APP_SELECTOR));
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
  const parsed = isLoggedInSchema.safeParse(readYtcfg(YtcfgKey.IS_LOGGED_IN));
  return parsed.success && parsed.data;
}

/** The video the URL points at, to tell the page data of a just-left watch page from the current one */
export function readUrlVideoId() {
  const liveVideoId = LIVE_PATH_PATTERN.exec(location.pathname)?.[1];
  return new URLSearchParams(location.search).get(WATCH_VIDEO_PARAM) ?? liveVideoId;
}
