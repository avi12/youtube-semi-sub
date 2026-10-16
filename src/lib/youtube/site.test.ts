import {
  buildShortsPath,
  buildWatchPath,
  FeedPathname,
  InnerTubePath,
  isShortsUrl,
  isYouTubeUrlAt,
  LIVE_PATH_PATTERN,
  SHORTS_PATH_PATTERN
} from "@/lib/youtube/site";
import { describe, expect, it } from "vitest";

const VIDEO_ID = "R6yNUnRXZ64";

describe("video paths", () => {
  it("builds a watch path and a Short's path that the patterns read back", () => {
    expect(buildWatchPath(VIDEO_ID)).toBe(`/watch?v=${VIDEO_ID}`);
    expect(SHORTS_PATH_PATTERN.exec(buildShortsPath(VIDEO_ID))?.[1]).toBe(VIDEO_ID);
  });

  it("reads a livestream's video id from its own address", () => {
    expect(LIVE_PATH_PATTERN.exec(`/live/${VIDEO_ID}`)?.[1]).toBe(VIDEO_ID);
    expect(LIVE_PATH_PATTERN.test(`/live/${VIDEO_ID}/extra`)).toBe(false);
  });

  it("tells a Short's URL from a watch URL, and from text that is no URL", () => {
    expect(isShortsUrl(`https://www.youtube.com/shorts/${VIDEO_ID}`)).toBe(true);
    expect(isShortsUrl(`https://www.youtube.com/watch?v=${VIDEO_ID}`)).toBe(false);
    expect(isShortsUrl("not a url")).toBe(false);
  });
});

describe("isYouTubeUrlAt", () => {
  it("matches the path on www and m.youtube.com, whatever the query", () => {
    for (const origin of ["https://www.youtube.com", "https://m.youtube.com"]) {
      expect(
        isYouTubeUrlAt({
          url: `${origin}${InnerTubePath.browse}?prettyPrint=false`,
          pathname: InnerTubePath.browse
        })
      ).toBe(true);
    }
  });

  it("ignores a trailing slash", () => {
    expect(
      isYouTubeUrlAt({
        url: `https://www.youtube.com${FeedPathname.subscriptions}/`,
        pathname: FeedPathname.subscriptions
      })
    ).toBe(true);
  });

  it("rejects another path, another host, and an empty URL", () => {
    expect(
      isYouTubeUrlAt({
        url: `https://www.youtube.com${InnerTubePath.next}`,
        pathname: InnerTubePath.browse
      })
    ).toBe(false);
    expect(
      isYouTubeUrlAt({
        url: `https://example.com${InnerTubePath.browse}`,
        pathname: InnerTubePath.browse
      })
    ).toBe(false);
    expect(
      isYouTubeUrlAt({
        url: "",
        pathname: InnerTubePath.browse
      })
    ).toBe(false);
  });
});
