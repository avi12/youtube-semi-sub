import { getAiFilterKey } from "@/lib/filter/ai-filter-key";
import { type AiFilter, DEFAULT_TITLE_FILTER, FilterKind, type TitleFilter } from "@/lib/filter/title-filter";
import type { PageState } from "@/lib/messaging/page-messaging";
import {
  CHANNEL_ID,
  desktopFeedItem,
  feedVideo,
  mobileShortsShelf,
  richItem,
  shortsShelf,
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

function pageState({
  isSubscribed,
  feedVideos,
  filter = KEEP_FILTER,
  hideFilter = DEFAULT_TITLE_FILTER,
  isAiEnabled = false,
  aiVerdicts = {}
}: Pick<PageState, "feedVideos"> & Partial<Pick<PageState, "isAiEnabled" | "aiVerdicts">> & {
  isSubscribed: boolean;
  filter?: TitleFilter;
  hideFilter?: TitleFilter;
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
        hideFilter,
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

describe("findHiddenVideoIds", () => {
  const HIDE_FILTER: TitleFilter = {
    kind: FilterKind.regex,
    pattern: "^hide",
    flags: "i"
  };

  function hidingState(overrides: Partial<Pick<PageState, "hiddenVideoIds" | "isExtensionEnabled">> = {}) {
    const state = pageState({
      isSubscribed: true,
      feedVideos: []
    });
    const hiding: PageState = {
      ...state,
      ...overrides,
      subscriptions: {
        [CHANNEL_ID]: {
          channelId: CHANNEL_ID,
          title: "Subscribed Channel",
          followFilter: KEEP_FILTER,
          hideFilter: HIDE_FILTER,
          createdAt: 1,
          isSubscribed: true
        }
      }
    };
    return hiding;
  }

  it("hides a subscribed channel's tile by its title, and leaves other channels' tiles alone", () => {
    expect(
      session.findHiddenVideoIds({
        contents: [
          semiChannelItem({
            index: 1,
            title: "Hide me"
          }),
          semiChannelItem({
            index: 2,
            title: "Keep me"
          }),
          desktopFeedItem({
            index: 3,
            published: PUBLISHED,
            title: "Hide me too, but I'm another channel's"
          })
        ],
        state: hidingState()
      })
    ).toEqual(new Set([videoId(1)]));
  });

  it("hides a collaboration its hide filter matches, whether the channel uploaded it or is a guest on it", () => {
    const uploadedCollaboration = richItem({
      ...semiChannelItem({
        index: 4,
        title: "Hide this collab"
      }).richItemRenderer.content,
      collaborator: {
        browseEndpoint: {
          browseId: OTHER_CHANNEL_ID
        }
      }
    });
    const guestCollaboration = richItem({
      ...desktopFeedItem({
        index: 5,
        published: PUBLISHED,
        title: "Hide this guest spot"
      }).richItemRenderer.content,
      collaborator: {
        browseEndpoint: {
          browseId: CHANNEL_ID
        }
      }
    });
    const keptCollaboration = richItem({
      ...desktopFeedItem({
        index: 6,
        published: PUBLISHED,
        title: "Keep this guest spot"
      }).richItemRenderer.content,
      collaborator: {
        browseEndpoint: {
          browseId: CHANNEL_ID
        }
      }
    });
    expect(
      session.findHiddenVideoIds({
        contents: [uploadedCollaboration, guestCollaboration, keptCollaboration],
        state: hidingState()
      })
    ).toEqual(new Set([videoId(4), videoId(5)]));
  });

  it("hides a Short in either site's Shorts shelf by the cached uploads, as it names no channel", () => {
    const state = hidingState({ hiddenVideoIds: [videoId(91), videoId(93)] });
    expect(
      session.findHiddenVideoIds({
        contents: [shortsShelf([90, 91]), mobileShortsShelf([92, 93])],
        state
      })
    ).toEqual(new Set([videoId(91), videoId(93)]));
  });

  it("lists every cached upload the hide filter hides, also one the page doesn't hold", () => {
    expect(
      session.findHiddenVideoIds({
        contents: [shortsShelf([90])],
        state: hidingState({ hiddenVideoIds: [videoId(91)] })
      })
    ).toEqual(new Set([videoId(91)]));
  });

  it("hides nothing while the extension is off", () => {
    expect(
      session.findHiddenVideoIds({
        contents: [
          semiChannelItem({
            index: 1,
            title: "Hide me"
          }),
          shortsShelf([91])
        ],
        state: hidingState({
          hiddenVideoIds: [videoId(91)],
          isExtensionEnabled: false
        })
      })
    ).toEqual(new Set());
  });
});

describe("hiding in the live feed", () => {
  const HIDE_FILTER: TitleFilter = {
    kind: FilterKind.regex,
    pattern: "^hide",
    flags: "i"
  };

  it("takes a hidden video out of the feed", () => {
    const state = pageState({
      isSubscribed: true,
      feedVideos: [],
      hideFilter: HIDE_FILTER
    });
    expect(
      session.findRemovedVideoIds({
        contents: [
          semiChannelItem({
            index: 1,
            title: "Hide me"
          }),
          semiChannelItem({ index: 2 })
        ],
        state
      })
    ).toEqual(new Set([videoId(1)]));
  });

  it("reports an edited hide filter or a switched mode once, and nothing for a first state or other changes", () => {
    const subscribed = pageState({
      isSubscribed: true,
      feedVideos: []
    });
    session.trackHideSettings(subscribed);
    expect(session.takeHideSettingsChange()).toBe(false);

    session.trackHideSettings({
      ...subscribed,
      aiVerdicts: {
        [getAiFilterKey(AI_FILTER)]: {}
      }
    });
    expect(session.takeHideSettingsChange()).toBe(false);

    session.trackHideSettings(
      pageState({
        isSubscribed: true,
        feedVideos: [],
        hideFilter: HIDE_FILTER
      })
    );
    expect(session.takeHideSettingsChange()).toBe(true);
    expect(session.takeHideSettingsChange()).toBe(false);

    session.trackHideSettings(
      pageState({
        isSubscribed: false,
        feedVideos: [],
        hideFilter: HIDE_FILTER
      })
    );
    expect(session.takeHideSettingsChange()).toBe(true);
  });
});
