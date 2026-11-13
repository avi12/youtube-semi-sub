import { describe, expect, it } from "vitest";

import { DEFAULT_TITLE_FILTER, FilterKind } from "@/lib/filter/title-filter";
import type { SemiSubscription } from "@/lib/schemas/semi-subscription";
import { SubscriptionMode } from "@/lib/schemas/subscription-mode";

import { describeChannelButton } from "./button-label";

const SUBSCRIPTION: SemiSubscription = {
  channelId: "UCBJycsmduvYEL83R_U4JriQ",
  title: "Marques Brownlee",
  followFilter: DEFAULT_TITLE_FILTER,
  hideFilter: DEFAULT_TITLE_FILTER,
  createdAt: 0,
  isSubscribed: true
};

function labelFor({ subscription, mode }: Pick<Parameters<typeof describeChannelButton>[0], "subscription" | "mode">) {
  return describeChannelButton({
    channelTitle: "Marques Brownlee",
    subscription,
    mode
  }).label;
}

describe("describeChannelButton", () => {
  it("offers to semi-subscribe on a channel the user follows, or could", () => {
    expect(
      labelFor({
        subscription: undefined,
        mode: SubscriptionMode.FOLLOW
      })
    ).toBe("Semi-subscribe");
    expect(
      labelFor({
        subscription: SUBSCRIPTION,
        mode: SubscriptionMode.FOLLOW
      })
    ).toBe("Semi-subscribed");
  });

  it("still offers to semi-subscribe while no follow filter was ever set - one first saved while subscribed", () => {
    expect(
      labelFor({
        subscription: {
          ...SUBSCRIPTION,
          followFilter: null
        },
        mode: SubscriptionMode.FOLLOW
      })
    ).toBe("Semi-subscribe");
  });

  it("reads the same on a subscribed channel, past tense once its hide filter hides something", () => {
    expect(
      labelFor({
        subscription: undefined,
        mode: SubscriptionMode.HIDE
      })
    ).toBe("Semi-subscribe");
    expect(
      labelFor({
        subscription: SUBSCRIPTION,
        mode: SubscriptionMode.HIDE
      })
    ).toBe("Semi-subscribe");
    expect(
      labelFor({
        subscription: {
          ...SUBSCRIPTION,
          hideFilter: {
            kind: FilterKind.REGEX,
            pattern: "live",
            flags: "i"
          }
        },
        mode: SubscriptionMode.HIDE
      })
    ).toBe("Semi-subscribed");
  });
});
