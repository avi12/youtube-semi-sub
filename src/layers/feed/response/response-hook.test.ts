import { readSubscriptionsFeed } from "./feed-response";
import type { PageState } from "@/lib/messaging/page-messaging";
import {
  CHANNEL_ID,
  channelVideosTabResponse,
  continuationItem,
  desktopChannelTabLockup,
  desktopFeedItem,
  desktopFeedResponse,
  feedVideo,
  NOW,
  richItem,
  videoId
} from "#feed/fixtures/feed-fixtures";
import { videoIdFromGridItem } from "#feed/items/feed-items";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

const BROWSE_URL = "https://www.youtube.com/youtubei/v1/browse?prettyPrint=false";
const GUIDE_URL = "https://www.youtube.com/youtubei/v1/guide?prettyPrint=false";
const FEED_PAGE_URL = "https://www.youtube.com/feed/subscriptions";

const pageState: { current: PageState | null } = { current: null };

vi.mock("@/lib/page/page-state", () => ({
  getPageState: () => pageState.current,
  onPageState: () => () => {}
}));

vi.mock("@/lib/youtube/page/innertube", () => ({
  InnerTubeEndpoint: {
    browse: "/youtubei/v1/browse?prettyPrint=false"
  },
  postInnerTube: () => Promise.resolve(
    channelVideosTabResponse([
      richItem({ lockupViewModel: desktopChannelTabLockup(50) })
    ])
  )
}));

vi.mock("@/lib/youtube/site", () => ({
  YouTubeSite: {
    desktop: "desktop",
    mobile: "mobile"
  },
  getYouTubeSite: () => "desktop"
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

function responseAt({ url, body }: {
  url: string;
  body: string;
}) {
  const response = new Response(body);
  Object.defineProperty(response, "url", { value: url });
  return response;
}

function feedIds(data: unknown) {
  const contents = readSubscriptionsFeed(data)?.contents ?? [];
  return contents.map(videoIdFromGridItem);
}

beforeAll(async () => {
  // Only Date: the hook's deadlines still run on real timers
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubGlobal("document", {
    documentElement: {
      lang: "en"
    }
  });
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
  pageState.current = {
    isExtensionEnabled: true,
    isAnimationsEnabled: true,
    isAiEnabled: false,
    aiVerdicts: {},
    subscriptions: {},
    feedVideos: [feedVideo({
      index: 50,
      hours: 3,
      channelId: CHANNEL_ID
    })]
  };
});

describe("the feed response hook", () => {
  it("injects the semi-sub video into a /browse feed read with json()", async () => {
    const data = await responseAt({
      url: BROWSE_URL,
      body: JSON.stringify(feedResponseBody())
    }).json();
    expect(feedIds(data)).toEqual([videoId(1), videoId(50), videoId(2), null]);
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
});
