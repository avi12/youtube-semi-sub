export enum YouTubeSite {
  desktop = "desktop",
  mobile = "mobile"
}

const MOBILE_HOSTNAME = "m.youtube.com";

export function getYouTubeSite() {
  return location.hostname === MOBILE_HOSTNAME ? YouTubeSite.mobile : YouTubeSite.desktop;
}

export const YOUTUBE_MATCHES = ["https://www.youtube.com/*", "https://m.youtube.com/*"];
