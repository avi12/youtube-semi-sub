import { getPageKind, type PageChannel, PageKind, readPageChannel } from "./channel-page-data";
import { buildNativeButtonClasses } from "./native-button-classes";
import {
  getObservedOfficialSubscription,
  onObservedOfficialSubscriptionChange,
  setObservedOfficialSubscription
} from "./official-subscription";
import { findPageAnchor, type PageAnchor, readSubscribeControl } from "./page-anchor";
import { readIsSignedIn, readPageData, readUrlVideoId } from "./page-data-source";
import SemiSubButton from "./SemiSubButton.svelte";
import { onYouTubeNavigate } from "@/lib/youtube/navigation";
import { getYouTubeSite } from "@/lib/youtube/site";
import { z } from "@/lib/zod";
import { mount, unmount } from "svelte";

// MAIN world: keeps one Semi-subscribe button next to YouTube's own Subscribe button, across SPA navigations

/** YouTube may re-render the row it sits in; past this many re-mounts on one page, it gives up instead of fighting */
const MAX_MOUNTS_PER_PAGE = 8;
const SUBSCRIPTION_CHANGED_EVENT = "yt-subscription-changed";
const CHILD_LIST_SUBTREE: MutationObserverInit = {
  childList: true,
  subtree: true
};
const SUBSCRIBE_CONTROL_MUTATIONS: MutationObserverInit = {
  subtree: true,
  attributes: true,
  attributeFilter: ["subscribed", "class"]
};

/** Why there is no target yet: the page is still rendering, or the page gets no button at all */
enum Unresolved {
  pending = "pending",
  noButton = "no-button"
}

const subscriptionChangedDetailSchema = z.boolean();

interface Target {
  pageChannel: PageChannel;
  anchor: PageAnchor;
}

let cachedPageData: unknown = null;
let cachedPageChannel: PageChannel | null = null;

function readPageChannelOnce({ pageData, kind }: {
  pageData: unknown;
  kind: PageKind;
}) {
  const isCached = pageData === cachedPageData && cachedPageChannel?.kind === kind;
  if (isCached) {
    return cachedPageChannel;
  }

  cachedPageData = pageData;
  cachedPageChannel = readPageChannel({
    pageData,
    kind
  });
  return cachedPageChannel;
}

function resolveTarget(kind: PageKind) {
  const pageChannel = readPageChannelOnce({
    pageData: readPageData(),
    kind
  });
  if (!pageChannel) {
    return Unresolved.pending;
  }

  const urlVideoId = readUrlVideoId();
  const isStaleWatchData = kind === PageKind.watch && !!urlVideoId && !!pageChannel.videoId
    && pageChannel.videoId !== urlVideoId;
  if (isStaleWatchData) {
    return Unresolved.pending;
  }

  const isSignedIn = readIsSignedIn();
  const isViewersOwnChannel = pageChannel.isOwnedByViewer || (isSignedIn && !pageChannel.hasSubscribeControl);
  if (isViewersOwnChannel) {
    return Unresolved.noButton;
  }

  const anchor = findPageAnchor({
    kind,
    isSignedIn
  });
  const isControlForOtherChannel = !!anchor?.elSubscribe && !readSubscribeControl({
    elSubscribe: anchor.elSubscribe,
    channelId: pageChannel.channel.channelId
  }).isForChannel;
  if (!anchor || isControlForOtherChannel) {
    return Unresolved.pending;
  }

  const target: Target = {
    pageChannel,
    anchor
  };
  return target;
}

/** Live control state first (it tracks YouTube's entity store), then what this tab saw, then the page data */
function readIsOfficiallySubscribed({ pageChannel, anchor }: Target) {
  const { channelId } = pageChannel.channel;
  const control = anchor.elSubscribe && readSubscribeControl({
    elSubscribe: anchor.elSubscribe,
    channelId
  });
  const liveSubscription = control?.isLive ? control.isSubscribed : undefined;
  if (liveSubscription !== undefined) {
    return liveSubscription;
  }

  const knownSubscription = getObservedOfficialSubscription(channelId) ?? pageChannel.officialSubscription;
  return knownSubscription ?? control?.isSubscribed ?? false;
}

function mountButton(target: Target) {
  const { anchor, pageChannel } = target;
  const elParent = anchor.elReference.parentElement;
  if (!elParent) {
    return null;
  }

  const props = $state({
    channel: pageChannel.channel,
    site: getYouTubeSite(),
    placement: anchor.placement,
    wrapperClass: anchor.wrapperClass,
    scopingClass: anchor.scopingClass,
    nativeButtonClasses: buildNativeButtonClasses(anchor.nativeButtonClass),
    isOfficiallySubscribed: readIsOfficiallySubscribed(target)
  });
  const component = mount(SemiSubButton, {
    target: elParent,
    anchor: anchor.elReference.nextSibling ?? undefined,
    props
  });

  const controlObserver = new MutationObserver(sync);
  if (anchor.elSubscribe) {
    controlObserver.observe(anchor.elSubscribe, SUBSCRIBE_CONTROL_MUTATIONS);
  }

  function sync() {
    props.isOfficiallySubscribed = readIsOfficiallySubscribed(target);
  }

  return {
    target,
    sync,
    /** False once YouTube re-rendered the row or swapped its Subscribe control - then it is mounted afresh */
    isAttached() {
      const isControlAttached = anchor.elSubscribe?.isConnected ?? true;
      return component.isConnected() && anchor.elReference.isConnected && isControlAttached;
    },
    destroy() {
      controlObserver.disconnect();
      unmount(component).catch(() => {});
    }
  };
}

type MountedButton = NonNullable<ReturnType<typeof mountButton>>;

/** Mounts the button once the page's anchor renders, and re-mounts it if YouTube re-renders the row it sits in */
function trackPage(kind: PageKind) {
  let mounted: MountedButton | null = null;
  let mountCount = 0;
  let isCheckScheduled = false;
  let isStopped = false;
  const bodyObserver = new MutationObserver(scheduleCheck);
  const stopWatchingObservedChanges = onObservedOfficialSubscriptionChange(() => mounted?.sync());

  function stop() {
    isStopped = true;
    bodyObserver.disconnect();
    mounted?.destroy();
    mounted = null;
    stopWatchingObservedChanges();
    document.removeEventListener(SUBSCRIPTION_CHANGED_EVENT, handleSubscriptionChanged, true);
  }

  function check() {
    isCheckScheduled = false;
    const isUpToDate = isStopped || !!mounted?.isAttached();
    if (isUpToDate) {
      return;
    }

    mounted?.destroy();
    mounted = null;
    const resolution = resolveTarget(kind);
    const isOutOfMounts = mountCount >= MAX_MOUNTS_PER_PAGE;
    const isSettledWithoutButton = resolution === Unresolved.noButton || isOutOfMounts;
    if (isSettledWithoutButton) {
      stop();
      return;
    }

    if (resolution !== Unresolved.pending) {
      mountCount++;
      mounted = mountButton(resolution);
    }
  }

  function scheduleCheck() {
    if (isCheckScheduled) {
      return;
    }

    isCheckScheduled = true;
    requestAnimationFrame(check);
  }

  // YouTube flips its own button the moment Subscribe is pressed, before the request completes
  function handleSubscriptionChanged(e: Event) {
    const parsed = subscriptionChangedDetailSchema.safeParse(e instanceof CustomEvent ? e.detail : undefined);
    const isFromThisChannelsControl = !!mounted && e.target instanceof Node
      && mounted.target.anchor.elContainer.contains(e.target);
    if (!parsed.success || !mounted || !isFromThisChannelsControl) {
      return;
    }

    setObservedOfficialSubscription({
      channelId: mounted.target.pageChannel.channel.channelId,
      isSubscribed: parsed.data
    });
  }

  document.addEventListener(SUBSCRIPTION_CHANGED_EVENT, handleSubscriptionChanged, true);
  bodyObserver.observe(document.body, CHILD_LIST_SUBTREE);
  check();
  return stop;
}

function whenBodyReady(callback: () => void) {
  if (document.body) {
    callback();
    return;
  }

  document.addEventListener("DOMContentLoaded", callback, { once: true });
}

export function startChannelButton() {
  let stopCurrentPage: (() => void) | null = null;

  function handlePage() {
    stopCurrentPage?.();
    stopCurrentPage = null;
    const kind = getPageKind(location.pathname);
    if (kind) {
      stopCurrentPage = trackPage(kind);
    }
  }

  whenBodyReady(() => {
    handlePage();
    onYouTubeNavigate(handlePage);
  });
}
