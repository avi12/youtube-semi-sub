import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { createFakeBase } from "#ai-match/classify/fixtures/fake-prompt-session";
import { BuiltInAvailability } from "#ai-match/engine/prompt-api";
import { AiEngine } from "@/lib/ai/ai-status";
import { getAiFilterKey } from "@/lib/filter/ai-filter-key";
import { type AiFilter, DEFAULT_TITLE_FILTER, FilterKind } from "@/lib/filter/schema/video-filter-schema";
import { MessageType, sendMessage } from "@/lib/messaging/extension-messaging";
import type { FeedVideo } from "@/lib/schemas/feed-video";
import { aiVerdictsItem, channelVideosItem, isAiEnabledItem, semiSubscriptionsItem } from "@/lib/storage";

import { classifyPendingVideos } from "./classification";
import { startAiMatch } from "./start-ai-match";

const CHANNEL_ID = "UCBJycsmduvYEL83R_U4JriQ";
const PREVIEW_CHANNEL_ID = "UCXuqSBlHAE6Xw-yeJA0Tunw";
const AI_FILTER: AiFilter = {
  kind: FilterKind.AI_MATCH,
  description: "only reviews"
};
const KEY = getAiFilterKey(AI_FILTER);

function createVideo({
  videoId,
  title,
  channelId = CHANNEL_ID
}: Pick<FeedVideo, "videoId" | "title"> & Partial<Pick<FeedVideo, "channelId">>) {
  const video: FeedVideo = {
    videoId,
    channelId,
    channelTitle: "Channel",
    title,
    publishedAt: 0,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    isShort: false
  };
  return video;
}

const fakeLanguageModel = {
  availability: vi.fn(async () => BuiltInAvailability.AVAILABLE),
  create: vi.fn(async () => createFakeBase().base)
};

async function semiSubscribeWithAiFilter() {
  await semiSubscriptionsItem.setValue({
    [CHANNEL_ID]: {
      channelId: CHANNEL_ID,
      title: "Channel",
      followFilter: AI_FILTER,
      createdAt: 0,
      hideFilter: DEFAULT_TITLE_FILTER,
      isSubscribed: false
    }
  });
  await channelVideosItem.setValue({
    [CHANNEL_ID]: {
      fetchedAt: 0,
      videos: [
        createVideo({
          videoId: "aaaaaaaaaaa",
          title: "Review: Pixel 11"
        }),
        createVideo({
          videoId: "bbbbbbbbbbb",
          title: "Vlog"
        })
      ]
    }
  });
}

const getContexts = vi.spyOn(fakeBrowser.runtime, "getContexts");
const closeDocument = vi.spyOn(fakeBrowser.offscreen, "closeDocument");

describe("startAiMatch with the built-in model", () => {
  beforeAll(() => {
    fakeBrowser.reset();
    // The fakes have no in-memory offscreen documents; their callback overloads type these as returning void
    getContexts.mockImplementation(async () => []);
    closeDocument.mockImplementation(async () => {});
    vi.stubGlobal("LanguageModel", fakeLanguageModel);
    startAiMatch();
  });

  beforeEach(async () => {
    fakeLanguageModel.availability.mockResolvedValue(BuiltInAvailability.AVAILABLE);
    fakeLanguageModel.create.mockClear();
    await isAiEnabledItem.setValue(false);
    await aiVerdictsItem.setValue({});
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("reports the built-in engine as ready", async () => {
    expect(await sendMessage(MessageType.GET_AI_STATUS)).toEqual({
      engine: AiEngine.BUILT_IN,
      isModelReady: true,
      download: null
    });
  });

  it("judges nothing while AI match is off", async () => {
    await semiSubscribeWithAiFilter();
    await classifyPendingVideos();
    expect(fakeLanguageModel.create).not.toHaveBeenCalled();
    expect(await aiVerdictsItem.getValue()).toEqual({});
  });

  it("judges a semi-subscribed channel's uploads once AI match is turned on", async () => {
    await semiSubscribeWithAiFilter();
    await isAiEnabledItem.setValue(true);
    await vi.waitFor(async () => {
      expect(await aiVerdictsItem.getValue()).toEqual({
        [KEY]: {
          aaaaaaaaaaa: true,
          bbbbbbbbbbb: false
        }
      });
    });
  });

  it("never starts a download - a model that isn't on disk leaves every video pending", async () => {
    fakeLanguageModel.availability.mockResolvedValue(BuiltInAvailability.DOWNLOADABLE);
    await semiSubscribeWithAiFilter();
    await isAiEnabledItem.setValue(true);
    await classifyPendingVideos();
    expect(fakeLanguageModel.availability).toHaveBeenCalled();
    expect(fakeLanguageModel.create).not.toHaveBeenCalled();
    expect(await aiVerdictsItem.getValue()).toEqual({});
    expect(await sendMessage(MessageType.GET_AI_STATUS)).toMatchObject({
      engine: AiEngine.BUILT_IN,
      isModelReady: false
    });
  });

  it("judges an editor's preview of a channel that isn't semi-subscribed", async () => {
    await isAiEnabledItem.setValue(true);
    await sendMessage(MessageType.CLASSIFY_VIDEOS, {
      filter: AI_FILTER,
      videos: [
        createVideo({
          videoId: "ccccccccccc",
          title: "Review: a laptop",
          channelId: PREVIEW_CHANNEL_ID
        })
      ]
    });
    await vi.waitFor(async () => {
      expect((await aiVerdictsItem.getValue())[KEY]).toMatchObject({
        ccccccccccc: true
      });
    });
  });

  it("deletes the local model on opt-out, closing the offscreen page that holds it", async () => {
    const deleteCache = vi.fn(async () => true);
    vi.stubGlobal("caches", {
      delete: deleteCache
    });
    getContexts.mockImplementationOnce(async () => [
      {
        contextId: "offscreen",
        contextType: "OFFSCREEN_DOCUMENT",
        frameId: -1,
        incognito: false,
        tabId: -1,
        windowId: -1
      }
    ]);
    await isAiEnabledItem.setValue(true);
    await isAiEnabledItem.setValue(false);

    await vi.waitFor(() => expect(deleteCache).toHaveBeenCalled());
    expect(closeDocument).toHaveBeenCalled();
    vi.stubGlobal("caches", undefined);
  });

  it("rejects a malformed preview request", async () => {
    await expect(
      sendMessage(MessageType.CLASSIFY_VIDEOS, {
        filter: {
          kind: FilterKind.AI_MATCH,
          description: " "
        },
        videos: []
      })
    ).rejects.toThrow();
  });
});
