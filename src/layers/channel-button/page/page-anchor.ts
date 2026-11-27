import { elementSchema, htmlElementSchema, isButtonElement } from "@/lib/dom-guards";
import { z } from "@/lib/zod";

import { PageKind } from "./channel-page-data";

// MAIN world: where YouTube's own Subscribe button sits on the current page, on www and m.youtube.com alike

export enum ButtonPlacement {
  /** Next to the Subscribe button in a watch page's owner row */
  OWNER_ROW = "owner-row",
  /** One more action in a channel header's action row */
  HEADER_ACTIONS = "header-actions"
}

export const BUTTON_ROOT_ATTRIBUTE = "data-yss-channel-button";

/** YouTube's own Subscribe control: www watch, www/m channel view model, m watch */
const OFFICIAL_SUBSCRIBE_SELECTOR = [
  "ytd-subscribe-button-renderer",
  "yt-subscribe-button-view-model",
  "ytm-subscribe-button-renderer"
].join(", ");
const HEADER_ACTION_SELECTOR = [".ytFlexibleActionsViewModelAction", ".yt-flexible-actions-view-model-wiz__action"]
  .map(selector => `${selector}:not([${BUTTON_ROOT_ATTRIBUTE}])`)
  .join(", ");
const SIGNED_OUT_SUBSCRIBE_SELECTOR = `:is(${HEADER_ACTION_SELECTOR}) button`;
const OWNER_ROW_REFERENCE_SELECTOR = "#subscribe-button";
const POLYMER_SCOPE_CLASS = "style-scope";
const SUBSCRIBED_CLASS = "is-subscribed";
const UNSUBSCRIBED_CLASS = "is-not-subscribed";
/** What YouTube's Subscribe control carries while the user is subscribed */
export const SUBSCRIBED_ATTRIBUTE = "subscribed";
const FILLED_BUTTON_PATTERN = /filled/i;
const TONAL_BUTTON_PATTERN = /tonal/i;
const LEADING_ICON_PATTERN = /IconLeading|icon-leading/;

/** Containers YouTube keeps as hidden copies after SPA navigations, so only a visible one counts */
const CONTAINER_SELECTORS: Record<PageKind, string[]> = {
  [PageKind.WATCH]: [
    "ytd-watch-metadata #owner",
    "ytd-video-secondary-info-renderer #top-row",
    ".slim-video-action-bar-actions",
    "ytm-slim-owner-renderer"
  ],
  [PageKind.CHANNEL]: [
    "yt-page-header-view-model yt-flexible-actions-view-model",
    "ytd-c4-tabbed-header-renderer #buttons",
    "ytm-c4-tabbed-header-renderer"
  ]
};

enum SubscribeControlTag {
  DESKTOP_RENDERER = "YTD-SUBSCRIBE-BUTTON-RENDERER",
  MOBILE_RENDERER = "YTM-SUBSCRIBE-BUTTON-RENDERER"
}

const subscribeControlDataSchema = z.looseObject({
  data: z.looseObject({
    channelId: z.string(),
    subscribed: z.boolean().optional()
  })
});

/** Where the button goes: next to `elReference`, styled after YouTube's own Subscribe button */
export const pageAnchorSchema = z.object({
  elContainer: htmlElementSchema,
  /** YouTube's own Subscribe control; null signed out, where a header action stands in for it */
  elSubscribe: htmlElementSchema.nullable(),
  elReference: elementSchema,
  placement: z.enum(ButtonPlacement),
  wrapperClass: z.string(),
  scopingClass: z.string(),
  nativeButtonClass: z.string()
});
type PageAnchor = z.infer<typeof pageAnchorSchema>;

function isVisible(elTarget: HTMLElement) {
  return elTarget.offsetWidth > 0 && elTarget.offsetHeight > 0;
}

function getPolymerScopeClass(elControl: Element) {
  return elControl.classList.contains(POLYMER_SCOPE_CLASS) ? (elControl.getAttribute("class") ?? "") : "";
}

function findReference({ elContainer, elControl }: { elContainer: HTMLElement; elControl: HTMLElement }) {
  const elHeaderAction = elControl.closest(HEADER_ACTION_SELECTOR);
  const isHeaderAction = !!elHeaderAction && elContainer.contains(elHeaderAction);
  if (isHeaderAction) {
    return {
      elReference: elHeaderAction,
      placement: ButtonPlacement.HEADER_ACTIONS,
      wrapperClass: elHeaderAction.getAttribute("class") ?? ""
    };
  }

  const elOwnerRowReference = elControl.closest(OWNER_ROW_REFERENCE_SELECTOR);
  const isOwnerRowReference = !!elOwnerRowReference && elContainer.contains(elOwnerRowReference);
  return {
    elReference: isOwnerRowReference ? elOwnerRowReference : elControl,
    placement: ButtonPlacement.OWNER_ROW,
    wrapperClass: ""
  };
}

/**
 * The visible spot for the button on a watch or channel page, or null until YouTube rendered it. Signed out, a
 * channel header's Subscribe is a plain sign-in button, so the first header action stands in for it
 */
export function findPageAnchor({ kind, isSignedIn }: { kind: PageKind; isSignedIn: boolean }) {
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

      const elNativeButton = isButtonElement(elControl) ? elControl : elControl.querySelector("button");
      const anchor: PageAnchor = {
        elContainer,
        elSubscribe,
        ...findReference({
          elContainer,
          elControl
        }),
        scopingClass: getPolymerScopeClass(elControl),
        nativeButtonClass: elNativeButton?.getAttribute("class") ?? ""
      };
      return anchor;
    }
  }
  return null;
}

/** The view model keeps its state in YouTube's entity store; its button style is the only outward sign */
function readViewModelSubscription(elSubscribe: HTMLElement) {
  const buttonClass = elSubscribe.querySelector("button")?.getAttribute("class") ?? "";
  if (FILLED_BUTTON_PATTERN.test(buttonClass)) {
    return false;
  }

  const isTonalWithBell = TONAL_BUTTON_PATTERN.test(buttonClass) && LEADING_ICON_PATTERN.test(buttonClass);
  return isTonalWithBell ? true : undefined;
}

function readMobileRendererSubscription({
  elSubscribe,
  isDataSubscribed
}: {
  elSubscribe: HTMLElement;
  isDataSubscribed: boolean | undefined;
}) {
  if (elSubscribe.classList.contains(SUBSCRIBED_CLASS)) {
    return true;
  }

  return elSubscribe.classList.contains(UNSUBSCRIBED_CLASS) ? false : isDataSubscribed;
}

/**
 * What YouTube's own Subscribe control shows. `isForChannel` is false while a reused control still holds the previous
 * page's channel; `isLive` marks the renderers, whose state tracks YouTube's entity store
 */
export function readSubscribeControl({
  elSubscribe,
  channelId,
  isCollaboration
}: {
  elSubscribe: HTMLElement;
  channelId: string;
  /** A collaboration's control opens a list of channels, so its data names none */
  isCollaboration: boolean;
}) {
  const parsed = subscribeControlDataSchema.safeParse(elSubscribe);
  const controlData = parsed.success ? parsed.data.data : null;
  const isRenderer =
    elSubscribe.tagName === SubscribeControlTag.DESKTOP_RENDERER ||
    elSubscribe.tagName === SubscribeControlTag.MOBILE_RENDERER;
  if (!isRenderer) {
    return {
      isForChannel: !controlData || controlData.channelId === channelId,
      isLive: false,
      isSubscribed: readViewModelSubscription(elSubscribe)
    };
  }

  const isForChannel = isCollaboration || controlData?.channelId === channelId;
  if (elSubscribe.tagName === SubscribeControlTag.DESKTOP_RENDERER) {
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
      isDataSubscribed: controlData?.subscribed
    })
  };
}
