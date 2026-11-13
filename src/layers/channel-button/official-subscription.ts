import { type OfficialSubscriptionChange, PageMessage, pageMessenger } from "@/lib/messaging/page-messaging";
import { whenPageStateKnown } from "@/lib/page/page-state";
import { channelIdSchema } from "@/lib/schemas/channel";
import { parseJson } from "@/lib/utils/json";
import { InnerTubePath } from "@/lib/youtube/site";
import { z } from "@/lib/zod";

// MAIN world: what this tab saw the user do with YouTube's own Subscribe button, newest first in line

const SUBSCRIPTION_ENDPOINT_PATHS: ReadonlySet<string> = new Set([InnerTubePath.subscribe, InnerTubePath.unsubscribe]);

const subscriptionRequestSchema = z.looseObject({
  channelIds: z.array(channelIdSchema).min(1)
});

const subscribedByChannel = new Map<string, boolean>();
const listeners = new Set<() => void>();
const MAX_KEPT_SNAPSHOTS = 20;
/** The server snapshots this tab read, newest first - they name channels the user never semi-subscribed to as well */
const snapshotReaders: ((channelId: string) => boolean | undefined)[] = [];

/** The latest official subscription state this tab saw change, or undefined when it saw none */
export function getObservedOfficialSubscription(channelId: string) {
  return subscribedByChannel.get(channelId);
}

/**
 * Whether the user is subscribed to a channel on YouTube, as far as this tab knows: what it saw the user do, else the
 * newest snapshot that names the channel; undefined when none does
 */
export function readOfficialSubscription(channelId: string) {
  const observed = subscribedByChannel.get(channelId);
  if (observed !== undefined) {
    return observed;
  }

  for (const readIsSubscribed of snapshotReaders) {
    const isSubscribed = readIsSubscribed(channelId);
    if (isSubscribed !== undefined) {
      return isSubscribed;
    }
  }
  return undefined;
}

export function setObservedOfficialSubscription({ channelId, isSubscribed }: OfficialSubscriptionChange) {
  const isUnchanged = subscribedByChannel.get(channelId) === isSubscribed;
  if (isUnchanged) {
    return;
  }

  subscribedByChannel.set(channelId, isSubscribed);
  for (const listener of listeners) {
    listener();
  }
}

export function onObservedOfficialSubscriptionChange(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The bridge switches the channel's semi-subscription to hiding on a subscribe, and to following on an unsubscribe */
function reportOfficialSubscription(change: OfficialSubscriptionChange) {
  pageMessenger.sendMessage(PageMessage.officialSubscriptionChanged, change).catch(() => {});
}

/**
 * Lines the stored subscription states up with a server snapshot of the user's official subscriptions (the guide, a
 * channel or watch page), so subscribing or unsubscribing elsewhere - another device, the app - switches modes too. A
 * snapshot is applied once, as soon as the extension state is known, never again on later state changes - so tabs
 * holding snapshots of different ages can't flip a channel back and forth. What this tab saw the user do outranks any
 * snapshot
 */
export function applySubscriptionSnapshot(readIsSubscribed: (channelId: string) => boolean | undefined) {
  snapshotReaders.unshift(readIsSubscribed);
  snapshotReaders.splice(MAX_KEPT_SNAPSHOTS);
  whenPageStateKnown(({ subscriptions }) => {
    for (const { channelId, isSubscribed: isStoredSubscribed } of Object.values(subscriptions)) {
      const isSubscribed = readIsSubscribed(channelId);
      const isSeenInThisTab = subscribedByChannel.has(channelId);
      if (isSubscribed === undefined || isSubscribed === isStoredSubscribed || isSeenInThisTab) {
        continue;
      }

      reportOfficialSubscription({
        channelId,
        isSubscribed
      });
    }
  });
}

function getRequestUrl(input: RequestInfo | URL) {
  if (input instanceof Request) {
    return input.url;
  }

  return input instanceof URL ? input.href : input;
}

function getSubscriptionEndpointPath(input: RequestInfo | URL) {
  try {
    const { pathname } = new URL(getRequestUrl(input), location.origin);
    return SUBSCRIPTION_ENDPOINT_PATHS.has(pathname) ? pathname : null;
  } catch {
    // Left for fetch itself to reject
    return null;
  }
}

/** Must run before the request is handed on - fetch consumes a Request's body */
function readRequestBody({ input, init }: { input: RequestInfo | URL; init: RequestInit | undefined }) {
  const body = init?.body;
  if (typeof body === "string") {
    return Promise.resolve(body);
  }

  const isBodyInRequest = input instanceof Request && body === undefined;
  if (isBodyInRequest) {
    return input.clone().text();
  }

  return Promise.resolve(null);
}

async function reportSubscriptionRequest({
  endpointPath,
  requestBody,
  response
}: {
  endpointPath: string;
  requestBody: Promise<string | null>;
  response: Promise<Response>;
}) {
  const { ok: isSuccessful } = await response;
  if (!isSuccessful) {
    return;
  }

  const requestText = await requestBody;
  if (requestText === null) {
    return;
  }

  const parsed = subscriptionRequestSchema.safeParse(parseJson(requestText));
  if (!parsed.success) {
    return;
  }

  const isSubscribed = endpointPath === InnerTubePath.subscribe;
  for (const channelId of parsed.data.channelIds) {
    const change: OfficialSubscriptionChange = {
      channelId,
      isSubscribed
    };
    setObservedOfficialSubscription(change);
    reportOfficialSubscription(change);
  }
}

/** Wraps fetch transparently: every call goes to the previous fetch untouched and gets its exact promise back */
export function installSubscriptionWatch() {
  const previousFetch = globalThis.fetch;

  globalThis.fetch = function watchedFetch(input: RequestInfo | URL, init?: RequestInit) {
    const endpointPath = getSubscriptionEndpointPath(input);
    if (!endpointPath) {
      return previousFetch(input, init);
    }

    const requestBody = readRequestBody({
      input,
      init
    }).catch(() => null);
    const response = previousFetch(input, init);
    reportSubscriptionRequest({
      endpointPath,
      requestBody,
      response
    }).catch(() => {});
    return response;
  };
}
