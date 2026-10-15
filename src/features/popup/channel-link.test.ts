import { formatHandle, getChannelUrl } from "./channel-link";
import { describe, expect, it } from "vitest";

const CHANNEL_ID = "UC0123456789abcdefghijkl";

describe("channel links", () => {
  it("adds the @ to a bare handle once", () => {
    expect(formatHandle("fireship")).toBe("@fireship");
    expect(formatHandle("@fireship")).toBe("@fireship");
  });

  it("prefers the handle URL", () => {
    expect(
      getChannelUrl({
        channelId: CHANNEL_ID,
        handle: "fireship"
      })
    ).toBe("https://www.youtube.com/@fireship");
  });

  it("falls back to the channel id URL", () => {
    expect(getChannelUrl({ channelId: CHANNEL_ID })).toBe(`https://www.youtube.com/channel/${CHANNEL_ID}`);
  });
});
