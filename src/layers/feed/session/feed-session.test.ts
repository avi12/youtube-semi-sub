import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as ChannelNativesNamespace from "#feed/channel-natives";
import { desktopFeedItem, feedVideo, richItem, videoId } from "#feed/fixtures/feed-fixtures";
import {
  AI_FILTER,
  type FeedSession,
  findNativeRendererByTitle,
  KEEP_FILTER,
  nativeTitles,
  officialSubscriptions,
  OTHER_CHANNEL_ID,
  pageState,
  PUBLISHED,
  semiChannelItem,
  startSession
} from "#feed/fixtures/session-fixtures";
import { getAiFilterKey } from "@/lib/filter/ai-filter-key";
import { FilterKind } from "@/lib/filter/schema/video-filter-schema";
import type { PageState } from "@/lib/messaging/page-messaging";

vi.mock("#channel-button", () => ({
  readOfficialSubscription: (channelId: string) => officialSubscriptions.get(channelId)
}));

vi.mock("#feed/channel-natives", async importOriginal => ({
  ...(await importOriginal<typeof ChannelNativesNamespace>()),
  findNativeRenderer: findNativeRendererByTitle
}));

/** The cached upload the filter passed; its tile's title doesn't say so, only the cache does */
const CACHED_PASSING_VIDEO = {
  ...feedVideo({
    index: 1,
    hours: 2
  }),
  title: "Keep: the cached title passes"
};

let session: FeedSession;

beforeEach(async () => {
  session = await startSession();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("a semi-subscription switched to hiding by an official subscription", () => {
  it("leaves the videos it inserted to YouTube instead of taking them out", () => {
    session.trackSubscriptionTransitions(
      pageState({
        isSubscribed: false,
        followedUploads: [CACHED_PASSING_VIDEO]
      })
    );
    session.recordFeedChange({
      insertedIds: [CACHED_PASSING_VIDEO.videoId],
      removedIds: []
    });

    const subscribed = pageState({
      isSubscribed: true,
      followedUploads: []
    });
    session.trackSubscriptionTransitions(subscribed);
    expect(
      session.findRemovedVideoIds({
        contents: [semiChannelItem({ index: 1 })],
        state: subscribed
      })
    ).toEqual(new Set());
  });
});

describe("a semi-subscription switched back to following by an official unsubscribe", () => {
  function resume(overrides: Omit<Parameters<typeof pageState>[0], "isSubscribed" | "followedUploads"> = {}) {
    session.trackSubscriptionTransitions(
      pageState({
        ...overrides,
        isSubscribed: true,
        followedUploads: []
      })
    );
    const resumed = pageState({
      ...overrides,
      isSubscribed: false,
      followedUploads: [CACHED_PASSING_VIDEO]
    });
    session.trackSubscriptionTransitions(resumed);
    return resumed;
  }

  it("takes out only that channel's videos its filter rejects - judged by title, not by the lagging cache", () => {
    const state = resume();
    const collaboration = richItem({
      ...semiChannelItem({ index: 4 }).richItemRenderer.content,
      collaborator: {
        browseEndpoint: {
          browseId: OTHER_CHANNEL_ID
        }
      }
    });
    const contents = [
      semiChannelItem({ index: 1 }),
      semiChannelItem({ index: 2 }),
      desktopFeedItem({
        index: 3,
        published: PUBLISHED
      }),
      collaboration,
      semiChannelItem({
        index: 5,
        title: "Keep: not cached yet"
      })
    ];
    expect(
      session.findRemovedVideoIds({
        contents,
        state
      })
    ).toEqual(new Set([videoId(2)]));
  });

  it("judges a collaboration once the user is known not to be subscribed to the other channel on it", () => {
    officialSubscriptions.set(OTHER_CHANNEL_ID, false);
    const state = resume();
    const collaboration = richItem({
      ...semiChannelItem({ index: 4 }).richItemRenderer.content,
      collaborator: {
        browseEndpoint: {
          browseId: OTHER_CHANNEL_ID
        }
      }
    });
    expect(
      session.findRemovedVideoIds({
        contents: [collaboration],
        state
      })
    ).toEqual(new Set([videoId(4)]));
  });

  it("manages the passing ones like its own once the feed is clean, so a filter edit takes them out", () => {
    const state = resume();
    const contents = [
      semiChannelItem({
        index: 5,
        title: "Keep this"
      })
    ];
    session.settleResumedChannels({
      contents,
      state
    });
    expect(session.hasResumedChannels()).toBe(false);

    const editedFilter = pageState({
      isSubscribed: false,
      followedUploads: [],
      filter: {
        ...KEEP_FILTER,
        pattern: "something else"
      }
    });
    session.trackSubscriptionTransitions(editedFilter);
    expect(
      session.findRemovedVideoIds({
        contents,
        state: editedFilter
      })
    ).toEqual(new Set([videoId(5)]));
  });

  it("forgets the resume when the user subscribes again first", () => {
    resume();
    const subscribed = pageState({
      isSubscribed: true,
      followedUploads: []
    });
    session.trackSubscriptionTransitions(subscribed);
    expect(session.hasResumedChannels()).toBe(false);
    expect(
      session.findRemovedVideoIds({
        contents: [semiChannelItem({ index: 2 })],
        state: subscribed
      })
    ).toEqual(new Set());
  });

  it("keeps an AI filter's video while its verdict is pending, and takes out a rejected one", () => {
    const state = resume({
      filter: AI_FILTER,
      isAiEnabled: true,
      aiVerdicts: {
        [getAiFilterKey(AI_FILTER)]: {
          [videoId(2)]: false
        }
      }
    });
    expect(
      session.findRemovedVideoIds({
        contents: [semiChannelItem({ index: 2 }), semiChannelItem({ index: 3 })],
        state
      })
    ).toEqual(new Set([videoId(2)]));
  });

  it("takes out everything a paused AI filter can't judge", () => {
    const state = resume({
      filter: AI_FILTER
    });
    expect(
      session.findRemovedVideoIds({
        contents: [semiChannelItem({ index: 2 }), semiChannelItem({ index: 3 })],
        state
      })
    ).toEqual(new Set([videoId(2), videoId(3)]));
  });
});

describe("a semi-subscription's Shorts across a subscribe and an unsubscribe", () => {
  const short = {
    ...feedVideo({
      index: 60,
      hours: 2,
      isShort: true
    }),
    title: "Keep this Short"
  };

  function subscribeAndUnsubscribe(resumedFeedVideos: PageState["followedUploads"]) {
    session.trackSubscriptionTransitions(
      pageState({
        isSubscribed: false,
        followedUploads: [short]
      })
    );
    session.recordFeedChange({
      insertedIds: [short.videoId],
      removedIds: []
    });
    const subscribed = pageState({
      isSubscribed: true,
      followedUploads: []
    });
    session.trackSubscriptionTransitions(subscribed);
    const removedWhileSubscribed = session.findRemovedVideoIds({
      contents: [],
      state: subscribed
    });
    const resumed = pageState({
      isSubscribed: false,
      followedUploads: resumedFeedVideos
    });
    session.trackSubscriptionTransitions(resumed);
    return {
      removedWhileSubscribed,
      resumed
    };
  }

  it("hands an inserted Short over to YouTube on a subscribe, and takes it back on an unsubscribe when the filter rejects it", () => {
    const { removedWhileSubscribed, resumed } = subscribeAndUnsubscribe([]);
    expect(removedWhileSubscribed).toEqual(new Set());
    expect(
      session.findRemovedVideoIds({
        contents: [],
        state: resumed
      })
    ).toEqual(new Set([short.videoId]));
  });

  it("manages a passing Short again after the resume, so a later filter edit takes it out", () => {
    const { resumed } = subscribeAndUnsubscribe([short]);
    expect(
      session.findRemovedVideoIds({
        contents: [],
        state: resumed
      })
    ).toEqual(new Set());

    const editedFilter = pageState({
      isSubscribed: false,
      followedUploads: [],
      filter: {
        ...KEEP_FILTER,
        pattern: "something else"
      }
    });
    session.trackSubscriptionTransitions(editedFilter);
    expect(
      session.findRemovedVideoIds({
        contents: [],
        state: editedFilter
      })
    ).toEqual(new Set([short.videoId]));
  });
});

describe("a title YouTube tests against another", () => {
  it("follows a video by the title its tile will show, not the cached one", () => {
    const cachedPassing = {
      ...feedVideo({
        index: 7,
        hours: 1
      }),
      title: "Keep: the cached title"
    };
    const cachedFailing = feedVideo({
      index: 8,
      hours: 2
    });
    nativeTitles.set(cachedPassing.videoId, "A title the filter rejects");
    nativeTitles.set(cachedFailing.videoId, "Keep: the title shown");
    const state = pageState({
      isSubscribed: false,
      followedUploads: [cachedPassing, cachedFailing]
    });
    const plan = session.planForPageState({
      contents: [
        desktopFeedItem({
          index: 3,
          published: "1 day ago"
        })
      ],
      state,
      removedVideoIds: new Set()
    });
    expect(plan.insertedVideos.map(video => [video.videoId, video.title])).toEqual([
      [cachedFailing.videoId, "Keep: the title shown"]
    ]);
  });

  it("keeps a tile whose shown title the hide filter rejects, though its cached title matched", () => {
    const state: PageState = {
      ...pageState({
        isSubscribed: true,
        followedUploads: [],
        hideFilter: {
          kind: FilterKind.REGEX,
          pattern: "^hide",
          flags: "i"
        }
      }),
      hiddenVideoIds: [videoId(1), videoId(2)]
    };
    expect(
      session.findHiddenVideoIds({
        contents: [
          semiChannelItem({
            index: 1,
            title: "A title the hide filter rejects"
          })
        ],
        state
      })
    ).toEqual(new Set([videoId(2)]));
  });
});
