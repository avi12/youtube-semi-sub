import { buildShortsPath, buildWatchPath, InnerTubePath } from "@/lib/youtube/site";

// The navigation endpoints YouTube's router follows, shaped like the ones in its own responses

enum WebPageType {
  WATCH = "WEB_PAGE_TYPE_WATCH",
  SHORTS = "WEB_PAGE_TYPE_SHORTS",
  CHANNEL = "WEB_PAGE_TYPE_CHANNEL"
}

enum RootVisualElement {
  WATCH = 3832,
  SHORTS = 37414,
  CHANNEL = 3611
}

export function buildWatchEndpoint(videoId: string) {
  return {
    commandMetadata: {
      webCommandMetadata: {
        url: buildWatchPath(videoId),
        webPageType: WebPageType.WATCH,
        rootVe: RootVisualElement.WATCH
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
        webPageType: WebPageType.SHORTS,
        rootVe: RootVisualElement.SHORTS
      }
    },
    reelWatchEndpoint: {
      videoId
    }
  };
}

/** Opens the channel at `url`; `canonicalBaseUrl`, when given, is the handle path YouTube shows for it */
export function buildChannelEndpoint({
  channelId,
  url,
  canonicalBaseUrl
}: {
  channelId: string;
  url: string;
  canonicalBaseUrl: string | undefined;
}) {
  return {
    commandMetadata: {
      webCommandMetadata: {
        url,
        webPageType: WebPageType.CHANNEL,
        rootVe: RootVisualElement.CHANNEL,
        apiUrl: InnerTubePath.BROWSE
      }
    },
    browseEndpoint: {
      browseId: channelId,
      ...(canonicalBaseUrl && {
        canonicalBaseUrl
      })
    }
  };
}
