import { channelIdSchema, getChannelInitial } from "@/lib/schemas/channel";
import { describe, expect, it } from "vitest";

describe("getChannelInitial", () => {
  it("takes the first character whole, an emoji included", () => {
    expect(getChannelInitial("Marques")).toBe("M");
    expect(getChannelInitial("🎮 Gaming")).toBe("🎮");
    expect(getChannelInitial("")).toBe("");
  });
});

describe("channelIdSchema", () => {
  it("accepts a UC id of the right length only", () => {
    expect(channelIdSchema.safeParse("UCBJycsmduvYEL83R_U4JriQ").success).toBe(true);
    expect(channelIdSchema.safeParse("UCBJycsmduvYEL83R_U4Jri").success).toBe(false);
    expect(channelIdSchema.safeParse("xxBJycsmduvYEL83R_U4JriQ").success).toBe(false);
  });
});
