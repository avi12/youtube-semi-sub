import { PageKind } from "./channel-page-data";
import { z } from "@/lib/zod";

// MAIN world: where YouTube's own Subscribe button sits on the current page, on www and m.youtube.com alike

export enum ButtonPlacement {
  /** Next to the Subscribe button in a watch page's owner row */
  ownerRow = "owner-row",
  /** One more action in a channel header's action row */
  headerActions = "header-actions"
}

export const BUTTON_ROOT_ATTRIBUTE = "data-yss-channel-button";

/** YouTube's own Subscribe control: www watch, www/m channel view model, m watch */
const OFFICIAL_SUBSCRIBE_SELECTOR = [
  "ytd-subscribe-button-renderer",
  "yt-subscribe-button-view-model",
  "ytm-subscribe-button-renderer"
].join(", ");
const HEADER_ACTION_SELECTOR = [
  ".ytFlexibleActionsViewModelAction",
  ".yt-flexible-actions-view-model-wiz__action"
].map(selector => `${selector}:not([${BUTTON_ROOT_ATTRIBUTE}])`).join(", ");
const SIGNED_OUT_SUBSCRIBE_SELECTOR = `:is(${HEADER_ACTION_SELECTOR}) button`;
const OWNER_ROW_REFERENCE_SELECTOR = "#subscribe-button";
const POLYMER_SCOPE_CLASS = "style-scope";
const SUBSCRIBED_CLASS = "is-subscribed";
const UNSUBSCRIBED_CLASS = "is-not-subscribed";
const SUBSCRIBED_ATTRIBUTE = "subscribed";
const FILLED_BUTTON_PATTERN = /filled/i;
const TONAL_BUTTON_PATTERN = /tonal/i;
const LEADING_ICON_PATTERN = /IconLeading|icon-leading/;

/** Containers YouTube keeps as hidden copies after SPA navigations, so only a visible one counts */
const CONTAINER_SELECTORS: Record<PageKind, string[]> = {
  [PageKind.watch]: [
    "ytd-watch-metadata #owner",
    "ytd-video-secondary-info-renderer #top-row",
    ".slim-video-action-bar-actions",
    "ytm-slim-owner-renderer"
  ],
  [PageKind.channel]: [
    "yt-page-header-view-model yt-flexible-actions-view-model",
    "ytd-c4-tabbed-header-renderer #buttons",
    "ytm-c4-tabbed-header-renderer"
  ]
};

enum SubscribeControlTag {
  desktopRenderer = "YTD-SUBSCRIBE-BUTTON-RENDERER",
  mobileRenderer = "YTM-SUBSCRIBE-BUTTON-RENDERER"
}

const subscribeControlDataSchema = z.looseObject({
  data: z.looseObject({
    channelId: z.string(),
    subscribed: z.boolean().optional()
  })
});

function isVisible(elTarget: HTMLElement) {
  return elTarget.offsetWidth > 0 && elTarget.offsetHeight > 0;
}

function getPolymerScopeClass(elControl: Element) {
  return elControl.classList.contains(POLYMER_SCOPE_CLASS) ? elControl.getAttribute("class") ?? "" : "";
}

function findReference({ elContainer, elControl }: {
  elContainer: HTMLElement;
  elControl: HTMLElement;
}) {
  const elHeaderAction = elControl.closest(HEADER_ACTION_SELECTOR);
  const isHeaderAction = !!elHeaderAction && elContainer.contains(elHeaderAction);
  if (isHeaderAction) {
    return {
      elReference: elHeaderAction,
      placement: ButtonPlacement.headerActions,
      wrapperClass: elHeaderAction.getAttribute("class") ?? ""
    };
  }

  const elOwnerRowReference = elControl.closest(OWNER_ROW_REFERENCE_SELECTOR);
  const isOwnerRowReference = !!elOwnerRowReference && elContainer.contains(elOwnerRowReference);
  return {
    elReference: isOwnerRowReference ? elOwnerRowReference : elControl,
    placement: ButtonPlacement.ownerRow,
    wrapperClass: ""
  };
}

/**
 * The visible spot for the button on a watch or channel page, or null until YouTube rendered it. Signed out, a
 * channel header's Subscribe is a plain sign-in button, so the first header action stands in for it
 */
export function findPageAnchor({ kind, isSignedIn }: {
  kind: PageKind;
  isSignedIn: boolean;
}) {
  for (const selector of CONTAINER_SELECTORS[kind]) {
    for (const elContainer of document.querySelectorAll<HTMLElement>(selector)) {
      if (!isVisible(elContainer)) {
        continue;
      }

      const elSubscribe = elContainer.querySelector<HTMLElement>(OFFICIAL_SUBSCRIBE_SELECTOR);
      const elSignedOutSubscribe = elContainer.querySelector<HTMLElement>(SIGNED_OUT_SUBSCRIBE_SELECTOR);
      const elControl = elSubscribe ?? (isSignedIn ? null : elSignedOutSubscribe);
      if (!elControl) {
        continue;
      }

      const elNativeButton = elControl instanceof HTMLButtonElement ? elControl : elControl.querySelector("button");
      return {
        elContainer,
        elSubscribe,
        ...findReference({
          elContainer,
          elControl
        }),
        scopingClass: getPolymerScopeClass(elControl),
        nativeButtonClass: elNativeButton?.getAttribute("class") ?? ""
      };
    }
  }
  return null;
}

export type PageAnchor = NonNullable<ReturnType<typeof findPageAnchor>>;

/** The view model keeps its state in YouTube's entity store; its button style is the only outward sign */
function readViewModelSubscription(elSubscribe: HTMLElement) {
  const buttonClass = elSubscribe.querySelector("button")?.getAttribute("class") ?? "";
  if (FILLED_BUTTON_PATTERN.test(buttonClass)) {
    return false;
  }

  const isTonalWithBell = TONAL_BUTTON_PATTERN.test(buttonClass) && LEADING_ICON_PATTERN.test(buttonClass);
  return isTonalWithBell ? true : undefined;
}

function readMobileRendererSubscription({ elSubscribe, dataSubscribed }: {
  elSubscribe: HTMLElement;
  dataSubscribed: boolean | undefined;
}) {
  if (elSubscribe.classList.contains(SUBSCRIBED_CLASS)) {
    return true;
  }

  return elSubscribe.classList.contains(UNSUBSCRIBED_CLASS) ? false : dataSubscribed;
}

/**
 * What YouTube's own Subscribe control shows. `isForChannel` is false while a reused control still holds the previous
 * page's channel; `isLive` marks the renderers, whose state tracks YouTube's entity store
 */
export function readSubscribeControl({ elSubscribe, channelId }: {
  elSubscribe: HTMLElement;
  channelId: string;
}) {
  const parsed = subscribeControlDataSchema.safeParse(elSubscribe);
  const controlData = parsed.success ? parsed.data.data : null;
  const isRenderer = elSubscribe.tagName === SubscribeControlTag.desktopRenderer
    || elSubscribe.tagName === SubscribeControlTag.mobileRenderer;
  if (!isRenderer) {
    return {
      isForChannel: !controlData || controlData.channelId === channelId,
      isLive: false,
      isSubscribed: readViewModelSubscription(elSubscribe)
    };
  }

  const isForChannel = controlData?.channelId === channelId;
  if (elSubscribe.tagName === SubscribeControlTag.desktopRenderer) {
    return {
      isForChannel,
      isLive: true,
      isSubscribed: elSubscribe.hasAttribute(SUBSCRIBED_ATTRIBUTE)
    };
  }

  return {
    isForChannel,
    isLive: true,
    isSubscribed: readMobileRendererSubscription({
      elSubscribe,
      dataSubscribed: controlData?.subscribed
    })
  };
}
