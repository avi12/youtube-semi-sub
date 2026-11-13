import type { ButtonViewModelData } from "@/lib/youtube/page/button-view-model";

// MAIN world: what YouTube's own scripts define on the page - its globals and the custom elements typed here

declare global {
  var ytcfg: { get(key: string): unknown } | undefined;

  var ytInitialData: unknown;

  var ytInitialPlayerResponse: unknown;

  interface HTMLElementTagNameMap {
    "yt-button-view-model": HTMLElement & { data: ButtonViewModelData };
  }
}

export enum YtcfgKey {
  innerTubeContext = "INNERTUBE_CONTEXT",
  clientNameNumber = "INNERTUBE_CONTEXT_CLIENT_NAME",
  sessionIndex = "SESSION_INDEX",
  delegatedSessionId = "DELEGATED_SESSION_ID",
  isLoggedIn = "LOGGED_IN"
}

/** A value from the page's config, or undefined until YouTube's scripts have set it up */
export function readYtcfg(key: YtcfgKey) {
  return globalThis.ytcfg?.get(key);
}
