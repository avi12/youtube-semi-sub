import { pruneChannelCaches, refreshChannel, refreshChannels } from "./channel-cache";
import { getAiFilterKey } from "@/lib/filter/ai-filter-key";
import { type AiFilter, DEFAULT_TITLE_FILTER, FilterKind } from "@/lib/filter/title-filter";
import type { SemiSubscriptions } from "@/lib/schemas/semi-subscription";
import { aiVerdictsItem, channelVideosItem, semiSubscriptionsItem } from "@/lib/storage";
import channelVideosPageHtml from "#background/fixtures/channel-videos-page.html?raw";
import rssFeedXml from "#background/fixtures/rss-feed.xml?raw";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

const CHANNEL_ID = "UCBJycsmduvYEL83R_U4JriQ";
const OTHER_CHANNEL_ID = "UCXuqSBlHAE6Xw-yeJA0Tunw";
const RSS_PATH = "/feeds/videos.xml";
const NOT_FOUND_STATUS = 404;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const fetchMock = vi.fn<typeof fetch>();

function respondWith({ rss, videosTab }: {
  rss: string | null;
  videosTab: string | null;
}) {
  fetchMock.mockImplementation(async input => {
    const url = new URL(input instanceof Request ? input.url : input);
    const body = url.pathname === RSS_PATH ? rss : videosTab;
    return body === null
      ? new Response(null, {
        status: NOT_FOUND_STATUS
      })
      : new Response(body);
  });
}

function createSubscriptions(channelIds: string[]) {
  const subscriptions: SemiSubscriptions = {};
  for (const channelId of channelIds) {
    subscriptions[channelId] = {
      channelId,
      title: "Channel",
      followFilter: {
        kind: FilterKind.regex,
        pattern: "",
        flags: "i"
      },
      createdAt: 0,
      hideFilter: DEFAULT_TITLE_FILTER,
      isSubscribed: false
    };
  }
  return subscriptions;
}

beforeEach(() => {
  fakeBrowser.reset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.useFakeTimers({
    toFake: ["Date"]
  });
  respondWith({
    rss: rssFeedXml,
    videosTab: channelVideosPageHtml
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("refreshChannels", () => {
  it("caches a semi-subscribed channel's uploads from RSS", async () => {
    await semiSubscriptionsItem.setValue(createSubscriptions([CHANNEL_ID]));
    expect(
      await refreshChannels({
        channelIds: [CHANNEL_ID],
        isForced: false
      })
    ).toBe(true);

    const cache = await channelVideosItem.getValue();
    expect(cache[CHANNEL_ID]?.videos.map(video => video.videoId)).toEqual(["QVv3mQzlrN0", "_0G4OG39XjI", "3iRUwVzRDZQ", "R6yNUnRXZ64"]);
    expect(cache[CHANNEL_ID]?.fetchedAt).toBe(Date.now());
  });

  it("falls back to the Videos tab when RSS fails", async () => {
    respondWith({
      rss: null,
      videosTab: channelVideosPageHtml
    });
    await semiSubscriptionsItem.setValue(createSubscriptions([CHANNEL_ID]));
    await refreshChannels({
      channelIds: [CHANNEL_ID],
      isForced: false
    });

    const cache = await channelVideosItem.getValue();
    expect(cache[CHANNEL_ID]?.videos).toHaveLength(4);
  });

  it("resolves to false when nothing could be fetched", async () => {
    respondWith({
      rss: null,
      videosTab: null
    });
    await semiSubscriptionsItem.setValue(createSubscriptions([CHANNEL_ID]));
    expect(
      await refreshChannels({
        channelIds: [CHANNEL_ID],
        isForced: false
      })
    ).toBe(false);
    expect(await channelVideosItem.getValue()).toEqual({});
  });

  it("skips a recently fetched channel unless forced", async () => {
    await semiSubscriptionsItem.setValue(createSubscriptions([CHANNEL_ID]));
    await refreshChannels({
      channelIds: [CHANNEL_ID],
      isForced: false
    });
    await refreshChannels({
      channelIds: [CHANNEL_ID],
      isForced: false
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await refreshChannels({
      channelIds: [CHANNEL_ID],
      isForced: true
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.setSystemTime(Date.now() + REFRESH_INTERVAL_MS);
    await refreshChannels({
      channelIds: [CHANNEL_ID],
      isForced: false
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("leaves the cache untouched when nothing changed", async () => {
    await semiSubscriptionsItem.setValue(createSubscriptions([CHANNEL_ID]));
    await refreshChannels({
      channelIds: [CHANNEL_ID],
      isForced: false
    });
    const firstFetchedAt = Date.now();
    vi.setSystemTime(firstFetchedAt + REFRESH_INTERVAL_MS);
    const setValueSpy = vi.spyOn(channelVideosItem, "setValue");

    await refreshChannels({
      channelIds: [CHANNEL_ID],
      isForced: true
    });
    expect(setValueSpy).not.toHaveBeenCalled();
    expect((await channelVideosItem.getValue())[CHANNEL_ID]?.fetchedAt).toBe(firstFetchedAt);
  });

  it("never caches a channel that is not semi-subscribed", async () => {
    await refreshChannels({
      channelIds: [CHANNEL_ID],
      isForced: true
    });
    expect(await channelVideosItem.getValue()).toEqual({});
  });
});

describe("refreshChannel", () => {
  it("previews a channel that is not semi-subscribed without caching it", async () => {
    const videos = await refreshChannel(CHANNEL_ID);
    expect(videos).toHaveLength(4);
    expect(await channelVideosItem.getValue()).toEqual({});
  });

  it("serves the cache when a semi-subscribed channel can't be refetched", async () => {
    await semiSubscriptionsItem.setValue(createSubscriptions([CHANNEL_ID]));
    await refreshChannel(CHANNEL_ID);
    respondWith({
      rss: null,
      videosTab: null
    });
    expect(await refreshChannel(CHANNEL_ID)).toHaveLength(4);
  });

  it("rejects when there is neither a fetch nor a cache", async () => {
    respondWith({
      rss: null,
      videosTab: null
    });
    await expect(refreshChannel(CHANNEL_ID)).rejects.toThrow();
  });
});

describe("pruneChannelCaches", () => {
  it("drops channels that are no longer semi-subscribed", async () => {
    await semiSubscriptionsItem.setValue(createSubscriptions([CHANNEL_ID, OTHER_CHANNEL_ID]));
    await channelVideosItem.setValue({
      [CHANNEL_ID]: {
        fetchedAt: 1,
        videos: []
      },
      [OTHER_CHANNEL_ID]: {
        fetchedAt: 1,
        videos: []
      }
    });
    await semiSubscriptionsItem.setValue(createSubscriptions([CHANNEL_ID]));
    await pruneChannelCaches();

    expect(Object.keys(await channelVideosItem.getValue())).toEqual([CHANNEL_ID]);
  });

  it("drops AI verdicts of filters no longer in use and of videos no longer cached", async () => {
    const aiFilter: AiFilter = {
      kind: FilterKind.aiMatch,
      description: "only reviews"
    };
    const key = getAiFilterKey(aiFilter);
    await semiSubscriptionsItem.setValue({
      [CHANNEL_ID]: {
        channelId: CHANNEL_ID,
        title: "Channel",
        followFilter: aiFilter,
        createdAt: 0,
        hideFilter: DEFAULT_TITLE_FILTER,
        isSubscribed: false
      }
    });
    await refreshChannels({
      channelIds: [CHANNEL_ID],
      isForced: true
    });
    await aiVerdictsItem.setValue({
      [key]: {
        QVv3mQzlrN0: true,
        zzzzzzzzzzz: false
      },
      [getAiFilterKey({ description: "an old filter" })]: {
        QVv3mQzlrN0: true
      }
    });
    await pruneChannelCaches();

    expect(await aiVerdictsItem.getValue()).toEqual({
      [key]: {
        QVv3mQzlrN0: true
      }
    });
  });
});
