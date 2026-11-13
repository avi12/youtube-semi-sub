import { describe, expect, it } from "vitest";

import { buildChannelEndpoint, buildReelWatchEndpoint, buildWatchEndpoint } from "@/lib/youtube/endpoints";

const VIDEO_ID = "R6yNUnRXZ64";
const CHANNEL_ID = "UCBJycsmduvYEL83R_U4JriQ";

describe("navigation endpoints", () => {
  it("opens a video on the watch page, and a Short in the Shorts player", () => {
    expect(buildWatchEndpoint(VIDEO_ID)).toMatchObject({
      commandMetadata: {
        webCommandMetadata: {
          url: `/watch?v=${VIDEO_ID}`
        }
      },
      watchEndpoint: {
        videoId: VIDEO_ID
      }
    });
    expect(buildReelWatchEndpoint(VIDEO_ID)).toMatchObject({
      commandMetadata: {
        webCommandMetadata: {
          url: `/shorts/${VIDEO_ID}`
        }
      },
      reelWatchEndpoint: {
        videoId: VIDEO_ID
      }
    });
  });

  it("names the channel's handle path only when it has one", () => {
    expect(
      buildChannelEndpoint({
        channelId: CHANNEL_ID,
        url: "/@mkbhd",
        canonicalBaseUrl: "/@mkbhd"
      }).browseEndpoint
    ).toEqual({
      browseId: CHANNEL_ID,
      canonicalBaseUrl: "/@mkbhd"
    });
    expect(
      buildChannelEndpoint({
        channelId: CHANNEL_ID,
        url: `/channel/${CHANNEL_ID}`,
        canonicalBaseUrl: undefined
      }).browseEndpoint
    ).toEqual({ browseId: CHANNEL_ID });
  });
});
