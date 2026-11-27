// YouTube's own image URLs for an upload, built from its id alone

const THUMBNAIL_BASE_URL = "https://i.ytimg.com/vi";

/** The 4:3 thumbnail every upload has - a Short's shows letterboxed */
export function buildVideoThumbnailUrl(videoId: string) {
  return `${THUMBNAIL_BASE_URL}/${videoId}/hqdefault.jpg`;
}

/** A Short's upright cover, at its original aspect ratio; regular videos have none */
export function buildShortsThumbnailUrl(videoId: string) {
  return `${THUMBNAIL_BASE_URL}/${videoId}/oardefault.jpg`;
}
