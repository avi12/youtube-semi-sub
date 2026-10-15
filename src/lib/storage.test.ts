import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

const CHANNEL_ID = "UCBJycsmduvYEL83R_U4JriQ";
const CHECKED_AT = 1_800_000_000_000;

/** A v1 cache: from before Shorts were marked */
const V1_CHANNEL_VIDEOS = {
  [CHANNEL_ID]: {
    fetchedAt: CHECKED_AT,
    videos: [{
      videoId: "R6yNUnRXZ64",
      channelId: CHANNEL_ID,
      channelTitle: "Marques Brownlee",
      title: "iPhone Duo is here",
      publishedAt: CHECKED_AT,
      thumbnailUrl: "https://i3.ytimg.com/vi/R6yNUnRXZ64/hqdefault.jpg"
    }]
  }
};

async function loadStorage() {
  vi.resetModules();
  return await import("@/lib/storage");
}

describe("the channel cache migration", () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it("drops a cache that can't tell Shorts apart, and its refresh throttle with it", async () => {
    await fakeBrowser.storage.local.set({
      channelVideos: V1_CHANNEL_VIDEOS,
      channelCheckedAt: {
        [CHANNEL_ID]: CHECKED_AT
      }
    });
    const { channelVideosItem, channelCheckedAtItem } = await loadStorage();
    expect(await channelVideosItem.getValue()).toEqual({});
    expect(await channelCheckedAtItem.getValue()).toEqual({});
    expect(await fakeBrowser.storage.local.get(["channelVideos$", "channelCheckedAt$"])).toEqual({
      channelVideos$: {
        v: 2
      },
      channelCheckedAt$: {
        v: 2
      }
    });
  });

  it("keeps a cache that already marks Shorts", async () => {
    const channelVideos = {
      [CHANNEL_ID]: {
        fetchedAt: CHECKED_AT,
        videos: [{
          ...V1_CHANNEL_VIDEOS[CHANNEL_ID].videos[0],
          isShort: true
        }]
      }
    };
    await fakeBrowser.storage.local.set({
      channelVideos,
      channelVideos$: {
        v: 2
      },
      channelCheckedAt: {
        [CHANNEL_ID]: CHECKED_AT
      },
      channelCheckedAt$: {
        v: 2
      }
    });
    const { channelVideosItem, channelCheckedAtItem } = await loadStorage();
    expect(await channelVideosItem.getValue()).toEqual(channelVideos);
    expect(await channelCheckedAtItem.getValue()).toEqual({ [CHANNEL_ID]: CHECKED_AT });
  });
});
