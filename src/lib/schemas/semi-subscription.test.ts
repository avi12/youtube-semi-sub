import { DEFAULT_TITLE_FILTER, FilterKind, type RegexFilter } from "@/lib/filter/title-filter";
import {
  isUploadsWatched,
  migrateSemiSubscriptionsToV2,
  migrateSemiSubscriptionsToV3,
  migrateSemiSubscriptionsToV4,
  semiSubscriptionsSchema
} from "@/lib/schemas/semi-subscription";
import { describe, expect, it } from "vitest";

const REGEX_CHANNEL_ID = "UCBJycsmduvYEL83R_U4JriQ";
const AI_CHANNEL_ID = "UCXuqSBlHAE6Xw-yeJA0Tunw";
const CREATED_AT = 1_700_000_000_000;

/** Every migration from the given one up to today's shape, the way WXT runs them on an older store */
function migrateFromV1(stored: unknown) {
  return migrateSemiSubscriptionsToV4(migrateSemiSubscriptionsToV3(migrateSemiSubscriptionsToV2(stored)));
}

const CHANNEL = {
  channelId: REGEX_CHANNEL_ID,
  title: "Marques Brownlee",
  handle: "@mkbhd",
  createdAt: CREATED_AT
};

describe("migrateSemiSubscriptionsToV2", () => {
  it("reads a filter saved without a kind as a RegExp filter", () => {
    const migrated = migrateFromV1({
      [REGEX_CHANNEL_ID]: {
        ...CHANNEL,
        filter: {
          pattern: "review",
          flags: "i"
        }
      }
    });

    expect(semiSubscriptionsSchema.parse(migrated)).toEqual({
      [REGEX_CHANNEL_ID]: {
        ...CHANNEL,
        followFilter: {
          kind: FilterKind.regex,
          pattern: "review",
          flags: "i"
        },
        hideFilter: null,
        isSubscribed: false
      }
    });
  });

  it("keeps filters that already have a kind, next to ones that don't", () => {
    const aiChannel = {
      ...CHANNEL,
      channelId: AI_CHANNEL_ID,
      title: "Linus Tech Tips",
      handle: "@LinusTechTips"
    };
    const aiFilter = {
      kind: FilterKind.aiMatch,
      description: "Only GPU reviews"
    };
    const migrated = migrateFromV1({
      [REGEX_CHANNEL_ID]: {
        ...CHANNEL,
        filter: {
          pattern: "iphone",
          flags: ""
        }
      },
      [AI_CHANNEL_ID]: {
        ...aiChannel,
        filter: aiFilter
      }
    });

    expect(semiSubscriptionsSchema.parse(migrated)).toEqual({
      [REGEX_CHANNEL_ID]: {
        ...CHANNEL,
        followFilter: {
          kind: FilterKind.regex,
          pattern: "iphone",
          flags: ""
        },
        hideFilter: null,
        isSubscribed: false
      },
      [AI_CHANNEL_ID]: {
        ...aiChannel,
        followFilter: aiFilter,
        hideFilter: null,
        isSubscribed: false
      }
    });
  });

  it("leaves a value it can't read untouched", () => {
    expect(migrateSemiSubscriptionsToV2("not a record")).toBe("not a record");
  });
});

describe("migrateSemiSubscriptionsToV3", () => {
  it("adds an unhalted state to every v2 semi-subscription", () => {
    const filter = {
      kind: FilterKind.regex,
      pattern: "review",
      flags: "i"
    };

    expect(
      migrateSemiSubscriptionsToV3({
        [REGEX_CHANNEL_ID]: {
          ...CHANNEL,
          filter
        }
      })
    ).toEqual({
      [REGEX_CHANNEL_ID]: {
        ...CHANNEL,
        filter,
        isHalted: false
      }
    });
  });

  it("leaves a value it can't read untouched", () => {
    expect(migrateSemiSubscriptionsToV3("not a record")).toBe("not a record");
  });
});

describe("migrateSemiSubscriptionsToV4", () => {
  const filter = {
    kind: FilterKind.regex,
    pattern: "review",
    flags: "i"
  };

  it("keeps the filter as the follow filter and leaves the hide filter unset", () => {
    expect(
      migrateSemiSubscriptionsToV4({
        [REGEX_CHANNEL_ID]: {
          ...CHANNEL,
          filter,
          isHalted: false
        }
      })
    ).toEqual({
      [REGEX_CHANNEL_ID]: {
        ...CHANNEL,
        followFilter: filter,
        hideFilter: null,
        isSubscribed: false
      }
    });
  });

  it("reads a halt as a subscription, which hides nothing while the hide filter is unset", () => {
    expect(
      semiSubscriptionsSchema.parse(
        migrateSemiSubscriptionsToV4({
          [REGEX_CHANNEL_ID]: {
            ...CHANNEL,
            filter,
            isHalted: true
          }
        })
      )
    ).toEqual({
      [REGEX_CHANNEL_ID]: {
        ...CHANNEL,
        followFilter: filter,
        hideFilter: null,
        isSubscribed: true
      }
    });
  });

  it("leaves a value it can't read untouched", () => {
    expect(migrateSemiSubscriptionsToV4("not a record")).toBe("not a record");
  });
});

describe("isUploadsWatched", () => {
  const filter: RegexFilter = {
    kind: FilterKind.regex,
    pattern: "shorts",
    flags: "i"
  };

  it("watches a channel while its current mode's filter adds or hides something", () => {
    expect(
      isUploadsWatched({
        followFilter: DEFAULT_TITLE_FILTER,
        hideFilter: null,
        isSubscribed: false
      })
    ).toBe(true);
    expect(
      isUploadsWatched({
        followFilter: filter,
        hideFilter: filter,
        isSubscribed: true
      })
    ).toBe(true);
  });

  it("leaves a channel alone while its current mode's filter is unset, or hides nothing", () => {
    expect(
      isUploadsWatched({
        followFilter: null,
        hideFilter: filter,
        isSubscribed: false
      })
    ).toBe(false);
    expect(
      isUploadsWatched({
        followFilter: filter,
        hideFilter: null,
        isSubscribed: true
      })
    ).toBe(false);
    expect(
      isUploadsWatched({
        followFilter: filter,
        hideFilter: DEFAULT_TITLE_FILTER,
        isSubscribed: true
      })
    ).toBe(false);
  });
});
