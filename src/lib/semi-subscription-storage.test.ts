import { DEFAULT_TITLE_FILTER, FilterKind, type RegexFilter } from "@/lib/filter/title-filter";
import type { SemiSubscription } from "@/lib/schemas/semi-subscription";
import { SubscriptionMode } from "@/lib/schemas/subscription-mode";
import { applyOfficialSubscription, mergeSemiSubscription } from "@/lib/semi-subscription-storage";
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
  followFilter: {
    kind: FilterKind.regex,
    pattern: "iphone",
    flags: "i"
  },
  hideFilter: {
    kind: FilterKind.regex,
    pattern: "shorts",
    flags: "i"
  },
  createdAt: CREATED_AT,
  isSubscribed: false
};

const REVIEW_FILTER: RegexFilter = {
  kind: FilterKind.regex,
  pattern: "review",
  flags: ""
};

describe("mergeSemiSubscription", () => {
  it("creates a followed semi-subscription stamped now, with an empty hide filter", () => {
    expect(
      mergeSemiSubscription({
        previous: undefined,
        channel: {
          channelId: CHANNEL_ID,
          title: "Marques Brownlee",
          handle: "@mkbhd"
        },
        mode: SubscriptionMode.follow,
        filter: REVIEW_FILTER,
        now: NOW
      })
    ).toEqual({
      channelId: CHANNEL_ID,
      title: "Marques Brownlee",
      handle: "@mkbhd",
      followFilter: REVIEW_FILTER,
      hideFilter: DEFAULT_TITLE_FILTER,
      createdAt: NOW,
      isSubscribed: false
    });
  });

  it("creates a subscribed one when it is first saved in hide mode, with an empty follow filter", () => {
    expect(
      mergeSemiSubscription({
        previous: undefined,
        channel: {
          channelId: CHANNEL_ID,
          title: "Marques Brownlee"
        },
        mode: SubscriptionMode.hide,
        filter: REVIEW_FILTER,
        now: NOW
      })
    ).toEqual({
      channelId: CHANNEL_ID,
      title: "Marques Brownlee",
      followFilter: DEFAULT_TITLE_FILTER,
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
        mode: SubscriptionMode.hide,
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
      mode: SubscriptionMode.follow,
      filter: PREVIOUS.followFilter,
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
        mode: SubscriptionMode.follow,
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
