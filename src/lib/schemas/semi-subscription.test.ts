import { FilterKind } from "@/lib/filter/title-filter";
import { migrateSemiSubscriptionsToV2, semiSubscriptionsSchema } from "@/lib/schemas/semi-subscription";
import { describe, expect, it } from "vitest";

const REGEX_CHANNEL_ID = "UCBJycsmduvYEL83R_U4JriQ";
const AI_CHANNEL_ID = "UCXuqSBlHAE6Xw-yeJA0Tunw";
const CREATED_AT = 1_700_000_000_000;

const CHANNEL = {
  channelId: REGEX_CHANNEL_ID,
  title: "Marques Brownlee",
  handle: "@mkbhd",
  createdAt: CREATED_AT
};

describe("migrateSemiSubscriptionsToV2", () => {
  it("reads a filter saved without a kind as a RegExp filter", () => {
    const migrated = migrateSemiSubscriptionsToV2({
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
        filter: {
          kind: FilterKind.regex,
          pattern: "review",
          flags: "i"
        }
      }
    });
  });

  it("keeps filters that already have a kind, next to ones that don't", () => {
    const aiSubscription = {
      ...CHANNEL,
      channelId: AI_CHANNEL_ID,
      title: "Linus Tech Tips",
      handle: "@LinusTechTips",
      filter: {
        kind: FilterKind.aiMatch,
        description: "Only GPU reviews"
      }
    };
    const migrated = migrateSemiSubscriptionsToV2({
      [REGEX_CHANNEL_ID]: {
        ...CHANNEL,
        filter: {
          pattern: "iphone",
          flags: ""
        }
      },
      [AI_CHANNEL_ID]: aiSubscription
    });

    expect(semiSubscriptionsSchema.parse(migrated)).toEqual({
      [REGEX_CHANNEL_ID]: {
        ...CHANNEL,
        filter: {
          kind: FilterKind.regex,
          pattern: "iphone",
          flags: ""
        }
      },
      [AI_CHANNEL_ID]: aiSubscription
    });
  });

  it("leaves a value it can't read untouched", () => {
    expect(migrateSemiSubscriptionsToV2("not a record")).toBe("not a record");
  });
});
