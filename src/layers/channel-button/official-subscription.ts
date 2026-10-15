import { PageMessage, pageMessenger } from "@/lib/messaging/page-messaging";
import { channelIdSchema } from "@/lib/schemas/channel";
import { parseJson } from "@/lib/utils/json";
import { z } from "@/lib/zod";

// MAIN world: what this tab saw the user do with YouTube's own Subscribe button, newest first in line

enum SubscriptionEndpointPath {
  subscribe = "/youtubei/v1/subscription/subscribe",
  unsubscribe = "/youtubei/v1/subscription/unsubscribe"
}

const SUBSCRIPTION_ENDPOINT_PATHS: ReadonlySet<string> = new Set(Object.values(SubscriptionEndpointPath));

const subscriptionRequestSchema = z.looseObject({
  channelIds: z.array(channelIdSchema).min(1)
});

const subscribedByChannel = new Map<string, boolean>();
const listeners = new Set<() => void>();

/** The latest official subscription state this tab saw change, or undefined when it saw none */
export function getObservedOfficialSubscription(channelId: string) {
  return subscribedByChannel.get(channelId);
}

export function setObservedOfficialSubscription({ channelId, isSubscribed }: {
  channelId: string;
  isSubscribed: boolean;
}) {
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
function readRequestBody({ input, init }: {
  input: RequestInfo | URL;
  init: RequestInit | undefined;
}) {
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

async function reportSubscriptionRequest({ endpointPath, requestBody, response }: {
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

  const isSubscribed = endpointPath === SubscriptionEndpointPath.subscribe;
  for (const channelId of parsed.data.channelIds) {
    setObservedOfficialSubscription({
      channelId,
      isSubscribed
    });
    pageMessenger.sendMessage(PageMessage.officialSubscriptionChanged, {
      channelId,
      isSubscribed
    }).catch(() => {});
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
