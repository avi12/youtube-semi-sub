import { buildShortsPath, WATCH_VIDEO_PARAM } from "@/lib/youtube/site";

// The navigation endpoints YouTube's router follows, shaped like the ones in its own responses

enum WebPageType {
  watch = "WEB_PAGE_TYPE_WATCH",
  shorts = "WEB_PAGE_TYPE_SHORTS",
  channel = "WEB_PAGE_TYPE_CHANNEL"
}

enum RootVisualElement {
  watch = 3832,
  shorts = 37414,
  channel = 3611
}

const BROWSE_API_URL = "/youtubei/v1/browse";

export function buildWatchEndpoint(videoId: string) {
  return {
    commandMetadata: {
      webCommandMetadata: {
        url: `/watch?${WATCH_VIDEO_PARAM}=${videoId}`,
        webPageType: WebPageType.watch,
        rootVe: RootVisualElement.watch
      }
    },
    watchEndpoint: {
      videoId
    }
  };
}

/** Opens a Short in the Shorts player, which loads what plays after it by itself */
export function buildReelWatchEndpoint(videoId: string) {
  return {
    commandMetadata: {
      webCommandMetadata: {
        url: buildShortsPath(videoId),
        webPageType: WebPageType.shorts,
        rootVe: RootVisualElement.shorts
      }
    },
    reelWatchEndpoint: {
      videoId
    }
  };
}

/** Opens the channel at `url`; `canonicalBaseUrl`, when given, is the handle path YouTube shows for it */
export function buildChannelEndpoint({ channelId, url, canonicalBaseUrl }: {
  channelId: string;
  url: string;
  canonicalBaseUrl: string | undefined;
}) {
  return {
    commandMetadata: {
      webCommandMetadata: {
        url,
        webPageType: WebPageType.channel,
        rootVe: RootVisualElement.channel,
        apiUrl: BROWSE_API_URL
      }
    },
    browseEndpoint: {
      browseId: channelId,
      ...canonicalBaseUrl && {
        canonicalBaseUrl
      }
    }
  };
}
