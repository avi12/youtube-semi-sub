import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { SEMI_SUBSCRIBED_TAG } from "#feed/compose/semi-subscribed-tag";
import { isSemiSubscribedItem } from "#feed/compose/semi-subscribed-tag";
import {
  CHANNEL_ID,
  channelShortsTabResponse,
  channelVideosTabResponse,
  contextRendererItem,
  continuationItem,
  desktopChannelTabLockup,
  desktopFeedItem,
  desktopFeedResponse,
  feedContinuationResponse,
  feedVideo,
  mobileFeedResponse,
  mobileShortsShelf,
  NOW,
  OTHER_CHANNEL_ID,
  richItem,
  shortsLockup,
  shortsShelf,
  videoId
} from "#feed/fixtures/feed-fixtures";
import {
  shelfItemsFromGridItem,
  shortsLockupFromItem,
  videoIdFromGridItem,
  videoIdFromShelfItem
} from "#feed/items/feed-items";
import { browseResponseSchema } from "#feed/items/feed-schemas";
import { getAiFilterKey } from "@/lib/filter/ai-filter-key";
import { type AiFilter, DEFAULT_TITLE_FILTER, FilterKind, type TitleFilter } from "@/lib/filter/title-filter";
import type { PageState } from "@/lib/messaging/page-messaging";
import type * as SiteNamespace from "@/lib/youtube/site";

import { readSubscriptionsContinuation, readSubscriptionsFeed } from "./feed-response";

const BROWSE_URL = "https://www.youtube.com/youtubei/v1/browse?prettyPrint=false";
const GUIDE_URL = "https://www.youtube.com/youtubei/v1/guide?prettyPrint=false";
const FEED_PAGE_URL = "https://www.youtube.com/feed/subscriptions";

const pageState: { current: PageState | null } = { current: null };
const site = { current: "desktop" };

vi.mock("@/lib/page/page-state", () => ({
  getPageState: () => pageState.current,
  onPageState: () => () => {}
}));

const SHORTS_TAB_PARAMS = "EgZzaG9ydHPyBgUKA5oBAA==";

vi.mock("@/lib/youtube/page/innertube", () => ({
  InnerTubeEndpoint: {
    browse: "/youtubei/v1/browse?prettyPrint=false"
  },
  postInnerTube: ({ payload }: { payload: { params?: string } }) =>
    Promise.resolve(
      payload.params === SHORTS_TAB_PARAMS
        ? channelShortsTabResponse([
            richItem({
              shortsLockupViewModel: shortsLockup({
                index: 60,
                views: "29M views",
                entityPrefix: "shorts-shelf-item-"
              })
            })
          ])
        : channelVideosTabResponse([richItem({ lockupViewModel: desktopChannelTabLockup(50) })])
    )
}));

vi.mock("@/lib/youtube/site", async importOriginal => ({
  ...(await importOriginal<typeof SiteNamespace>()),
  getYouTubeSite: () => site.current
}));

const originalJson = Response.prototype.json;
const originalText = Response.prototype.text;

function feedResponseBody() {
  return desktopFeedResponse([
    desktopFeedItem({
      index: 1,
      published: "1 hour ago"
    }),
    desktopFeedItem({
      index: 2,
      published: "5 hours ago"
    }),
    continuationItem()
  ]);
}

const YTAF_PRESENCE_GLOBAL = "__ytafFeedMessenger";
const YTAF_CONTRACT_VERSION_GLOBAL = "__ytafHonorsSemiSubTags";

function feedWithShortsShelf() {
  return desktopFeedResponse([
    desktopFeedItem({
      index: 1,
      published: "1 hour ago"
    }),
    shortsShelf([90]),
    desktopFeedItem({
      index: 2,
      published: "5 hours ago"
    }),
    continuationItem()
  ]);
}

function responseAt({ url, body }: { url: string; body: string }) {
  const response = new Response(body);
  Object.defineProperty(response, "url", { value: url });
  return response;
}

function desktopFeedResponseGrid(data: unknown) {
  const parsed = browseResponseSchema.safeParse(data);
  return parsed.success
    ? parsed.data.contents.twoColumnBrowseResultsRenderer?.tabs[0]?.tabRenderer?.content?.richGridRenderer
    : undefined;
}

function feedIds(data: unknown) {
  const contents = readSubscriptionsFeed(data)?.contents ?? [];
  return contents.map(videoIdFromGridItem);
}

function shelfItems(data: unknown) {
  const contents = readSubscriptionsFeed(data)?.contents ?? [];
  return contents.flatMap(shelfItemsFromGridItem);
}

async function readFeedWithShelf() {
  return await responseAt({
    url: BROWSE_URL,
    body: JSON.stringify(feedWithShortsShelf())
  }).json();
}

beforeAll(async () => {
  // Only Date: the hook's deadlines still run on real timers
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  const { installResponseHooks } = await import("./response-hook");
  installResponseHooks();
});

afterAll(() => {
  Response.prototype.json = originalJson;
  Response.prototype.text = originalText;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.stubGlobal("document", {
    documentElement: {
      lang: "en"
    }
  });
  pageState.current = {
    isExtensionEnabled: true,
    isAnimationsEnabled: true,
    isAiEnabled: false,
    aiVerdicts: {},
    subscriptions: {
      [CHANNEL_ID]: {
        channelId: CHANNEL_ID,
        title: "Semi Channel",
        followFilter: DEFAULT_TITLE_FILTER,
        hideFilter: null,
        createdAt: 0,
        isSubscribed: false
      }
    },
    hiddenVideoIds: [],
    followedUploads: [
      feedVideo({
        index: 50,
        hours: 3,
        channelId: CHANNEL_ID
      }),
      feedVideo({
        index: 60,
        hours: 2,
        channelId: CHANNEL_ID,
        isShort: true
      })
    ]
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  site.current = "desktop";
});

function laterPageWithShortsShelf() {
  return feedContinuationResponse([
    contextRendererItem({
      index: 3,
      published: "1 day ago"
    }),
    mobileShortsShelf([90]),
    contextRendererItem({
      index: 4,
      published: "2 days ago"
    }),
    continuationItem()
  ]);
}

/** A feed load starts from its first page - here one without a Shorts shelf */
async function readFirstPageWithoutShelf() {
  await responseAt({
    url: BROWSE_URL,
    body: JSON.stringify(mobileFeedResponse([continuationItem()]))
  }).json();
}

async function readLaterPage() {
  const data = await responseAt({
    url: BROWSE_URL,
    body: JSON.stringify(laterPageWithShortsShelf())
  }).json();
  const contents = readSubscriptionsContinuation(data)?.contents ?? [];
  return {
    data,
    shelfIds: contents.flatMap(shelfItemsFromGridItem).map(videoIdFromShelfItem),
    rootIds: contents.map(videoIdFromGridItem)
  };
}

describe("the feed response hook", () => {
  it("injects the semi-sub video into a /browse feed read with json()", async () => {
    const data = await responseAt({
      url: BROWSE_URL,
      body: JSON.stringify(feedResponseBody())
    }).json();
    expect(feedIds(data)).toEqual([videoId(1), videoId(50), videoId(2), null]);
  });

  it("tags the injected item, and only that one", async () => {
    const data = await responseAt({
      url: BROWSE_URL,
      body: JSON.stringify(feedResponseBody())
    }).json();
    const contents = readSubscriptionsFeed(data)?.contents ?? [];
    expect(
      contents.filter(item => JSON.stringify(item).includes(SEMI_SUBSCRIBED_TAG)).map(videoIdFromGridItem)
    ).toEqual([videoId(50)]);
  });

  it("injects it into a /browse feed read with text(), and into its clone", async () => {
    const response = responseAt({
      url: BROWSE_URL,
      body: JSON.stringify(feedResponseBody())
    });
    const clone = response.clone();
    Object.defineProperty(clone, "url", { value: BROWSE_URL });
    const [text, cloneData] = await Promise.all([response.text(), clone.json()]);
    expect(feedIds(JSON.parse(text))).toContain(videoId(50));
    expect(feedIds(cloneData)).toContain(videoId(50));
  });

  it("injects it into the feed page HTML YouTube Auto Feed falls back to", async () => {
    const html = `<script>var ytInitialData = ${JSON.stringify(feedResponseBody())};</script>`;
    const patched = await responseAt({
      url: FEED_PAGE_URL,
      body: html
    }).text();
    expect(patched).toContain(videoId(50));
  });

  it("hands every other response through untouched", async () => {
    const channelBody = JSON.stringify(channelVideosTabResponse([]));
    const browseText = await responseAt({
      url: BROWSE_URL,
      body: channelBody
    }).text();
    const guideData = await responseAt({
      url: GUIDE_URL,
      body: JSON.stringify(feedResponseBody())
    }).json();
    expect(browseText).toBe(channelBody);
    expect(feedIds(guideData)).not.toContain(videoId(50));
  });

  it("leaves the feed alone while the extension is off", async () => {
    pageState.current = pageState.current && {
      ...pageState.current,
      isExtensionEnabled: false
    };
    const data = await responseAt({
      url: BROWSE_URL,
      body: JSON.stringify(feedResponseBody())
    }).json();
    expect(feedIds(data)).not.toContain(videoId(50));
  });

  it("rejects invalid JSON the way the native json() does", async () => {
    await expect(
      responseAt({
        url: BROWSE_URL,
        body: "not json"
      }).json()
    ).rejects.toThrow(SyntaxError);
  });

  it("stays in a chain with an override installed after it", async () => {
    const ownJson = Response.prototype.json;
    const chainedJson = vi.fn(function chained(this: Response) {
      return ownJson.call(this);
    });
    Response.prototype.json = chainedJson;
    const data = await responseAt({
      url: BROWSE_URL,
      body: JSON.stringify(feedResponseBody())
    }).json();
    Response.prototype.json = ownJson;
    expect(chainedJson).toHaveBeenCalledOnce();
    expect(feedIds(data)).toContain(videoId(50));
  });

  it("puts the Short in the feed's Shorts shelf, tagged, and never in the band", async () => {
    const data = await readFeedWithShelf();
    const items = shelfItems(data);
    expect(items.map(videoIdFromShelfItem)).toEqual([videoId(60), videoId(90)]);
    expect(items.map(isSemiSubscribedItem)).toEqual([true, false]);
    expect(feedIds(data)).not.toContain(videoId(60));
  });

  it("builds the Short from the channel's Shorts tab, with its views", async () => {
    const [short] = shelfItems(await readFeedWithShelf());
    expect(shortsLockupFromItem(short)?.overlayMetadata?.secondaryText?.content).toBe("29M views");
  });

  it("leaves the Short out of a feed without a Shorts shelf", async () => {
    const data = await responseAt({
      url: BROWSE_URL,
      body: JSON.stringify(feedResponseBody())
    }).json();
    expect(JSON.stringify(data)).not.toContain(videoId(60));
    expect(feedIds(data)).toContain(videoId(50));
  });

  it("keeps Shorts out while a YouTube Auto Feed too old for them runs, still injecting videos", async () => {
    vi.stubGlobal(YTAF_PRESENCE_GLOBAL, {});
    const data = await readFeedWithShelf();
    expect(shelfItems(data).map(videoIdFromShelfItem)).toEqual([videoId(90)]);
    expect(feedIds(data)).toContain(videoId(50));
  });

  it.each([true, 1, 2])("injects Shorts while a YouTube Auto Feed on contract version %j runs", async version => {
    vi.stubGlobal(YTAF_PRESENCE_GLOBAL, {});
    vi.stubGlobal(YTAF_CONTRACT_VERSION_GLOBAL, version);
    const data = await readFeedWithShelf();
    expect(shelfItems(data).map(videoIdFromShelfItem)).toEqual([videoId(60), videoId(90)]);
  });

  it("fills the Shorts shelf m puts on a later page, with Shorts only", async () => {
    site.current = "mobile";
    await readFirstPageWithoutShelf();
    const { data, shelfIds, rootIds } = await readLaterPage();
    expect(shelfIds).toEqual([videoId(60), videoId(90)]);
    expect(rootIds).toEqual([videoId(3), null, videoId(4), null]);
    const [short] = (readSubscriptionsContinuation(data)?.contents ?? []).flatMap(shelfItemsFromGridItem);
    expect(isSemiSubscribedItem(short)).toBe(true);
  });

  it("never repeats on m's later page a Short the first page shelved", async () => {
    site.current = "mobile";
    await responseAt({
      url: BROWSE_URL,
      body: JSON.stringify(mobileFeedResponse([mobileShortsShelf([91])]))
    }).json();
    expect((await readLaterPage()).shelfIds).toEqual([videoId(90)]);

    await readFirstPageWithoutShelf();
    expect((await readLaterPage()).shelfIds).toEqual([videoId(60), videoId(90)]);
  });

  it("leaves www's later pages to the live write", async () => {
    const data = await responseAt({
      url: BROWSE_URL,
      body: JSON.stringify(laterPageWithShortsShelf())
    }).json();
    expect(data).toEqual(laterPageWithShortsShelf());
  });
});

describe("the feed response hook, for a subscribed channel with a hide filter", () => {
  const titleHideFilter: TitleFilter = {
    kind: FilterKind.REGEX,
    pattern: "video 2$",
    flags: "i"
  };
  const aiHideFilter: AiFilter = {
    kind: FilterKind.AI_MATCH,
    description: "Livestreams"
  };

  function hideWith({
    hideFilter,
    hiddenVideoIds = [],
    ...aiState
  }: Partial<Pick<PageState, "hiddenVideoIds" | "aiVerdicts" | "isAiEnabled">> & {
    hideFilter: TitleFilter;
  }) {
    pageState.current = pageState.current && {
      ...pageState.current,
      ...aiState,
      hiddenVideoIds,
      subscriptions: {
        ...pageState.current.subscriptions,
        [OTHER_CHANNEL_ID]: {
          channelId: OTHER_CHANNEL_ID,
          title: "Subscribed Channel",
          followFilter: DEFAULT_TITLE_FILTER,
          hideFilter,
          createdAt: 0,
          isSubscribed: true
        }
      }
    };
  }

  async function readFeed() {
    return await responseAt({
      url: BROWSE_URL,
      body: JSON.stringify(feedResponseBody())
    }).json();
  }

  function hiddenIdList(data: unknown) {
    const grid = desktopFeedResponseGrid(data);
    return grid && "yssHiddenVideoIds" in grid ? grid.yssHiddenVideoIds : undefined;
  }

  it("takes a video its title matches out of the Latest band, still inserting semi-sub videos", async () => {
    hideWith({ hideFilter: titleHideFilter });
    expect(feedIds(await readFeed())).toEqual([videoId(1), videoId(50), null]);
  });

  it("takes a hidden Short out of the Shorts shelf by the channel's cached uploads, as Shorts name no channel", async () => {
    hideWith({
      hideFilter: titleHideFilter,
      hiddenVideoIds: [videoId(90)]
    });
    const data = await readFeedWithShelf();
    expect(shelfItems(data).map(videoIdFromShelfItem)).toEqual([videoId(60)]);
    expect(feedIds(data)).not.toContain(videoId(2));
  });

  it("keeps a video still waiting for its AI verdict, and hides it once the verdict says it matches", async () => {
    hideWith({
      hideFilter: aiHideFilter,
      isAiEnabled: true
    });
    expect(feedIds(await readFeed())).toContain(videoId(2));

    hideWith({
      hideFilter: aiHideFilter,
      isAiEnabled: true,
      aiVerdicts: {
        [getAiFilterKey(aiHideFilter)]: {
          [videoId(2)]: true
        }
      }
    });
    expect(feedIds(await readFeed())).not.toContain(videoId(2));
  });

  it("hides nothing with an empty hide filter", async () => {
    hideWith({ hideFilter: DEFAULT_TITLE_FILTER });
    expect(feedIds(await readFeed())).toEqual([videoId(1), videoId(50), videoId(2), null]);
  });

  it.each([
    [undefined, false],
    [true, false],
    [1, false],
    [2, true],
    [3, true]
  ])(
    "lists the hidden ids beside the grid for a YouTube Auto Feed on contract version %j: %j",
    async (version, isListed) => {
      vi.stubGlobal(YTAF_CONTRACT_VERSION_GLOBAL, version);
      hideWith({
        hideFilter: titleHideFilter,
        hiddenVideoIds: [videoId(90)]
      });
      const data = await readFeedWithShelf();
      expect(hiddenIdList(data)).toEqual(isListed ? [videoId(90), videoId(2)] : undefined);
    }
  );

  it("lists nothing while nothing is hidden", async () => {
    vi.stubGlobal(YTAF_CONTRACT_VERSION_GLOBAL, 2);
    hideWith({ hideFilter: DEFAULT_TITLE_FILTER });
    expect(hiddenIdList(await readFeed())).toBeUndefined();
  });

  it("takes hidden videos out of www's hard-load ytInitialData, adding nothing there", () => {
    hideWith({ hideFilter: titleHideFilter });
    globalThis.ytInitialData = feedResponseBody();
    expect(feedIds(globalThis.ytInitialData)).toEqual([videoId(1), null]);
  });

  it("takes hidden videos out of www's later pages too, adding nothing there", async () => {
    hideWith({ hideFilter: titleHideFilter });
    const data = await responseAt({
      url: BROWSE_URL,
      body: JSON.stringify(
        feedContinuationResponse([
          desktopFeedItem({
            index: 2,
            published: "1 day ago"
          }),
          shortsShelf([90]),
          desktopFeedItem({
            index: 3,
            published: "2 days ago"
          }),
          continuationItem()
        ])
      )
    }).json();
    const contents = readSubscriptionsContinuation(data)?.contents ?? [];
    expect(contents.map(videoIdFromGridItem)).toEqual([videoId(3), null, null]);
    expect(contents.flatMap(shelfItemsFromGridItem).map(videoIdFromShelfItem)).toEqual([videoId(90)]);
  });
});
