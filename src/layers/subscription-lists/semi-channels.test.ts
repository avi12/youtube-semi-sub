import { describe, expect, it } from "vitest";

import { DEFAULT_TITLE_FILTER, FilterKind } from "@/lib/filter/title-filter";
import type { PageState } from "@/lib/messaging/page-messaging";
import type { SemiSubscription } from "@/lib/schemas/semi-subscription";

import { getChannelPath, listFollowedSubscriptions, listSemiSubscriptions } from "./semi-channels";

function buildSubscription({ channelId, title }: { channelId: string; title: string }) {
  const subscription: SemiSubscription = {
    channelId,
    title,
    handle: `@${title}`,
    followFilter: {
      kind: FilterKind.regex,
      pattern: "news",
      flags: "i"
    },
    createdAt: 0,
    hideFilter: DEFAULT_TITLE_FILTER,
    isSubscribed: false
  };
  return subscription;
}

const ZED = buildSubscription({
  channelId: "UCaaaaaaaaaaaaaaaaaaaaaa",
  title: "zed"
});
const ALPHA = buildSubscription({
  channelId: "UCbbbbbbbbbbbbbbbbbbbbbb",
  title: "Alpha"
});

function buildState(isExtensionEnabled: boolean) {
  const state: PageState = {
    isExtensionEnabled,
    isAnimationsEnabled: true,
    isAiEnabled: false,
    aiVerdicts: {},
    subscriptions: {
      [ZED.channelId]: ZED,
      [ALPHA.channelId]: ALPHA
    },
    followedUploads: [],
    hiddenVideoIds: []
  };
  return state;
}

describe("listSemiSubscriptions", () => {
  it("lists A-Z regardless of case", () => {
    expect(listSemiSubscriptions(buildState(true)).map(({ title }) => title)).toEqual(["Alpha", "zed"]);
  });

  it("lists nothing while the extension is off or the state is not known yet", () => {
    expect(listSemiSubscriptions(buildState(false))).toEqual([]);
    expect(listSemiSubscriptions(null)).toEqual([]);
  });
});

describe("getChannelPath", () => {
  it("prefers the handle and falls back to the channel id", () => {
    expect(
      getChannelPath({
        channelId: ALPHA.channelId,
        handle: "Alpha"
      })
    ).toBe("/@Alpha");
    expect(getChannelPath({ channelId: ALPHA.channelId })).toBe(`/channel/${ALPHA.channelId}`);
  });
});

describe("listFollowedSubscriptions", () => {
  it("leaves out the channels YouTube already lists, the ones the user is subscribed to", () => {
    expect(
      listFollowedSubscriptions([
        ZED,
        {
          ...ALPHA,
          isSubscribed: true
        }
      ])
    ).toEqual([ZED]);
  });
});
