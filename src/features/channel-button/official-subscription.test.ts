import { getObservedOfficialSubscription, installSubscriptionWatch } from "./official-subscription";
import { PageMessage, pageMessenger } from "@/lib/messaging/page-messaging";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

vi.mock("@/lib/messaging/page-messaging", () => ({
  PageMessage: {
    officialSubscriptionChanged: "officialSubscriptionChanged"
  },
  pageMessenger: {
    sendMessage: vi.fn(() => Promise.resolve())
  }
}));

const SUBSCRIBE_URL = "/youtubei/v1/subscription/subscribe?prettyPrint=false";
const UNSUBSCRIBE_URL = "https://www.youtube.com/youtubei/v1/subscription/unsubscribe?prettyPrint=false";
const CHANNEL_ID = "UCBJycsmduvYEL83R_U4JriQ";
const OTHER_CHANNEL_ID = "UCuAXFkgsw1L7xaCfnd5JJOw";
const HTTP_FORBIDDEN = 403;

function buildBody(channelIds: string[]) {
  return JSON.stringify({
    context: {},
    channelIds,
    params: "EgIIAhgA"
  });
}

async function flushReports() {
  await new Promise(resolve => setTimeout(resolve, 0));
}

describe("installSubscriptionWatch", () => {
  const previousFetch = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => Promise.resolve(new Response("{}")));

  beforeEach(() => {
    vi.stubGlobal("location", { origin: "https://www.youtube.com" });
    vi.stubGlobal("fetch", previousFetch);
    installSubscriptionWatch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("hands every other request to the previous fetch and returns its exact promise", () => {
    const response = Promise.resolve(new Response("feed"));
    previousFetch.mockReturnValueOnce(response);
    const init = { method: "POST" };
    expect(fetch("/youtubei/v1/browse", init)).toBe(response);
    expect(previousFetch).toHaveBeenCalledWith("/youtubei/v1/browse", init);
  });

  it("reports a successful Subscribe without touching the response body", async () => {
    const response = await fetch(SUBSCRIBE_URL, {
      method: "POST",
      body: buildBody([CHANNEL_ID])
    });
    await flushReports();
    expect(response.bodyUsed).toBe(false);
    expect(getObservedOfficialSubscription(CHANNEL_ID)).toBe(true);
    expect(pageMessenger.sendMessage).toHaveBeenCalledWith(PageMessage.officialSubscriptionChanged, {
      channelId: CHANNEL_ID,
      isSubscribed: true
    });
  });

  it("reads the channel ids of an Unsubscribe sent as a Request", async () => {
    await fetch(
      new Request(UNSUBSCRIBE_URL, {
        method: "POST",
        body: buildBody([OTHER_CHANNEL_ID])
      })
    );
    await flushReports();
    expect(getObservedOfficialSubscription(OTHER_CHANNEL_ID)).toBe(false);
    expect(pageMessenger.sendMessage).toHaveBeenCalledWith(PageMessage.officialSubscriptionChanged, {
      channelId: OTHER_CHANNEL_ID,
      isSubscribed: false
    });
  });

  it("ignores a failed request", async () => {
    previousFetch.mockResolvedValueOnce(new Response("{}", { status: HTTP_FORBIDDEN }));
    await fetch(UNSUBSCRIBE_URL, {
      method: "POST",
      body: buildBody([CHANNEL_ID])
    });
    await flushReports();
    expect(pageMessenger.sendMessage).not.toHaveBeenCalled();
  });

  it("ignores a body without channel ids", async () => {
    await fetch(SUBSCRIBE_URL, {
      method: "POST",
      body: "not json"
    });
    await flushReports();
    expect(pageMessenger.sendMessage).not.toHaveBeenCalled();
  });
});
