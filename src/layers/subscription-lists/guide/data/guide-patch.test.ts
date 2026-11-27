import { describe, expect, it } from "vitest";

import { buildSemiGuideEntry } from "#subscription-lists/guide/data/semi-guide-entries";
import {
  cloneItems,
  ENTRIES,
  HANDLELESS_CHANNEL,
  readSectionTitles,
  SECTION_KEY,
  sectionItemSchema,
  SUBSCRIPTIONS_KEY
} from "#subscription-lists/guide/fixtures/guide-fixtures";
import signedInGuide from "#subscription-lists/guide/fixtures/guide-signed-in.json";
import signedOutGuide from "#subscription-lists/guide/fixtures/guide-signed-out.json";
import { z } from "@/lib/zod";

import { patchGuideItems, patchGuideResponse } from "./guide-patch";

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
    const patched =
      patchGuideItems({
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
    const patched =
      patchGuideItems({
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

describe("patchGuideItems - a subscribed channel with a working filter", () => {
  const PINNED_CHANNEL_ID = "UCjkyfFH-MWZhasolgds05EA";

  it('brings YouTube\'s own entry up from "Show more" to sit right after the header', () => {
    const patched = patchGuideItems({
      items: cloneItems(signedInGuide),
      entries: [],
      pinnedChannelIds: new Set([PINNED_CHANNEL_ID])
    });

    const [title] = readSectionTitles({
      items: patched,
      index: 1,
      key: SUBSCRIPTIONS_KEY
    }).slice(1);
    expect(title).toBe("*NSYNC");
    expect(JSON.stringify(patched).split(PINNED_CHANNEL_ID)).toHaveLength(
      JSON.stringify(signedInGuide).split(PINNED_CHANNEL_ID).length
    );
  });

  it("returns null once it is in place", () => {
    const pinnedChannelIds = new Set([PINNED_CHANNEL_ID]);
    const patched = patchGuideItems({
      items: cloneItems(signedInGuide),
      entries: [],
      pinnedChannelIds
    });

    expect(
      patchGuideItems({
        items: z.array(z.unknown()).parse(patched),
        entries: [],
        pinnedChannelIds
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
    const patched =
      patchGuideItems({
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
