import { FilterKind } from "@/lib/filter/title-filter";
import type { SemiSubscription } from "@/lib/schemas/semi-subscription";
import { haltSemiSubscription, mergeSemiSubscription } from "@/lib/semi-subscription-storage";
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
    kind: FilterKind.regex,
    pattern: "iphone",
    flags: "i"
  },
  createdAt: CREATED_AT,
  isHalted: false
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
          kind: FilterKind.regex,
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
        kind: FilterKind.regex,
        pattern: "review",
        flags: ""
      },
      createdAt: NOW,
      isHalted: false
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
          kind: FilterKind.regex,
          pattern: "pixel",
          flags: "iu"
        },
        now: NOW
      })
    ).toEqual({
      ...PREVIOUS,
      filter: {
        kind: FilterKind.regex,
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
      createdAt: CREATED_AT,
      isHalted: false
    });
  });
});

describe("haltSemiSubscription", () => {
  const subscriptions = { [CHANNEL_ID]: PREVIOUS };

  it("halts a semi-subscription on an official subscribe, keeping its filter", () => {
    expect(
      haltSemiSubscription({
        subscriptions,
        channelId: CHANNEL_ID,
        isHalted: true
      })
    ).toEqual({
      [CHANNEL_ID]: {
        ...PREVIOUS,
        isHalted: true
      }
    });
  });

  it("resumes it on an official unsubscribe", () => {
    expect(
      haltSemiSubscription({
        subscriptions: {
          [CHANNEL_ID]: {
            ...PREVIOUS,
            isHalted: true
          }
        },
        channelId: CHANNEL_ID,
        isHalted: false
      })
    ).toEqual(subscriptions);
  });

  it("leaves channels that aren't semi-subscribed, and unchanged ones, as they are", () => {
    expect(
      haltSemiSubscription({
        subscriptions,
        channelId: "UCXuqSBlHAE6Xw-yeJA0Tunw",
        isHalted: true
      })
    ).toBe(subscriptions);
    expect(
      haltSemiSubscription({
        subscriptions,
        channelId: CHANNEL_ID,
        isHalted: false
      })
    ).toBe(subscriptions);
  });

  it("keeps the halt when the filter is edited", () => {
    expect(
      mergeSemiSubscription({
        previous: {
          ...PREVIOUS,
          isHalted: true
        },
        channel: PREVIOUS,
        filter: PREVIOUS.filter,
        now: NOW
      }).isHalted
    ).toBe(true);
  });
});
