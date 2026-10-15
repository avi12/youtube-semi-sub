import { classifyPendingVideos } from "./classification";
import { startAiMatch } from "./start-ai-match";
import { AiEngine } from "@/lib/ai/ai-status";
import { getAiFilterKey } from "@/lib/filter/ai-filter-key";
import { type AiFilter, FilterKind } from "@/lib/filter/title-filter";
import { MessageType, sendMessage } from "@/lib/messaging/extension-messaging";
import type { FeedVideo } from "@/lib/schemas/feed-video";
import { aiVerdictsItem, channelVideosItem, isAiEnabledItem, semiSubscriptionsItem } from "@/lib/storage";
import { createFakeBase } from "#ai-match/classify/fixtures/fake-prompt-session";
import { BuiltInAvailability } from "#ai-match/engine/prompt-api";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

const CHANNEL_ID = "UCBJycsmduvYEL83R_U4JriQ";
const PREVIEW_CHANNEL_ID = "UCXuqSBlHAE6Xw-yeJA0Tunw";
const AI_FILTER: AiFilter = {
  kind: FilterKind.aiMatch,
  description: "only reviews"
};
const KEY = getAiFilterKey(AI_FILTER);

function createVideo({ videoId, title, channelId = CHANNEL_ID }: Pick<FeedVideo, "videoId" | "title">
  & Partial<Pick<FeedVideo, "channelId">>) {
  const video: FeedVideo = {
    videoId,
    channelId,
    channelTitle: "Channel",
    title,
    publishedAt: 0,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  };
  return video;
}

const fakeLanguageModel = {
  availability: vi.fn(async () => BuiltInAvailability.available),
  create: vi.fn(async () => createFakeBase().base)
};

async function semiSubscribeWithAiFilter() {
  await semiSubscriptionsItem.setValue({
    [CHANNEL_ID]: {
      channelId: CHANNEL_ID,
      title: "Channel",
      filter: AI_FILTER,
      createdAt: 0
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

describe("startAiMatch with the built-in model", () => {
  beforeAll(() => {
    fakeBrowser.reset();
    vi.stubGlobal("LanguageModel", fakeLanguageModel);
    startAiMatch();
  });

  beforeEach(async () => {
    fakeLanguageModel.availability.mockResolvedValue(BuiltInAvailability.available);
    fakeLanguageModel.create.mockClear();
    await isAiEnabledItem.setValue(false);
    await aiVerdictsItem.setValue({});
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("reports the built-in engine as ready", async () => {
    expect(await sendMessage(MessageType.getAiStatus)).toEqual({
      engine: AiEngine.builtIn,
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
    fakeLanguageModel.availability.mockResolvedValue(BuiltInAvailability.downloadable);
    await semiSubscribeWithAiFilter();
    await isAiEnabledItem.setValue(true);
    await classifyPendingVideos();
    expect(fakeLanguageModel.availability).toHaveBeenCalled();
    expect(fakeLanguageModel.create).not.toHaveBeenCalled();
    expect(await aiVerdictsItem.getValue()).toEqual({});
    expect(await sendMessage(MessageType.getAiStatus)).toMatchObject({
      engine: AiEngine.builtIn,
      isModelReady: false
    });
  });

  it("judges an editor's preview of a channel that isn't semi-subscribed", async () => {
    await isAiEnabledItem.setValue(true);
    await sendMessage(MessageType.classifyVideos, {
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

  it("rejects a malformed preview request", async () => {
    await expect(
      sendMessage(MessageType.classifyVideos, {
        filter: {
          kind: FilterKind.aiMatch,
          description: " "
        },
        videos: []
      })
    ).rejects.toThrow();
  });
});
