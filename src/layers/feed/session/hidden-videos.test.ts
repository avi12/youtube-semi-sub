import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as ChannelNativesNamespace from "#feed/channel-natives";
import {
  CHANNEL_ID,
  desktopFeedItem,
  mobileShortsShelf,
  richItem,
  shortsShelf,
  videoId
} from "#feed/fixtures/feed-fixtures";
import {
  AI_FILTER,
  type FeedSession,
  findNativeRendererByTitle,
  KEEP_FILTER,
  officialSubscriptions,
  OTHER_CHANNEL_ID,
  pageState,
  PUBLISHED,
  semiChannelItem,
  startSession
} from "#feed/fixtures/session-fixtures";
import { getAiFilterKey } from "@/lib/filter/ai-filter-key";
import { FilterKind, type TitleFilter } from "@/lib/filter/schema/video-filter-schema";
import type { PageState } from "@/lib/messaging/page-messaging";

vi.mock("#channel-button", () => ({
  readOfficialSubscription: (channelId: string) => officialSubscriptions.get(channelId)
}));

vi.mock("#feed/channel-natives", async importOriginal => ({
  ...(await importOriginal<typeof ChannelNativesNamespace>()),
  findNativeRenderer: findNativeRendererByTitle
}));

let session: FeedSession;

beforeEach(async () => {
  session = await startSession();
});

afterEach(() => {
  vi.useRealTimers();
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
          hideFilter,
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
      hideFilter
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
        hideFilter
      })
    );
    expect(session.takeHideSettingsChange()).toBe(true);
    expect(session.takeHideSettingsChange()).toBe(false);

    session.trackHideSettings(
      pageState({
        isSubscribed: false,
        followedUploads: [],
        hideFilter
      })
    );
    expect(session.takeHideSettingsChange()).toBe(true);
  });
});
