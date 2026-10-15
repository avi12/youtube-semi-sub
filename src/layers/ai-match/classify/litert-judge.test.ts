import { createLiteRtJudge } from "./litert-judge";
import { type ChatMessage, ChatRole } from "@/lib/ai/chat-message";
import type { FeedVideo } from "@/lib/schemas/feed-video";
import { describe, expect, it, vi } from "vitest";

const CHANNEL_ID = "UCBJycsmduvYEL83R_U4JriQ";

function createVideo(videoId: string) {
  const video: FeedVideo = {
    videoId,
    channelId: CHANNEL_ID,
    channelTitle: "Channel",
    title: videoId,
    publishedAt: 0,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    isShort: false
  };
  return video;
}

const BATCH = {
  description: "only reviews",
  videos: [createVideo("aaaaaaaaaaa"), createVideo("bbbbbbbbbbb"), createVideo("ccccccccccc")]
};

describe("createLiteRtJudge", () => {
  it("sends the worked example as the preface and the batch as the last message", async () => {
    const infer = vi.fn(async (_messages: ChatMessage[]) => "{\"verdicts\":[{\"id\":1,\"match\":true},{\"id\":2,\"match\":false},{\"id\":3,\"match\":true}]}");
    await createLiteRtJudge(infer).judgeBatch(BATCH);

    const messages = infer.mock.calls[0]?.[0] ?? [];
    expect(messages.map(message => message.role)).toEqual([
      ChatRole.system,
      ChatRole.user,
      ChatRole.assistant,
      ChatRole.user
    ]);
    expect(messages.at(-1)?.content).toContain("Filter: only reviews");
  });

  it("reads JSON wrapped in prose and fences, in one attempt when it is complete", async () => {
    const infer = vi.fn(async () => "Here you go:\n```json\n{\"verdicts\":[{\"id\":1,\"match\":true},{\"id\":2,\"match\":false},{\"id\":3,\"match\":false}]}\n```");
    expect(await createLiteRtJudge(infer).judgeBatch(BATCH)).toEqual(new Map([[1, true], [2, false], [3, false]]));
    expect(infer).toHaveBeenCalledTimes(1);
  });

  it("tries once more for skipped ids, keeping the first answers, then leaves the rest pending", async () => {
    const infer = vi.fn<(messages: ChatMessage[]) => Promise<string | null>>()
      .mockResolvedValueOnce("{\"verdicts\":[{\"id\":1,\"match\":true}]}")
      .mockResolvedValueOnce("[{\"id\":1,\"match\":false},{\"id\":2,\"match\":true}]");
    expect(await createLiteRtJudge(infer).judgeBatch(BATCH)).toEqual(new Map([[1, true], [2, true]]));
    expect(infer).toHaveBeenCalledTimes(2);
  });

  it("gives up after two unusable replies", async () => {
    const infer = vi.fn(async () => "I can't answer that");
    expect((await createLiteRtJudge(infer).judgeBatch(BATCH)).size).toBe(0);
    expect(infer).toHaveBeenCalledTimes(2);
  });

  it("fails the batch when the engine returns nothing", async () => {
    await expect(createLiteRtJudge(async () => null).judgeBatch(BATCH)).rejects.toThrow();
  });
});
