import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CHANNEL_ID,
  desktopFeedItem,
  feedVideo,
  mobileShortsShelf,
  NOW,
  richItem,
  shortsShelf,
  videoId
} from "#feed/fixtures/feed-fixtures";
import { rendererFromGridItem } from "#feed/items/feed-items";
import { getAiFilterKey } from "@/lib/filter/ai-filter-key";
import { type AiFilter, DEFAULT_TITLE_FILTER, FilterKind, type TitleFilter } from "@/lib/filter/title-filter";
import type { PageState } from "@/lib/messaging/page-messaging";

type FeedSession = typeof import("#feed/feed-session");

/** The channels this tab's YouTube data says the user is subscribed to, or not */
const officialSubscriptions = new Map<string, boolean>();

vi.mock("#channel-button", () => ({
  readOfficialSubscription: (channelId: string) => officialSubscriptions.get(channelId)
}));

/** The titles the channels' own tabs show, by video id - what a loaded native renderer would carry */
const nativeTitles = new Map<string, string>();

vi.mock("#feed/channel-natives", async importOriginal => ({
  ...(await importOriginal<typeof import("#feed/channel-natives")>()),
  findNativeRenderer({ videoId: id }: { videoId: string }) {
    const title = nativeTitles.get(id);
    return title === undefined
      ? null
      : rendererFromGridItem(
          desktopFeedItem({
            index: Number(id.slice(-6)),
            published: PUBLISHED,
            channelId: CHANNEL_ID,
            title
          })
        );
  }
}));

const OTHER_CHANNEL_ID = "UCalreadysubscribedchan2";
const PUBLISHED = "2 hours ago";
const KEEP_FILTER: TitleFilter = {
  kind: FilterKind.REGEX,
  pattern: "keep",
  flags: "i"
};
const AI_FILTER: AiFilter = {
  kind: FilterKind.AI_MATCH,
  description: "Only reviews"
};

let session: FeedSession;

function pageState({
  isSubscribed,
  followedUploads,
  filter = isSubscribed ? DEFAULT_TITLE_FILTER : KEEP_FILTER,
  hideFilter = DEFAULT_TITLE_FILTER,
  isAiEnabled = false,
  aiVerdicts = {}
}: Pick<PageState, "followedUploads"> &
  Partial<Pick<PageState, "isAiEnabled" | "aiVerdicts">> & {
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
    followedUploads,
    hiddenVideoIds: []
  };
  return state;
}

function semiChannelItem({ index, title }: { index: number; title?: string }) {
  return desktopFeedItem({
    index,
    published: PUBLISHED,
    channelId: CHANNEL_ID,
    title
  });
}

/** The cached upload the filter passed; its tile's title doesn't say so, only the cache does */
const CACHED_PASSING_VIDEO = {
  ...feedVideo({
    index: 1,
    hours: 2
  }),
  title: "Keep: the cached title passes"
};

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  nativeTitles.clear();
  officialSubscriptions.clear();
  vi.resetModules();
  session = await import("#feed/feed-session");
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

describe("findHiddenVideoIds", () => {
  const hideFilter: TitleFilter = {
    kind: FilterKind.REGEX,
    pattern: "^hide",
    flags: "i"
  };

  function hidingState(overrides: Partial<Pick<PageState, "hiddenVideoIds" | "isExtensionEnabled">> = {}) {
    const state = pageState({
      isSubscribed: true,
      followedUploads: []
    });
    const hiding: PageState = {
      ...state,
      ...overrides,
      subscriptions: {
        [CHANNEL_ID]: {
          channelId: CHANNEL_ID,
          title: "Subscribed Channel",
          followFilter: KEEP_FILTER,
          hideFilter: hideFilter,
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

  function collaborationWith({
    index,
    title,
    guestChannelId
  }: {
    index: number;
    title: string;
    guestChannelId: string;
  }) {
    return richItem({
      ...semiChannelItem({
        index,
        title
      }).richItemRenderer.content,
      collaborator: {
        browseEndpoint: {
          browseId: guestChannelId
        }
      }
    });
  }

  it("shows a collaboration a plain YouTube subscription on it keeps, though a filtered channel would hide it", () => {
    officialSubscriptions.set(OTHER_CHANNEL_ID, true);
    expect(
      session.findHiddenVideoIds({
        contents: [
          collaborationWith({
            index: 4,
            title: "Hide this collab",
            guestChannelId: OTHER_CHANNEL_ID
          })
        ],
        state: hidingState()
      })
    ).toEqual(new Set());
  });

  it("hides a collaboration only when every subscribed channel on it would hide it", () => {
    const state = hidingState();
    function withSecondChannel(hideFilter: TitleFilter) {
      const hiding: PageState = {
        ...state,
        subscriptions: {
          ...state.subscriptions,
          [OTHER_CHANNEL_ID]: {
            channelId: OTHER_CHANNEL_ID,
            title: "Second Channel",
            followFilter: null,
            hideFilter,
            createdAt: 1,
            isSubscribed: true
          }
        }
      };
      return hiding;
    }
    const contents = [
      collaborationWith({
        index: 4,
        title: "Hide this live collab",
        guestChannelId: OTHER_CHANNEL_ID
      })
    ];
    expect(
      session.findHiddenVideoIds({
        contents,
        state: withSecondChannel({
          kind: FilterKind.REGEX,
          pattern: "^unboxing",
          flags: "i"
        })
      })
    ).toEqual(new Set());
    expect(
      session.findHiddenVideoIds({
        contents,
        state: withSecondChannel({
          kind: FilterKind.REGEX,
          pattern: "live",
          flags: "i"
        })
      })
    ).toEqual(new Set([videoId(4)]));
  });

  it("keeps a collaboration it showed once, though a later page lacks it and the cached uploads hide it", () => {
    officialSubscriptions.set(OTHER_CHANNEL_ID, true);
    const state = hidingState({ hiddenVideoIds: [videoId(4)] });
    session.findHiddenVideoIds({
      contents: [
        collaborationWith({
          index: 4,
          title: "Hide this collab",
          guestChannelId: OTHER_CHANNEL_ID
        })
      ],
      state
    });
    expect(
      session.findHiddenVideoIds({
        contents: [],
        state
      })
    ).toEqual(new Set());
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
  const hideFilter: TitleFilter = {
    kind: FilterKind.REGEX,
    pattern: "^hide",
    flags: "i"
  };

  it("takes a hidden video out of the feed", () => {
    const state = pageState({
      isSubscribed: true,
      followedUploads: [],
      hideFilter: hideFilter
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
      followedUploads: []
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
        followedUploads: [],
        hideFilter: hideFilter
      })
    );
    expect(session.takeHideSettingsChange()).toBe(true);
    expect(session.takeHideSettingsChange()).toBe(false);

    session.trackHideSettings(
      pageState({
        isSubscribed: false,
        followedUploads: [],
        hideFilter: hideFilter
      })
    );
    expect(session.takeHideSettingsChange()).toBe(true);
  });
});
