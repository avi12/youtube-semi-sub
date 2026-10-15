import { getAiFilterKey } from "@/lib/filter/ai-filter-key";
import { type AiFilter, DEFAULT_TITLE_FILTER, FilterKind, type TitleFilter } from "@/lib/filter/title-filter";
import type { PageState } from "@/lib/messaging/page-messaging";
import {
  CHANNEL_ID,
  desktopFeedItem,
  feedVideo,
  richItem,
  videoId
} from "#feed/fixtures/feed-fixtures";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

type FeedSession = typeof import("#feed/feed-session");

const OTHER_CHANNEL_ID = "UCalreadysubscribedchan2";
const PUBLISHED = "2 hours ago";
const KEEP_FILTER: TitleFilter = {
  kind: FilterKind.regex,
  pattern: "keep",
  flags: "i"
};
const AI_FILTER: AiFilter = {
  kind: FilterKind.aiMatch,
  description: "Only reviews"
};

let session: FeedSession;

function pageState({ isSubscribed, feedVideos, filter = KEEP_FILTER, isAiEnabled = false, aiVerdicts = {} }: Pick<
  PageState,
  "feedVideos"
> & Partial<Pick<PageState, "isAiEnabled" | "aiVerdicts">> & {
  isSubscribed: boolean;
  filter?: TitleFilter;
}) {
  const state: PageState = {
    isExtensionEnabled: true,
    isAnimationsEnabled: true,
    isAiEnabled,
    aiVerdicts,
    subscriptions: {
      [CHANNEL_ID]: {
        channelId: CHANNEL_ID,
        title: "Semi Channel",
        followFilter: filter,
        hideFilter: DEFAULT_TITLE_FILTER,
        createdAt: 1,
        isSubscribed
      }
    },
    feedVideos,
    hiddenVideoIds: []
  };
  return state;
}

function semiChannelItem({ index, title }: {
  index: number;
  title?: string;
}) {
  return desktopFeedItem({
    index,
    published: PUBLISHED,
    channelId: CHANNEL_ID,
    title
  });
}

/** The cached upload the filter passed; its tile's title doesn't say so, only the cache does */
const CACHED_PASSING_VIDEO = feedVideo({
  index: 1,
  hours: 2
});

beforeEach(async () => {
  vi.resetModules();
  session = await import("#feed/feed-session");
});

describe("a semi-subscription switched to hiding by an official subscription", () => {
  it("leaves the videos it inserted to YouTube instead of taking them out", () => {
    session.trackSubscriptionTransitions(
      pageState({
        isSubscribed: false,
        feedVideos: [CACHED_PASSING_VIDEO]
      })
    );
    session.recordFeedChange({
      insertedIds: [CACHED_PASSING_VIDEO.videoId],
      removedIds: []
    });

    const subscribed = pageState({
      isSubscribed: true,
      feedVideos: []
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
  function resume(overrides: Omit<Parameters<typeof pageState>[0], "isSubscribed" | "feedVideos"> = {}) {
    session.trackSubscriptionTransitions(
      pageState({
        ...overrides,
        isSubscribed: true,
        feedVideos: []
      })
    );
    const resumed = pageState({
      ...overrides,
      isSubscribed: false,
      feedVideos: [CACHED_PASSING_VIDEO]
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
      feedVideos: [],
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
      feedVideos: []
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
  const SHORT = feedVideo({
    index: 60,
    hours: 2,
    isShort: true
  });

  function subscribeAndUnsubscribe(resumedFeedVideos: PageState["feedVideos"]) {
    session.trackSubscriptionTransitions(
      pageState({
        isSubscribed: false,
        feedVideos: [SHORT]
      })
    );
    session.recordFeedChange({
      insertedIds: [SHORT.videoId],
      removedIds: []
    });
    const subscribed = pageState({
      isSubscribed: true,
      feedVideos: []
    });
    session.trackSubscriptionTransitions(subscribed);
    const removedWhileSubscribed = session.findRemovedVideoIds({
      contents: [],
      state: subscribed
    });
    const resumed = pageState({
      isSubscribed: false,
      feedVideos: resumedFeedVideos
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
    ).toEqual(new Set([SHORT.videoId]));
  });

  it("manages a passing Short again after the resume, so a later filter edit takes it out", () => {
    const { resumed } = subscribeAndUnsubscribe([SHORT]);
    expect(
      session.findRemovedVideoIds({
        contents: [],
        state: resumed
      })
    ).toEqual(new Set());

    const editedFilter = pageState({
      isSubscribed: false,
      feedVideos: [],
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
    ).toEqual(new Set([SHORT.videoId]));
  });
});
