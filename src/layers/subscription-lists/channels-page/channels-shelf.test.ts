import { readSemiChannelId, withSemiChannelsSection } from "./channels-shelf";
import { FilterKind } from "@/lib/filter/title-filter";
import type { SemiSubscription } from "@/lib/schemas/semi-subscription";
import { describe, expect, it } from "vitest";

const FOLLOWED: SemiSubscription = {
  channelId: "UCzXwjTI6c6mVn6oui_p6oiw",
  title: "SMii7Y",
  handle: "SMii7Y",
  avatarUrl: "https://yt3.ggpht.com/smii7y=s176",
  followFilter: {
    kind: FilterKind.regex,
    pattern: "horror",
    flags: "i"
  },
  hideFilter: null,
  createdAt: 1,
  isSubscribed: false
};

const FILTERED: SemiSubscription = {
  channelId: "UCO6nDCimkF79NZRRb8YiDcA",
  title: "Storied",
  followFilter: null,
  hideFilter: {
    kind: FilterKind.aiMatch,
    description: "Livestreams"
  },
  createdAt: 2,
  isSubscribed: true
};

const YOUTUBE_SECTION = {
  itemSectionRenderer: {
    contents: [{
      shelfRenderer: {}
    }]
  }
};
const CONTINUATION = {
  continuationItemRenderer: {}
};
const LIST_DATA = {
  contents: [YOUTUBE_SECTION, CONTINUATION],
  subMenu: {
    chipBarViewModel: {}
  }
};

function channelRenderers(data: unknown) {
  const listed = JSON.parse(JSON.stringify(data));
  return listed.contents[0].itemSectionRenderer.contents[0].shelfRenderer.content.expandedShelfContentsRenderer.items
    .map((item: { channelRenderer: unknown }) => item.channelRenderer);
}

describe("withSemiChannelsSection", () => {
  const listed = withSemiChannelsSection({
    data: LIST_DATA,
    subscriptions: [FOLLOWED, FILTERED],
    isAiEnabled: false
  });

  it("puts a shelf of YouTube channel rows first, keeping the rest of the page's data", () => {
    expect(listed).toHaveProperty("subMenu", LIST_DATA.subMenu);
    expect(listed?.contents.slice(1)).toEqual([YOUTUBE_SECTION, CONTINUATION]);
    expect(JSON.stringify(listed?.contents[0])).toContain("\"text\":\"Semi-subscriptions\"");
  });

  it("words each row with its handle, mode, filter and manage button", () => {
    const [followed, filtered] = channelRenderers(listed);
    expect(followed).toMatchObject({
      channelId: FOLLOWED.channelId,
      title: {
        simpleText: "SMii7Y"
      },
      subscriberCountText: {
        simpleText: "@SMii7Y"
      },
      videoCountText: {
        simpleText: "Follow without subscribing"
      },
      descriptionSnippet: {
        runs: [{ text: "/horror/i" }]
      },
      thumbnail: {
        thumbnails: [{ url: FOLLOWED.avatarUrl }]
      },
      subscribeButton: {
        buttonRenderer: {
          text: {
            runs: [{ text: "Semi-subscribed" }]
          }
        }
      }
    });
    expect(filtered).toMatchObject({
      videoCountText: {
        simpleText: "Subscribe with a filter"
      },
      descriptionSnippet: {
        runs: [{ text: "AI: Livestreams (paused)" }]
      }
    });
    expect(filtered).not.toHaveProperty("subscriberCountText");
    expect(filtered).not.toHaveProperty("thumbnail");
  });

  it("leaves data alone that already lists the same channels the same way", () => {
    expect(
      withSemiChannelsSection({
        data: listed,
        subscriptions: [FOLLOWED, FILTERED],
        isAiEnabled: false
      })
    ).toBeNull();
  });

  it("rebuilds the section when a channel's filter or AI match changes, and puts it back first after a re-sort", () => {
    const edited = withSemiChannelsSection({
      data: listed,
      subscriptions: [FOLLOWED, FILTERED],
      isAiEnabled: true
    });
    expect(channelRenderers(edited)[1].descriptionSnippet.runs[0].text).toBe("AI: Livestreams");
    expect(edited?.contents).toHaveLength(3);

    const resorted = withSemiChannelsSection({
      data: {
        ...LIST_DATA,
        contents: [YOUTUBE_SECTION, listed?.contents[0], CONTINUATION]
      },
      subscriptions: [FOLLOWED, FILTERED],
      isAiEnabled: false
    });
    expect(resorted?.contents.slice(1)).toEqual([YOUTUBE_SECTION, CONTINUATION]);
  });

  it("takes the section out when there is nothing to list", () => {
    expect(
      withSemiChannelsSection({
        data: listed,
        subscriptions: [],
        isAiEnabled: false
      })?.contents
    ).toEqual([YOUTUBE_SECTION, CONTINUATION]);
    expect(
      withSemiChannelsSection({
        data: LIST_DATA,
        subscriptions: [],
        isAiEnabled: false
      })
    ).toBeNull();
  });
});

describe("readSemiChannelId", () => {
  it("names the channel of a row of ours, and nothing for YouTube's own rows", () => {
    const [followed] = channelRenderers(
      withSemiChannelsSection({
        data: LIST_DATA,
        subscriptions: [FOLLOWED],
        isAiEnabled: false
      })
    );
    expect(readSemiChannelId(followed)).toBe(FOLLOWED.channelId);
    expect(readSemiChannelId({ channelId: FOLLOWED.channelId })).toBeNull();
  });
});
