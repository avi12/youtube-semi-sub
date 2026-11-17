import { mount, unmount } from "svelte";

import { buildNativeButtonClasses } from "#channel-button/button/native-button-classes";
import SemiSubButton from "#channel-button/button/SemiSubButton.svelte";
import {
  type PageChannel,
  pageChannelSchema,
  PageKind,
  readPageChannelByContent
} from "#channel-button/page/channel-page-data";
import {
  findPageAnchor,
  pageAnchorSchema,
  readSubscribeControl,
  SUBSCRIBED_ATTRIBUTE
} from "#channel-button/page/page-anchor";
import { readIsSignedIn, readPageData, readUrlVideoId } from "#channel-button/page/page-data-source";
import { createFrameScheduler, SUBTREE_CHILD_LIST, whenDocumentParsed } from "@/lib/utils/dom";
import { onYouTubeNavigate } from "@/lib/youtube/page/navigation";
import { getYouTubeSite } from "@/lib/youtube/site";
import { z } from "@/lib/zod";

import {
  getObservedOfficialSubscription,
  onObservedOfficialSubscriptionChange,
  setObservedOfficialSubscription
} from "./official-subscription";

// MAIN world: keeps one channel button - "Semi-subscribe", in either mode - next to YouTube's own Subscribe
// button, across SPA navigations

/** YouTube may re-render the row it sits in; past this many re-mounts on one page, it gives up instead of fighting */
const MAX_MOUNTS_PER_PAGE = 8;
const SUBSCRIPTION_CHANGED_EVENT = "yt-subscription-changed";
const SUBSCRIBE_CONTROL_MUTATIONS: MutationObserverInit = {
  subtree: true,
  attributes: true,
  attributeFilter: [SUBSCRIBED_ATTRIBUTE, "class"]
};

/** Why there is no target yet: the page is still rendering, or the page gets no button at all */
enum Unresolved {
  PENDING = "pending",
  NO_BUTTON = "no-button"
}

const subscriptionChangedDetailSchema = z.boolean();

const targetSchema = z.object({
  pageChannel: pageChannelSchema,
  anchor: pageAnchorSchema
});
type Target = z.infer<typeof targetSchema>;

let cachedPageData: unknown = null;
let cachedPageChannel: PageChannel | null = null;

function readPageChannelOnce(pageData: unknown) {
  const isCached = pageData === cachedPageData;
  if (isCached) {
    return cachedPageChannel;
  }

  cachedPageData = pageData;
  cachedPageChannel = readPageChannelByContent(pageData);
  return cachedPageChannel;
}

function resolveTarget() {
  const pageChannel = readPageChannelOnce(readPageData());
  if (!pageChannel) {
    return Unresolved.PENDING;
  }

  const { kind } = pageChannel;
  const urlVideoId = readUrlVideoId();
  const isStaleWatchData =
    kind === PageKind.WATCH && !!urlVideoId && !!pageChannel.videoId && pageChannel.videoId !== urlVideoId;
  if (isStaleWatchData) {
    return Unresolved.PENDING;
  }

  const isSignedIn = readIsSignedIn();
  const isViewersOwnChannel = pageChannel.isOwnedByViewer || (isSignedIn && !pageChannel.hasSubscribeControl);
  if (isViewersOwnChannel) {
    return Unresolved.NO_BUTTON;
  }

  const anchor = findPageAnchor({
    kind,
    isSignedIn
  });
  const isControlForOtherChannel =
    !!anchor?.elSubscribe &&
    !readSubscribeControl({
      elSubscribe: anchor.elSubscribe,
      channelId: pageChannel.channel.channelId,
      isCollaboration: pageChannel.collaborators.length > 0
    }).isForChannel;
  if (!anchor || isControlForOtherChannel) {
    return Unresolved.PENDING;
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
  const control =
    anchor.elSubscribe &&
    readSubscribeControl({
      elSubscribe: anchor.elSubscribe,
      channelId,
      isCollaboration: pageChannel.collaborators.length > 0
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
    collaborators: pageChannel.collaborators,
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
function trackPage() {
  let mounted: MountedButton | null = null;
  let mountCount = 0;
  let isStopped = false;
  const scheduleCheck = createFrameScheduler(check);
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
    const isUpToDate = isStopped || !!mounted?.isAttached();
    if (isUpToDate) {
      return;
    }

    mounted?.destroy();
    mounted = null;
    const resolution = resolveTarget();
    const isOutOfMounts = mountCount >= MAX_MOUNTS_PER_PAGE;
    const isSettledWithoutButton = resolution === Unresolved.NO_BUTTON || isOutOfMounts;
    if (isSettledWithoutButton) {
      stop();
      return;
    }

    if (resolution !== Unresolved.PENDING) {
      mountCount++;
      mounted = mountButton(resolution);
    }
  }

  // YouTube flips its own button the moment Subscribe is pressed, before the request completes
  function handleSubscriptionChanged(event: Event) {
    const parsed = subscriptionChangedDetailSchema.safeParse(event instanceof CustomEvent ? event.detail : undefined);
    const isFromThisChannelsControl =
      !!mounted && event.target instanceof Node && mounted.target.anchor.elContainer.contains(event.target);
    if (!parsed.success || !mounted || !isFromThisChannelsControl) {
      return;
    }

    setObservedOfficialSubscription({
      channelId: mounted.target.pageChannel.channel.channelId,
      isSubscribed: parsed.data
    });
  }

  document.addEventListener(SUBSCRIPTION_CHANGED_EVENT, handleSubscriptionChanged, true);
  bodyObserver.observe(document.body, SUBTREE_CHILD_LIST);
  check();
  return stop;
}

export function startChannelButton() {
  let stopCurrentPage: (() => void) | null = null;

  function handlePage() {
    stopCurrentPage?.();
    stopCurrentPage = null;
    stopCurrentPage = trackPage();
  }

  whenDocumentParsed()
    .then(() => {
      handlePage();
      onYouTubeNavigate(handlePage);
    })
    .catch(console.error);
}
