import {
  buildSemiGuideEntry,
  patchGuideItems,
  patchGuideResponse,
  readSemiGuideEntryChannelId,
  withoutCachedSubscriptionsFlyout
} from "./guide-data";
import { FilterKind } from "@/lib/filter/title-filter";
import type { SemiSubscription } from "@/lib/schemas/semi-subscription";
import { z } from "@/lib/zod";
import signedInGuide from "#subscription-lists/guide/fixtures/guide-signed-in.json";
import signedOutGuide from "#subscription-lists/guide/fixtures/guide-signed-out.json";
import { describe, expect, it } from "vitest";

const HANDLE_CHANNEL: SemiSubscription = {
  channelId: "UCX6OQ3DkcsbYNE6H8uQQuVA",
  title: "MrBeast",
  handle: "@MrBeast",
  avatarUrl: "https://yt3.ggpht.com/avatar=s88-c-k-c0x00ffffff-no-rj",
  filter: {
    kind: FilterKind.regex,
    pattern: "challenge",
    flags: "i"
  },
  createdAt: 1
};
const HANDLELESS_CHANNEL: SemiSubscription = {
  channelId: "UCBR8-60-B28hp2BmDPdntcQ",
  title: "YouTube",
  filter: {
    kind: FilterKind.regex,
    pattern: "",
    flags: "i"
  },
  createdAt: 2
};
const ENTRIES = [buildSemiGuideEntry(HANDLE_CHANNEL), buildSemiGuideEntry(HANDLELESS_CHANNEL)];
const SUBSCRIPTIONS_KEY = "guideSubscriptionsSectionRenderer";
const SECTION_KEY = "guideSectionRenderer";
/** The first title in an item: an entry's own, a section header's or a "Show more" expander's */
const FIRST_TITLE_PATTERN = /"formattedTitle":\{"simpleText":"([^"]+)"/;

const sectionItemSchema = z.record(z.string(), z.looseObject({ items: z.array(z.unknown()) }));

function cloneItems(guide: { items: unknown[] }) {
  return structuredClone(guide.items);
}

function readSectionTitles({ items, index, key }: {
  items: unknown[] | null;
  index: number;
  key: string;
}) {
  const sectionItems = sectionItemSchema.parse(items?.[index])[key]?.items ?? [];
  return sectionItems.map(item => JSON.stringify(item).match(FIRST_TITLE_PATTERN)?.[1]);
}

describe("buildSemiGuideEntry", () => {
  it("navigates through YouTube's channel endpoint and is tagged as ours", () => {
    const { guideEntryRenderer } = buildSemiGuideEntry(HANDLE_CHANNEL);

    expect(guideEntryRenderer.navigationEndpoint).toEqual({
      commandMetadata: {
        webCommandMetadata: {
          url: "/@MrBeast",
          webPageType: "WEB_PAGE_TYPE_CHANNEL",
          rootVe: 3611,
          apiUrl: "/youtubei/v1/browse"
        }
      },
      browseEndpoint: {
        browseId: HANDLE_CHANNEL.channelId,
        canonicalBaseUrl: "/@MrBeast"
      }
    });
    expect(guideEntryRenderer.formattedTitle).toEqual({ simpleText: "MrBeast" });
    expect(readSemiGuideEntryChannelId(guideEntryRenderer)).toBe(HANDLE_CHANNEL.channelId);
  });

  it("leaves out the guide entry id YouTube keys subscribe actions on", () => {
    expect(buildSemiGuideEntry(HANDLE_CHANNEL).guideEntryRenderer).not.toHaveProperty("entryData");
  });

  it("uses the avatar when there is one and a generic icon otherwise", () => {
    expect(buildSemiGuideEntry(HANDLE_CHANNEL).guideEntryRenderer).toHaveProperty("thumbnail.thumbnails.0.url", HANDLE_CHANNEL.avatarUrl);

    const { guideEntryRenderer } = buildSemiGuideEntry(HANDLELESS_CHANNEL);
    expect(guideEntryRenderer).toHaveProperty("icon.iconType", "ACCOUNT_CIRCLE");
    expect(guideEntryRenderer.navigationEndpoint.commandMetadata.webCommandMetadata.url)
      .toBe(`/channel/${HANDLELESS_CHANNEL.channelId}`);
  });

  it("does not mistake YouTube's own entries for ours", () => {
    expect(
      readSemiGuideEntryChannelId({
        formattedTitle: {
          simpleText: "Home"
        }
      })
    ).toBeNull();
  });
});

describe("patchGuideItems - signed in", () => {
  it("puts semi-subscriptions right after the Subscriptions header, where YouTube adds new subscriptions", () => {
    const patched = patchGuideItems({
      items: cloneItems(signedInGuide),
      entries: ENTRIES
    });

    expect(
      readSectionTitles({
        items: patched,
        index: 1,
        key: SUBSCRIPTIONS_KEY
      })
    ).toEqual(["Subscriptions", "MrBeast", "YouTube", "DrGameria", "Show more"]);
  });

  it("keeps every other section by reference so Polymer re-renders only the Subscriptions section", () => {
    const items = cloneItems(signedInGuide);
    const patched = patchGuideItems({
      items,
      entries: ENTRIES
    });

    expect(patched?.[0]).toBe(items[0]);
    expect(patched?.[2]).toBe(items[2]);
    expect(patched?.[1]).not.toBe(items[1]);
  });

  it("returns null once the entries are in place", () => {
    const patched = patchGuideItems({
      items: cloneItems(signedInGuide),
      entries: ENTRIES
    }) ?? [];

    expect(
      patchGuideItems({
        items: patched,
        entries: ENTRIES
      })
    ).toBeNull();
    expect(
      patchGuideItems({
        items: structuredClone(patched),
        entries: ENTRIES
      })
    ).toBeNull();
  });

  it("updates and removes only its own entries", () => {
    const patched = patchGuideItems({
      items: cloneItems(signedInGuide),
      entries: ENTRIES
    }) ?? [];
    const withOne = patchGuideItems({
      items: patched,
      entries: [buildSemiGuideEntry(HANDLELESS_CHANNEL)]
    });
    const withNone = patchGuideItems({
      items: patched,
      entries: []
    });

    expect(
      readSectionTitles({
        items: withOne,
        index: 1,
        key: SUBSCRIPTIONS_KEY
      })
    ).toEqual(["Subscriptions", "YouTube", "DrGameria", "Show more"]);
    expect(withNone).toEqual(cloneItems(signedInGuide));
  });

  it("falls back to the top of a Subscriptions section without a header", () => {
    const items = cloneItems(signedInGuide);
    const section = sectionItemSchema.parse(items[1])[SUBSCRIPTIONS_KEY];
    const headerless = items.with(1, {
      [SUBSCRIPTIONS_KEY]: {
        ...section,
        items: section?.items.slice(1)
      }
    });
    const patched = patchGuideItems({
      items: headerless,
      entries: ENTRIES
    });

    expect(
      readSectionTitles({
        items: patched,
        index: 1,
        key: SUBSCRIPTIONS_KEY
      })
    ).toEqual(["MrBeast", "YouTube", "DrGameria", "Show more"]);
  });

  it("does nothing without semi-subscriptions", () => {
    expect(
      patchGuideItems({
        items: cloneItems(signedInGuide),
        entries: []
      })
    ).toBeNull();
  });
});

describe("patchGuideItems - signed out (real guide response)", () => {
  it("adds a Semi-subscriptions section after the main section and the sign-in promo", () => {
    const patched = patchGuideItems({
      items: cloneItems(signedOutGuide),
      entries: ENTRIES
    });

    expect(patched).toHaveLength(signedOutGuide.items.length + 1);
    expect(patched).toHaveProperty(`2.${SECTION_KEY}.formattedTitle.simpleText`, "Semi-subscriptions");
    expect(
      readSectionTitles({
        items: patched,
        index: 2,
        key: SECTION_KEY
      })
    ).toEqual(["MrBeast", "YouTube"]);
  });

  it("is idempotent and removes its section when the list empties", () => {
    const patched = patchGuideItems({
      items: cloneItems(signedOutGuide),
      entries: ENTRIES
    }) ?? [];

    expect(
      patchGuideItems({
        items: patched,
        entries: ENTRIES
      })
    ).toBeNull();
    expect(
      patchGuideItems({
        items: patched,
        entries: []
      })
    ).toEqual(cloneItems(signedOutGuide));
  });

  it("leaves YouTube's own channel entries (Explore: Music, Gaming...) alone", () => {
    expect(
      patchGuideItems({
        items: cloneItems(signedOutGuide),
        entries: []
      })
    ).toBeNull();
  });
});

describe("patchGuideResponse", () => {
  it("keeps the rest of the response", () => {
    const patched = patchGuideResponse({
      response: structuredClone(signedInGuide),
      entries: ENTRIES
    });

    expect(patched).toHaveProperty("responseContext.maxAgeSeconds", 900);
    expect(patched?.items).toHaveLength(signedInGuide.items.length);
  });

  it("ignores anything that is not a guide response", () => {
    expect(
      patchGuideResponse({
        response: {
          contents: {}
        },
        entries: ENTRIES
      })
    ).toBeNull();
    expect(
      patchGuideResponse({
        response: null,
        entries: ENTRIES
      })
    ).toBeNull();
  });
});

describe("withoutCachedSubscriptionsFlyout", () => {
  function buildSubscriptionsSection(headerFlyout: Record<string, unknown>) {
    return [{
      guideSubscriptionsSectionRenderer: {
        items: [
          {
            guideCollapsibleSectionEntryRenderer: {
              headerEntry: {
                guideEntryRenderer: {
                  formattedTitle: {
                    simpleText: "Subscriptions"
                  },
                  entryData: {
                    guideEntryData: {
                      guideEntryId: "subscriptions-channels-header"
                    }
                  },
                  ...headerFlyout
                }
              }
            }
          },
          buildSemiGuideEntry(HANDLE_CHANNEL)
        ]
      }
    }];
  }

  const CACHED_FLYOUT = {
    mouseEnterEndpoint: {
      showSheetCommand: {
        panelLoadingStrategy: {
          inlineContent: {
            sheetViewModel: {
              content: {
                listViewModel: {
                  listItems: []
                }
              }
            }
          }
        }
      }
    },
    mouseLeaveEndpoint: {
      hideSheetCommand: {}
    }
  };

  it("drops the flyout the mini guide cached on the Subscriptions header so it gets rebuilt", () => {
    const cleared = withoutCachedSubscriptionsFlyout(buildSubscriptionsSection(CACHED_FLYOUT));

    expect(cleared).toEqual(buildSubscriptionsSection({}));
  });

  it("keeps every other item as it is", () => {
    const items = cloneItems(signedOutGuide);

    expect(withoutCachedSubscriptionsFlyout(items)).toBe(items);
    expect(withoutCachedSubscriptionsFlyout(cloneItems(signedInGuide))).toEqual(cloneItems(signedInGuide));
  });
});
