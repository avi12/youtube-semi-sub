import { startBackground } from "./index";
import { getAiFilterKey } from "@/lib/filter/ai-filter-key";
import { type AiFilter, DEFAULT_TITLE_FILTER, FilterKind } from "@/lib/filter/title-filter";
import type { SemiSubscription } from "@/lib/schemas/semi-subscription";
import { aiVerdictsItem, channelCheckedAtItem, channelVideosItem, semiSubscriptionsItem } from "@/lib/storage";
import rssFeedXml from "#background/fixtures/rss-feed.xml?raw";
import { browser } from "#imports";
import {
  beforeAll,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

const CHANNEL_ID = "UCBJycsmduvYEL83R_U4JriQ";
const REFRESH_ALARM_NAME = "refresh-channels";

const SUBSCRIPTION: SemiSubscription = {
  channelId: CHANNEL_ID,
  title: "Marques Brownlee",
  followFilter: {
    kind: FilterKind.regex,
    pattern: "",
    flags: "i"
  },
  createdAt: 0,
  hideFilter: DEFAULT_TITLE_FILTER,
  isSubscribed: false
};

describe("startBackground", () => {
  beforeAll(() => {
    fakeBrowser.reset();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => new Response(rssFeedXml)));
    startBackground();
  });

  it("schedules the periodic refresh", async () => {
    await vi.waitFor(async () => {
      expect(await browser.alarms.get(REFRESH_ALARM_NAME)).toMatchObject({
        periodInMinutes: 15
      });
    });
  });

  it("fetches a channel as soon as it is semi-subscribed, and prunes it once removed", async () => {
    await semiSubscriptionsItem.setValue({
      [CHANNEL_ID]: SUBSCRIPTION
    });
    await vi.waitFor(async () => {
      expect((await channelVideosItem.getValue())[CHANNEL_ID]?.videos).toHaveLength(4);
    });

    await semiSubscriptionsItem.setValue({});
    await vi.waitFor(async () => {
      expect(await channelVideosItem.getValue()).toEqual({});
    });
  });

  it("refetches a dropped cache on update before pruning, so its AI verdicts survive", async () => {
    const filter: AiFilter = {
      kind: FilterKind.aiMatch,
      description: "Only reviews"
    };
    const verdicts = {
      [getAiFilterKey(filter)]: {
        QVv3mQzlrN0: true
      }
    };
    await semiSubscriptionsItem.setValue({
      [CHANNEL_ID]: {
        ...SUBSCRIPTION,
        followFilter: filter
      }
    });
    await vi.waitFor(async () => {
      expect((await channelVideosItem.getValue())[CHANNEL_ID]?.videos).toHaveLength(4);
    });
    // What an update's cache migration leaves behind
    await Promise.all([
      channelVideosItem.setValue({}),
      channelCheckedAtItem.setValue({}),
      aiVerdictsItem.setValue(verdicts)
    ]);

    await fakeBrowser.runtime.onInstalled.trigger({
      reason: "update",
      previousVersion: "0.1.0"
    });
    await vi.waitFor(async () => {
      expect((await channelCheckedAtItem.getValue())[CHANNEL_ID]).toBeDefined();
    });
    await vi.waitFor(async () => {
      expect((await channelVideosItem.getValue())[CHANNEL_ID]?.videos).toHaveLength(4);
    });
    expect(await aiVerdictsItem.getValue()).toEqual(verdicts);
  });
});
