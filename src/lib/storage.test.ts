import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

const CHANNEL_ID = "UCBJycsmduvYEL83R_U4JriQ";
const CHECKED_AT = 1_800_000_000_000;

/** A v1 cache: from before Shorts were marked */
const V1_CHANNEL_VIDEOS = {
  [CHANNEL_ID]: {
    fetchedAt: CHECKED_AT,
    videos: [
      {
        videoId: "R6yNUnRXZ64",
        channelId: CHANNEL_ID,
        channelTitle: "Marques Brownlee",
        title: "iPhone Duo is here",
        publishedAt: CHECKED_AT,
        thumbnailUrl: "https://i3.ytimg.com/vi/R6yNUnRXZ64/hqdefault.jpg"
      }
    ]
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
        videos: [
          {
            ...V1_CHANNEL_VIDEOS[CHANNEL_ID].videos[0],
            isShort: true
          }
        ]
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

describe("the semi-subscriptions migration", () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it("gives a v3 store a mode per channel: a halted channel reads as subscribed, with no hide filter set", async () => {
    const filter = {
      kind: "regex",
      pattern: "review",
      flags: "i"
    };
    await fakeBrowser.storage.local.set({
      semiSubscriptions: {
        [CHANNEL_ID]: {
          channelId: CHANNEL_ID,
          title: "Marques Brownlee",
          filter,
          createdAt: CHECKED_AT,
          isHalted: true
        }
      },
      semiSubscriptions$: {
        v: 3
      }
    });
    const { semiSubscriptionsItem } = await loadStorage();
    expect(await semiSubscriptionsItem.getValue()).toEqual({
      [CHANNEL_ID]: {
        channelId: CHANNEL_ID,
        title: "Marques Brownlee",
        followFilter: filter,
        hideFilter: null,
        createdAt: CHECKED_AT,
        isSubscribed: true
      }
    });
    expect(await fakeBrowser.storage.local.get("semiSubscriptions$")).toEqual({
      semiSubscriptions$: {
        v: 4
      }
    });
  });
});

describe("the stored state", () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it("reads every setting and record, falling back where nothing is stored", async () => {
    const { isAiEnabledItem, readStoredState } = await loadStorage();
    await isAiEnabledItem.setValue(true);

    expect(await readStoredState()).toEqual({
      isExtensionEnabled: true,
      isAnimationsEnabled: true,
      isAiEnabled: true,
      subscriptions: {},
      channelVideos: {},
      aiVerdicts: {}
    });
  });

  it("calls back on a change to any part of it, until it is told to stop", async () => {
    const { isAnimationsEnabledItem, isExtensionEnabledItem, watchStoredState } = await loadStorage();
    const callback = vi.fn();
    const stopWatching = watchStoredState(callback);

    await isExtensionEnabledItem.setValue(false);
    await isAnimationsEnabledItem.setValue(false);
    expect(callback).toHaveBeenCalledTimes(2);

    stopWatching();
    await isExtensionEnabledItem.setValue(true);
    expect(callback).toHaveBeenCalledTimes(2);
  });
});
