import { getChannelPath, listSemiSubscriptions, toChannelInfo } from "./semi-channels";
import type { PageState } from "@/lib/messaging/page-messaging";
import type { SemiSubscription } from "@/lib/semi-subscription";
import { describe, expect, it } from "vitest";

function buildSubscription({ channelId, title }: {
  channelId: string;
  title: string;
}) {
  const subscription: SemiSubscription = {
    channelId,
    title,
    handle: `@${title}`,
    filter: {
      pattern: "news",
      flags: "i"
    },
    createdAt: 0
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
    subscriptions: {
      [ZED.channelId]: ZED,
      [ALPHA.channelId]: ALPHA
    },
    feedVideos: []
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

describe("toChannelInfo", () => {
  it("drops the filter and timestamps the dialog does not take", () => {
    expect(toChannelInfo(ALPHA)).toEqual({
      channelId: ALPHA.channelId,
      title: "Alpha",
      handle: "@Alpha",
      avatarUrl: undefined
    });
  });
});
