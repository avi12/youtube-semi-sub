export enum YouTubeSite {
  desktop = "desktop",
  mobile = "mobile"
}

const MOBILE_HOSTNAME = "m.youtube.com";

export const YOUTUBE_ORIGIN = "https://www.youtube.com";
const YOUTUBE_HOSTNAMES: ReadonlySet<string> = new Set([new URL(YOUTUBE_ORIGIN).hostname, MOBILE_HOSTNAME]);
const TRAILING_SLASH_PATTERN = /(?<=.)\/$/;

const INNERTUBE_API_PATH = "/youtubei/v1";

/** A video id, unanchored - for building the patterns that find one inside a URL or path */
export const VIDEO_ID_SOURCE = String.raw`[\w-]{11}`;

/** The InnerTube API paths the extension reads or calls */
export enum InnerTubePath {
  browse = `${INNERTUBE_API_PATH}/browse`,
  next = `${INNERTUBE_API_PATH}/next`,
  guide = `${INNERTUBE_API_PATH}/guide`,
  subscribe = `${INNERTUBE_API_PATH}/subscription/subscribe`,
  unsubscribe = `${INNERTUBE_API_PATH}/subscription/unsubscribe`
}

/** The query parameter a watch URL carries the video id in */
export const WATCH_VIDEO_PARAM = "v";

const WATCH_PATH_PREFIX = `/watch?${WATCH_VIDEO_PARAM}=`;

/** A Short opens at `/shorts/<video id>` instead of a watch URL */
const SHORTS_PATH_PREFIX = "/shorts/";
export const SHORTS_PATH_PATTERN = new RegExp(`^${SHORTS_PATH_PREFIX}(${VIDEO_ID_SOURCE})`);

/** A livestream's own address, `/live/<video id>`, which plays on the watch page */
export const LIVE_PATH_PATTERN = new RegExp(`^/live/(${VIDEO_ID_SOURCE})$`);

/** Links that open a video: a watch URL, or a Short's */
export const VIDEO_LINK_SELECTOR = `a[href*="${WATCH_PATH_PREFIX}"], a[href*="${SHORTS_PATH_PREFIX}"]`;

export function buildWatchPath(videoId: string) {
  return `${WATCH_PATH_PREFIX}${videoId}`;
}

export function buildShortsPath(videoId: string) {
  return `${SHORTS_PATH_PREFIX}${videoId}`;
}

/** Whether `url` is on www or m.youtube.com at exactly `pathname` (a trailing slash aside) */
export function isYouTubeUrlAt({ url, pathname }: {
  url: string;
  pathname: string;
}) {
  if (!URL.canParse(url)) {
    return false;
  }

  const parsed = new URL(url);
  return YOUTUBE_HOSTNAMES.has(parsed.hostname) && parsed.pathname.replace(TRAILING_SLASH_PATTERN, "") === pathname;
}

export function isShortsUrl(href: string) {
  return URL.canParse(href) && SHORTS_PATH_PATTERN.test(new URL(href).pathname);
}

export enum FeedPathname {
  subscriptions = "/feed/subscriptions",
  channels = "/feed/channels"
}

export function getYouTubeSite() {
  return location.hostname === MOBILE_HOSTNAME ? YouTubeSite.mobile : YouTubeSite.desktop;
}

export const YOUTUBE_MATCHES = [`${YOUTUBE_ORIGIN}/*`, `https://${MOBILE_HOSTNAME}/*`];
