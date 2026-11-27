import { describe, expect, it } from "vitest";

import { FilterKind, type RegexFilter } from "@/lib/filter/schema/video-filter-schema";
import type { SemiSubscription } from "@/lib/schemas/semi-subscription";
import { SubscriptionMode } from "@/lib/schemas/subscription-mode";
import { applyOfficialSubscription, mergeSemiSubscription } from "@/lib/semi-subscription-storage";

const CHANNEL_ID = "UCBJycsmduvYEL83R_U4JriQ";
const CREATED_AT = 1_700_000_000_000;
const NOW = 1_800_000_000_000;
const AVATAR_URL = "https://yt3.googleusercontent.com/avatar=s88-c-k-c0x00ffffff-no-rj";

const IPHONE_FILTER: RegexFilter = {
  kind: FilterKind.REGEX,
  pattern: "iphone",
  flags: "i"
};

const PREVIOUS: SemiSubscription = {
  channelId: CHANNEL_ID,
  title: "Marques Brownlee",
  handle: "@mkbhd",
  avatarUrl: AVATAR_URL,
  followFilter: IPHONE_FILTER,
  hideFilter: {
    kind: FilterKind.REGEX,
    pattern: "shorts",
    flags: "i"
  },
  createdAt: CREATED_AT,
  isSubscribed: false
};

const REVIEW_FILTER: RegexFilter = {
  kind: FilterKind.REGEX,
  pattern: "review",
  flags: ""
};

describe("mergeSemiSubscription", () => {
  it("creates a followed semi-subscription stamped now, with no hide filter set", () => {
    expect(
      mergeSemiSubscription({
        previous: undefined,
        channel: {
          channelId: CHANNEL_ID,
          title: "Marques Brownlee",
          handle: "@mkbhd"
        },
        mode: SubscriptionMode.FOLLOW,
        filter: REVIEW_FILTER,
        now: NOW
      })
    ).toEqual({
      channelId: CHANNEL_ID,
      title: "Marques Brownlee",
      handle: "@mkbhd",
      followFilter: REVIEW_FILTER,
      hideFilter: null,
      createdAt: NOW,
      isSubscribed: false
    });
  });

  it("creates a subscribed one when it is first saved in hide mode, with no follow filter set", () => {
    expect(
      mergeSemiSubscription({
        previous: undefined,
        channel: {
          channelId: CHANNEL_ID,
          title: "Marques Brownlee"
        },
        mode: SubscriptionMode.HIDE,
        filter: REVIEW_FILTER,
        now: NOW
      })
    ).toEqual({
      channelId: CHANNEL_ID,
      title: "Marques Brownlee",
      followFilter: null,
      hideFilter: REVIEW_FILTER,
      createdAt: NOW,
      isSubscribed: true
    });
  });

  it("edits only the given mode's filter, keeping createdAt, the avatar and the handle from before", () => {
    expect(
      mergeSemiSubscription({
        previous: PREVIOUS,
        channel: {
          channelId: CHANNEL_ID,
          title: "Marques Brownlee"
        },
        mode: SubscriptionMode.HIDE,
        filter: REVIEW_FILTER,
        now: NOW
      })
    ).toEqual({
      ...PREVIOUS,
      hideFilter: REVIEW_FILTER
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
      mode: SubscriptionMode.FOLLOW,
      filter: IPHONE_FILTER,
      now: NOW
    });
    expect(merged).toMatchObject({
      title: "MKBHD",
      handle: "@marques",
      avatarUrl: "https://yt3.googleusercontent.com/new=s88",
      createdAt: CREATED_AT,
      isSubscribed: false
    });
  });

  it("keeps the subscription state when a filter is edited in the other mode", () => {
    expect(
      mergeSemiSubscription({
        previous: {
          ...PREVIOUS,
          isSubscribed: true
        },
        channel: PREVIOUS,
        mode: SubscriptionMode.FOLLOW,
        filter: REVIEW_FILTER,
        now: NOW
      }).isSubscribed
    ).toBe(true);
  });
});

describe("applyOfficialSubscription", () => {
  const subscriptions = { [CHANNEL_ID]: PREVIOUS };

  it("switches to hiding on an official subscribe, keeping both filters", () => {
    expect(
      applyOfficialSubscription({
        subscriptions,
        channelId: CHANNEL_ID,
        isSubscribed: true
      })
    ).toEqual({
      [CHANNEL_ID]: {
        ...PREVIOUS,
        isSubscribed: true
      }
    });
  });

  it("switches back to following on an official unsubscribe", () => {
    expect(
      applyOfficialSubscription({
        subscriptions: {
          [CHANNEL_ID]: {
            ...PREVIOUS,
            isSubscribed: true
          }
        },
        channelId: CHANNEL_ID,
        isSubscribed: false
      })
    ).toEqual(subscriptions);
  });

  it("leaves channels that aren't semi-subscribed, and unchanged ones, as they are", () => {
    expect(
      applyOfficialSubscription({
        subscriptions,
        channelId: "UCXuqSBlHAE6Xw-yeJA0Tunw",
        isSubscribed: true
      })
    ).toBe(subscriptions);
    expect(
      applyOfficialSubscription({
        subscriptions,
        channelId: CHANNEL_ID,
        isSubscribed: false
      })
    ).toBe(subscriptions);
  });
});
