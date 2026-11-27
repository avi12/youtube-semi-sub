import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { readIsSignedIn } from "#channel-button/page/page-data-source";

import { applySubscriptionSnapshot } from "./official-subscription";
import { installSubscriptionEntityWatch, syncSubscriptionEntities } from "./subscription-entities";

vi.mock("./official-subscription", () => ({
  applySubscriptionSnapshot: vi.fn()
}));

vi.mock("#channel-button/page/page-data-source", () => ({
  readIsSignedIn: vi.fn(() => true)
}));

const MKBHD_ID = "UCBJycsmduvYEL83R_U4JriQ";
const RICK_ASTLEY_ID = "UCuAXFkgsw1L7xaCfnd5JJOw";
const UNMENTIONED_ID = "UCX6OQ3DkcsbYNE6H8uQQuVA";
const BROWSE_URL = "https://www.youtube.com/youtubei/v1/browse?prettyPrint=false";
const GUIDE_URL = "https://www.youtube.com/youtubei/v1/guide?prettyPrint=false";

const RESPONSE_WITH_ENTITIES = {
  contents: {},
  frameworkUpdates: {
    entityBatchUpdate: {
      mutations: [
        {
          payload: {
            subscriptionStateEntity: {
              key: "EhhVQ0JKeWNzbWR1dllFTDgzUl9VNEpyaVEgMygB",
              subscribed: true
            }
          }
        },
        {
          payload: {
            subscriptionStateEntity: {
              key: "EhhVQ3VBWEZrZ3N3MUw3eGFDZm5kNUpKT3cgMygB",
              subscribed: false
            }
          }
        }
      ]
    }
  }
};

function responseAt({ url, body }: { url: string; body: unknown }) {
  const response = new Response(JSON.stringify(body));
  Object.defineProperty(response, "url", { value: url });
  return response;
}

function readAppliedSnapshot() {
  const readIsSubscribed = vi.mocked(applySubscriptionSnapshot).mock.calls[0]?.[0];
  return [MKBHD_ID, RICK_ASTLEY_ID, UNMENTIONED_ID].map(channelId => readIsSubscribed?.(channelId));
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("syncSubscriptionEntities", () => {
  it("applies the subscription state of every channel the data mentions, and only those", () => {
    syncSubscriptionEntities(RESPONSE_WITH_ENTITIES);
    expect(readAppliedSnapshot()).toEqual([true, false, undefined]);
  });

  it("says nothing signed out", () => {
    vi.mocked(readIsSignedIn).mockReturnValueOnce(false);
    syncSubscriptionEntities(RESPONSE_WITH_ENTITIES);
    expect(applySubscriptionSnapshot).not.toHaveBeenCalled();
  });

  it("says nothing for data without subscription entities", () => {
    syncSubscriptionEntities({
      contents: {}
    });
    syncSubscriptionEntities(null);
    expect(applySubscriptionSnapshot).not.toHaveBeenCalled();
  });
});

describe("installSubscriptionEntityWatch", () => {
  beforeAll(() => {
    installSubscriptionEntityWatch();
  });

  it("reads a /browse body without changing it, whether read with text() or json()", async () => {
    const text = await responseAt({
      url: BROWSE_URL,
      body: RESPONSE_WITH_ENTITIES
    }).text();
    expect(JSON.parse(text)).toEqual(RESPONSE_WITH_ENTITIES);
    expect(readAppliedSnapshot()).toEqual([true, false, undefined]);

    vi.clearAllMocks();
    const json: unknown = await responseAt({
      url: BROWSE_URL,
      body: RESPONSE_WITH_ENTITIES
    }).json();
    expect(json).toEqual(RESPONSE_WITH_ENTITIES);
    expect(readAppliedSnapshot()).toEqual([true, false, undefined]);
  });

  it("leaves every other response alone", async () => {
    await responseAt({
      url: GUIDE_URL,
      body: RESPONSE_WITH_ENTITIES
    }).text();
    expect(applySubscriptionSnapshot).not.toHaveBeenCalled();
  });

  it("reads a hard load's ytInitialData as YouTube assigns it", () => {
    globalThis.ytInitialData = RESPONSE_WITH_ENTITIES;
    expect(globalThis.ytInitialData).toBe(RESPONSE_WITH_ENTITIES);
    expect(readAppliedSnapshot()).toEqual([true, false, undefined]);
  });

  it("reads m.youtube.com's JSON text assignment, handing it on as it came", () => {
    const text = JSON.stringify(RESPONSE_WITH_ENTITIES);
    globalThis.ytInitialData = text;
    expect(globalThis.ytInitialData).toBe(text);
    expect(readAppliedSnapshot()).toEqual([true, false, undefined]);
  });
});
