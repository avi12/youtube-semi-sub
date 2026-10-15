import {
  applySubscriptionSnapshot,
  getObservedOfficialSubscription,
  installSubscriptionWatch,
  setObservedOfficialSubscription
} from "./official-subscription";
import { FilterKind } from "@/lib/filter/title-filter";
import { PageMessage, pageMessenger, type PageState } from "@/lib/messaging/page-messaging";
import type { SemiSubscription } from "@/lib/schemas/semi-subscription";
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

const pageStateListeners: ((state: PageState) => void)[] = [];

vi.mock("@/lib/page/page-state", () => ({
  whenPageStateKnown: (listener: (state: PageState) => void) => pageStateListeners.push(listener)
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

describe("applySubscriptionSnapshot", () => {
  const ACTIVE_CHANNEL_ID = "UCX6OQ3DkcsbYNE6H8uQQuVA";
  const HALTED_CHANNEL_ID = "UCBR8-60-B28hp2BmDPdntcQ";
  const UNMENTIONED_CHANNEL_ID = "UC4REwc30LXHzKSkpqSwhR-Q";
  const OBSERVED_CHANNEL_ID = "UCjkyfFH-MWZhasolgds05EA";

  function buildSubscription({ channelId, isHalted }: Pick<SemiSubscription, "channelId" | "isHalted">) {
    const subscription: SemiSubscription = {
      channelId,
      title: channelId,
      filter: {
        kind: FilterKind.regex,
        pattern: "",
        flags: "i"
      },
      createdAt: 1,
      isHalted
    };
    return subscription;
  }

  function deliverPageState(subscriptions: SemiSubscription[]) {
    const state: PageState = {
      isExtensionEnabled: true,
      isAnimationsEnabled: true,
      isAiEnabled: false,
      aiVerdicts: {},
      subscriptions: Object.fromEntries(subscriptions.map(subscription => [subscription.channelId, subscription])),
      feedVideos: []
    };
    for (const listener of pageStateListeners.splice(0)) {
      listener(state);
    }
  }

  afterEach(() => {
    pageStateListeners.length = 0;
    vi.clearAllMocks();
  });

  it("halts what the snapshot shows subscribed and resumes what it shows unsubscribed, once the state is known", () => {
    const snapshot = new Map([[ACTIVE_CHANNEL_ID, true], [HALTED_CHANNEL_ID, false]]);
    applySubscriptionSnapshot(channelId => snapshot.get(channelId));
    expect(pageMessenger.sendMessage).not.toHaveBeenCalled();

    deliverPageState([
      buildSubscription({
        channelId: ACTIVE_CHANNEL_ID,
        isHalted: false
      }),
      buildSubscription({
        channelId: HALTED_CHANNEL_ID,
        isHalted: true
      }),
      buildSubscription({
        channelId: UNMENTIONED_CHANNEL_ID,
        isHalted: true
      })
    ]);
    expect(pageMessenger.sendMessage).toHaveBeenCalledTimes(2);
    expect(pageMessenger.sendMessage).toHaveBeenCalledWith(PageMessage.officialSubscriptionChanged, {
      channelId: ACTIVE_CHANNEL_ID,
      isSubscribed: true
    });
    expect(pageMessenger.sendMessage).toHaveBeenCalledWith(PageMessage.officialSubscriptionChanged, {
      channelId: HALTED_CHANNEL_ID,
      isSubscribed: false
    });
  });

  it("leaves channels that already match, and those this tab saw the user subscribe to or leave", () => {
    setObservedOfficialSubscription({
      channelId: OBSERVED_CHANNEL_ID,
      isSubscribed: false
    });
    applySubscriptionSnapshot(() => true);
    deliverPageState([
      buildSubscription({
        channelId: HALTED_CHANNEL_ID,
        isHalted: true
      }),
      buildSubscription({
        channelId: OBSERVED_CHANNEL_ID,
        isHalted: false
      })
    ]);
    expect(pageMessenger.sendMessage).not.toHaveBeenCalled();
  });
});
