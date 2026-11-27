import {
  guideDataSchema,
  GuideItemKey,
  subscribedChannelEntrySchema
} from "#subscription-lists/guide/data/guide-schemas";
import {
  buildSemiSection,
  isSemiGuideEntryItem,
  isSemiSectionItem
} from "#subscription-lists/guide/data/semi-guide-entries";
import {
  isSubscriptionsHeaderItem,
  readSubscriptionsSection
} from "#subscription-lists/guide/data/subscriptions-section";
import { z } from "@/lib/zod";

// The desktop guide (sidebar) and the mini guide's Subscriptions flyout both render from the /youtubei/v1/guide
// response. Semi-subscribed channels are written into that data as native guide entries, tagged so they can be
// told apart from YouTube's own, re-placed on every pass and stripped again when the extension is turned off

/** The guide opens with its main section; signed out, the sign-in promo comes next */
const SIGN_IN_PROMO_INDEX = 1;

const signInPromoItemSchema = z.looseObject({
  [GuideItemKey.SIGN_IN_PROMO]: z.looseObject({})
});

/** Same references where nothing moved; our freshly built entries compare by content */
function isSameGuideItems({ current, next }: { current: unknown[]; next: unknown[] }) {
  const isSameLength = current.length === next.length;
  return (
    isSameLength &&
    current.every((item, i) => {
      const nextItem = next[i];
      return item === nextItem || JSON.stringify(item) === JSON.stringify(nextItem);
    })
  );
}

/** The entries of ours to list, and the channel ids of YouTube's own entries to bring up beside them */
interface GuidePatch {
  items: unknown[];
  entries: unknown[];
  pinnedChannelIds: ReadonlySet<string>;
}

const collapsibleEntryItemSchema = z.looseObject({
  guideCollapsibleEntryRenderer: z.looseObject({
    expandableItems: z.array(z.unknown())
  })
});

function isPinnedItem({ item, pinnedChannelIds }: { item: unknown; pinnedChannelIds: ReadonlySet<string> }) {
  const parsed = subscribedChannelEntrySchema.safeParse(item);
  return parsed.success && pinnedChannelIds.has(parsed.data.guideEntryRenderer.entryData.guideEntryData.guideEntryId);
}

/** Splits YouTube's own entries of the pinned channels off a flat list of entries */
function splitPinnedItems({ items, pinnedChannelIds }: { items: unknown[]; pinnedChannelIds: ReadonlySet<string> }) {
  return {
    pinned: items.filter(item =>
      isPinnedItem({
        item,
        pinnedChannelIds
      })
    ),
    rest: items.filter(
      item =>
        !isPinnedItem({
          item,
          pinnedChannelIds
        })
    )
  };
}

/** The same split over a section's entries, "Show more" (one level of expandable entries) included */
function takePinnedItems({ items, pinnedChannelIds }: { items: unknown[]; pinnedChannelIds: ReadonlySet<string> }) {
  const top = splitPinnedItems({
    items,
    pinnedChannelIds
  });
  const pinned = [...top.pinned];
  const rest = top.rest.map(item => {
    const collapsible = collapsibleEntryItemSchema.safeParse(item);
    if (!collapsible.success) {
      return item;
    }

    const renderer = collapsible.data.guideCollapsibleEntryRenderer;
    const inner = splitPinnedItems({
      items: renderer.expandableItems,
      pinnedChannelIds
    });
    if (inner.pinned.length === 0) {
      return item;
    }

    pinned.push(...inner.pinned);
    return {
      ...collapsible.data,
      guideCollapsibleEntryRenderer: {
        ...renderer,
        expandableItems: inner.rest
      }
    };
  });
  return {
    rest,
    pinned
  };
}

function placeSemiEntries({ items, entries, pinnedChannelIds }: GuidePatch) {
  const { rest, pinned } = takePinnedItems({
    items: items.filter(item => !isSemiGuideEntryItem(item)),
    pinnedChannelIds
  });
  const iHeader = rest.findIndex(isSubscriptionsHeaderItem);
  const iInsert = iHeader === -1 ? 0 : iHeader + 1;
  return [...rest.slice(0, iInsert), ...entries, ...pinned, ...rest.slice(iInsert)];
}

function withEntriesInSubscriptionsSection({
  items,
  iSection,
  entries,
  pinnedChannelIds
}: GuidePatch & {
  iSection: number;
}) {
  const subscriptions = readSubscriptionsSection(items[iSection]);
  if (!subscriptions) {
    return items;
  }

  const sectionItems = placeSemiEntries({
    items: subscriptions.section.items,
    entries,
    pinnedChannelIds
  });
  const isSectionUnchanged = isSameGuideItems({
    current: subscriptions.section.items,
    next: sectionItems
  });
  if (isSectionUnchanged) {
    return items;
  }

  const patchedSection = {
    ...subscriptions.wrapper,
    [subscriptions.key]: {
      ...subscriptions.section,
      items: sectionItems
    }
  };
  return items.with(iSection, patchedSection);
}

/** Without a Subscriptions section (signed out, or no subscriptions yet) the channels get a section of their own */
function withSemiSection({ items, entries }: Pick<GuidePatch, "items" | "entries">) {
  const isEmpty = entries.length === 0;
  if (isEmpty) {
    return items;
  }

  const isSignInPromoShown = signInPromoItemSchema.safeParse(items[SIGN_IN_PROMO_INDEX]).success;
  const iAfterSignInPromo = isSignInPromoShown ? SIGN_IN_PROMO_INDEX + 1 : SIGN_IN_PROMO_INDEX;
  const iInsert = Math.min(iAfterSignInPromo, items.length);
  return [...items.slice(0, iInsert), buildSemiSection(entries), ...items.slice(iInsert)];
}

/** The guide's top-level `items` with the semi-subscribed entries in place, or null when they already are */
export function patchGuideItems({
  items,
  entries,
  pinnedChannelIds = new Set()
}: Pick<GuidePatch, "items" | "entries"> & Partial<Pick<GuidePatch, "pinnedChannelIds">>) {
  const ownItems = items.filter(item => !isSemiSectionItem(item));
  const iSubscriptions = ownItems.findIndex(item => readSubscriptionsSection(item) !== null);
  const patched =
    iSubscriptions === -1
      ? withSemiSection({
          items: ownItems,
          entries
        })
      : withEntriesInSubscriptionsSection({
          items: ownItems,
          iSection: iSubscriptions,
          entries,
          pinnedChannelIds
        });
  const isUnchanged = isSameGuideItems({
    current: items,
    next: patched
  });
  return isUnchanged ? null : patched;
}

/** A whole /youtubei/v1/guide response body, or null when it is not one or needs no change */
export function patchGuideResponse({
  response,
  entries,
  pinnedChannelIds
}: Pick<Parameters<typeof patchGuideItems>[0], "entries" | "pinnedChannelIds"> & { response: unknown }) {
  const parsed = guideDataSchema.safeParse(response);
  if (!parsed.success) {
    return null;
  }

  const items = patchGuideItems({
    items: parsed.data.items,
    entries,
    pinnedChannelIds
  });
  if (!items) {
    return null;
  }

  return {
    ...parsed.data,
    items
  };
}
