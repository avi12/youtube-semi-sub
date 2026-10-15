export enum YouTubeSite {
  desktop = "desktop",
  mobile = "mobile"
}

const MOBILE_HOSTNAME = "m.youtube.com";

export const YOUTUBE_ORIGIN = "https://www.youtube.com";

/** The query parameter a watch URL carries the video id in */
export const WATCH_VIDEO_PARAM = "v";

/** A Short opens at `/shorts/<video id>` instead of a watch URL */
export const SHORTS_PATH_PATTERN = /^\/shorts\/([\w-]{11})/;

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
