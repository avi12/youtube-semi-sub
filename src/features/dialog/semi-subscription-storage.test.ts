import { mergeSemiSubscription } from "./semi-subscription-storage";
import type { SemiSubscription } from "@/lib/semi-subscription";
import { describe, expect, it } from "vitest";

const CHANNEL_ID = "UCBJycsmduvYEL83R_U4JriQ";
const CREATED_AT = 1_700_000_000_000;
const NOW = 1_800_000_000_000;
const AVATAR_URL = "https://yt3.googleusercontent.com/avatar=s88-c-k-c0x00ffffff-no-rj";

const PREVIOUS: SemiSubscription = {
  channelId: CHANNEL_ID,
  title: "Marques Brownlee",
  handle: "@mkbhd",
  avatarUrl: AVATAR_URL,
  filter: {
    pattern: "iphone",
    flags: "i"
  },
  createdAt: CREATED_AT
};

describe("mergeSemiSubscription", () => {
  it("creates a new semi-subscription stamped now", () => {
    expect(
      mergeSemiSubscription({
        previous: undefined,
        channel: {
          channelId: CHANNEL_ID,
          title: "Marques Brownlee",
          handle: "@mkbhd"
        },
        filter: {
          pattern: "review",
          flags: ""
        },
        now: NOW
      })
    ).toEqual({
      channelId: CHANNEL_ID,
      title: "Marques Brownlee",
      handle: "@mkbhd",
      filter: {
        pattern: "review",
        flags: ""
      },
      createdAt: NOW
    });
  });

  it("keeps createdAt, the avatar and the handle when a page without them edits the filter", () => {
    expect(
      mergeSemiSubscription({
        previous: PREVIOUS,
        channel: {
          channelId: CHANNEL_ID,
          title: "Marques Brownlee"
        },
        filter: {
          pattern: "pixel",
          flags: "iu"
        },
        now: NOW
      })
    ).toEqual({
      ...PREVIOUS,
      filter: {
        pattern: "pixel",
        flags: "iu"
      }
    });
  });

  it("takes fresher channel details from the page", () => {
    const merged = mergeSemiSubscription({
      previous: PREVIOUS,
      channel: {
        channelId: CHANNEL_ID,
        title: "MKBHD",
        handle: "@marques",
        avatarUrl: "https://yt3.googleusercontent.com/new=s88"
      },
      filter: PREVIOUS.filter,
      now: NOW
    });
    expect(merged).toMatchObject({
      title: "MKBHD",
      handle: "@marques",
      avatarUrl: "https://yt3.googleusercontent.com/new=s88",
      createdAt: CREATED_AT
    });
  });
});
