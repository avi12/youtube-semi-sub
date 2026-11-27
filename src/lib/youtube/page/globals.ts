import type { ButtonViewModelData } from "@/lib/youtube/page/elements/button-view-model";

// MAIN world: what YouTube's own scripts define on the page - its globals and the custom elements typed here

declare global {
  var ytcfg: { get(key: string): unknown } | undefined;

  var ytInitialData: unknown;

  var ytInitialPlayerResponse: unknown;

  interface HTMLElementTagNameMap {
    "yt-button-view-model": HTMLElement & { data: ButtonViewModelData };
    "yt-icon": HTMLElement;
  }
}

export enum YtcfgKey {
  INNER_TUBE_CONTEXT = "INNERTUBE_CONTEXT",
  CLIENT_NAME_NUMBER = "INNERTUBE_CONTEXT_CLIENT_NAME",
  SESSION_INDEX = "SESSION_INDEX",
  DELEGATED_SESSION_ID = "DELEGATED_SESSION_ID",
  IS_LOGGED_IN = "LOGGED_IN"
}

/** A value from the page's config, or undefined until YouTube's scripts have set it up */
export function readYtcfg(key: YtcfgKey) {
  return globalThis.ytcfg?.get(key);
}
