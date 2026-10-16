import { classifyVideos } from "./classifier";
import { AI_BATCH_SIZE } from "./prompt";
import type { VideoVerdicts } from "@/lib/filter/ai-verdicts";
import type { FeedVideo } from "@/lib/schemas/feed-video";
import { answerFromPrompt, createFakeBase, createSessionMock } from "#ai-match/classify/fixtures/fake-prompt-session";
import { createBuiltInJudge } from "#ai-match/classify/judges/built-in-judge";
import type { PromptSession } from "#ai-match/engine/prompt-api";
import { describe, expect, it, vi } from "vitest";

const CHANNEL_ID = "UCBJycsmduvYEL83R_U4JriQ";
const DESCRIPTION = "only reviews";
const VIDEO_COUNT = AI_BATCH_SIZE + 2;

function createVideo(i: number) {
  const videoId = `video${String(i).padStart(6, "0")}`;
  const video: FeedVideo = {
    videoId,
    channelId: CHANNEL_ID,
    channelTitle: "Channel",
    title: i % 2 === 0 ? `Review ${i}` : `Vlog ${i}`,
    publishedAt: i,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    isShort: false
  };
  return video;
}

const VIDEOS = Array.from({ length: VIDEO_COUNT }, (_, i) => createVideo(i));

async function collectVerdicts(judge: ReturnType<typeof createBuiltInJudge>) {
  const batches: VideoVerdicts[] = [];
  await classifyVideos({
    description: DESCRIPTION,
    videos: VIDEOS,
    judge,
    async onVerdicts(verdicts) {
      batches.push(verdicts);
    },
    shouldContinue: async () => true
  });
  return batches;
}

describe("classifyVideos with the built-in judge", () => {
  it("judges each batch in its own clone of one base session, and destroys every clone", async () => {
    const { base, clones } = createFakeBase();
    const openSession = vi.fn(async () => base);
    const judge = createBuiltInJudge(openSession);

    const batches = await collectVerdicts(judge);

    expect(openSession).toHaveBeenCalledTimes(1);
    expect(clones).toHaveLength(2);
    expect(base.prompt).not.toHaveBeenCalled();
    for (const clone of clones) {
      expect(clone.prompt).toHaveBeenCalledTimes(1);
      expect(clone.destroy).toHaveBeenCalledTimes(1);
    }

    expect(batches.map(verdicts => Object.keys(verdicts).length)).toEqual([AI_BATCH_SIZE, VIDEO_COUNT - AI_BATCH_SIZE]);
    expect(batches[0]?.[VIDEOS[0]?.videoId ?? ""]).toBe(true);
    expect(batches[0]?.[VIDEOS[1]?.videoId ?? ""]).toBe(false);

    expect(base.destroy).not.toHaveBeenCalled();
    await judge.close();
    expect(base.destroy).toHaveBeenCalledTimes(1);
  });

  it("constrains each reply to the batch's own size", async () => {
    const { base, clones } = createFakeBase();
    await collectVerdicts(createBuiltInJudge(async () => base));

    const lastOptions = clones.at(-1)?.prompt.mock.calls[0]?.[1];
    expect(lastOptions?.responseConstraint).toMatchObject({
      properties: {
        verdicts: {
          minItems: VIDEO_COUNT - AI_BATCH_SIZE,
          maxItems: VIDEO_COUNT - AI_BATCH_SIZE
        }
      }
    });
    expect(lastOptions?.signal).toBeInstanceOf(AbortSignal);
  });

  it("opens a fresh session per batch when clone() is missing", async () => {
    const sessions: PromptSession[] = [];
    const openSession = vi.fn(async () => {
      const session: PromptSession = createSessionMock(answerFromPrompt);
      sessions.push(session);
      return session;
    });

    await collectVerdicts(createBuiltInJudge(openSession));

    // The base, then one per batch
    expect(openSession).toHaveBeenCalledTimes(3);
    expect(sessions[1]?.destroy).toHaveBeenCalledTimes(1);
    expect(sessions[2]?.destroy).toHaveBeenCalledTimes(1);
  });

  it("leaves videos the model skipped pending", async () => {
    const { base } = createFakeBase(() => JSON.stringify({
      verdicts: [{
        id: 2,
        match: true
      }]
    }));
    const batches = await collectVerdicts(createBuiltInJudge(async () => base));
    expect(batches).toEqual([{ [VIDEOS[1]?.videoId ?? ""]: true }, { [VIDEOS[AI_BATCH_SIZE + 1]?.videoId ?? ""]: true }]);
  });

  it("reports nothing for a reply that isn't JSON", async () => {
    const { base } = createFakeBase(() => "Sure, here you go");
    expect(await collectVerdicts(createBuiltInJudge(async () => base))).toEqual([]);
  });

  it("stops as soon as it is told to, between batches", async () => {
    const onVerdicts = vi.fn(async () => {});
    let remainingBatches = 1;
    await classifyVideos({
      description: DESCRIPTION,
      videos: VIDEOS,
      judge: createBuiltInJudge(async () => createFakeBase().base),
      onVerdicts,
      shouldContinue: async () => remainingBatches-- > 0
    });
    expect(onVerdicts).toHaveBeenCalledTimes(1);
  });

  it("keeps the verdicts already reported when a later batch fails", async () => {
    let promptCount = 0;
    const { base } = createFakeBase(input => {
      promptCount++;

      if (promptCount > 1) {
        throw new Error("The model crashed");
      }

      return answerFromPrompt(input);
    });
    const onVerdicts = vi.fn(async () => {});
    await expect(
      classifyVideos({
        description: DESCRIPTION,
        videos: VIDEOS,
        judge: createBuiltInJudge(async () => base),
        onVerdicts,
        shouldContinue: async () => true
      })
    ).rejects.toThrow();
    expect(onVerdicts).toHaveBeenCalledTimes(1);
  });

  it("fails a batch when no session can be opened", async () => {
    await expect(
      classifyVideos({
        description: DESCRIPTION,
        videos: VIDEOS,
        judge: createBuiltInJudge(async () => null),
        async onVerdicts() {},
        shouldContinue: async () => true
      })
    ).rejects.toThrow();
  });
});
