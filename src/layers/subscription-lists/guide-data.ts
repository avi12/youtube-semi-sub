import { buildChannelEndpoint } from "./semi-channels";
import { channelIdSchema } from "@/lib/channel";
import type { SemiSubscription } from "@/lib/semi-subscription";
import { z } from "@/lib/zod";

// The desktop guide (sidebar) and the mini guide's Subscriptions flyout both render from the /youtubei/v1/guide
// response. Semi-subscribed channels are written into that data as native guide entries, tagged so they can be
// told apart from YouTube's own, re-placed on every pass and stripped again when the extension is turned off

const SEMI_ENTRY_CHANNEL_ID_KEY = "youtubeSemiSubChannelId";
const SEMI_SECTION_KEY = "youtubeSemiSubSection";
/** YouTube inserts a fresh subscription right after this header entry - semi-subscriptions go to the same spot */
const SUBSCRIPTIONS_HEADER_ENTRY_ID = "subscriptions-channels-header";
const SEMI_SECTION_TITLE = "Semi-subscriptions";
const SUBSCRIBE_ACTION_HANDLER = "GUIDE_ACTION_ADD_TO_SUBSCRIPTIONS";
const NO_AVATAR_ICON = "ACCOUNT_CIRCLE";
const PLAIN_PRESENTATION_STYLE = "GUIDE_ENTRY_PRESENTATION_STYLE_NONE";

enum GuideItemKey {
  section = "guideSectionRenderer",
  subscriptionsSection = "guideSubscriptionsSectionRenderer",
  signInPromo = "guideSigninPromoRenderer"
}

const guideItemsSchema = z.array(z.unknown());

export const guideDataSchema = z.looseObject({
  items: guideItemsSchema
});

const guideSectionSchema = z.looseObject({
  items: guideItemsSchema
});

const actionHandlingSectionSchema = z.looseObject({
  handlerDatas: z.array(z.unknown())
});

const subscriptionsSectionItemSchema = z.looseObject({
  [GuideItemKey.subscriptionsSection]: guideSectionSchema
});

const plainSectionItemSchema = z.looseObject({
  [GuideItemKey.section]: guideSectionSchema
});

const semiSectionItemSchema = z.looseObject({
  [GuideItemKey.section]: z.looseObject({
    [SEMI_SECTION_KEY]: z.literal(true)
  })
});

const signInPromoItemSchema = z.looseObject({
  [GuideItemKey.signInPromo]: z.looseObject({})
});

/** A `ytd-guide-entry-renderer` element's own `data` - the inner renderer object */
const semiGuideEntryDataSchema = z.looseObject({
  [SEMI_ENTRY_CHANNEL_ID_KEY]: channelIdSchema
});

const semiGuideEntryItemSchema = z.looseObject({
  guideEntryRenderer: semiGuideEntryDataSchema
});

const subscriptionsHeaderItemSchema = z.looseObject({
  guideCollapsibleSectionEntryRenderer: z.looseObject({
    headerEntry: z.looseObject({
      guideEntryRenderer: z.looseObject({
        entryData: z.looseObject({
          guideEntryData: z.looseObject({
            guideEntryId: z.literal(SUBSCRIPTIONS_HEADER_ENTRY_ID)
          })
        })
      })
    })
  })
});

/** The Subscriptions flyout the mini guide builds once from the section's channels and caches on the header entry */
const cachedFlyoutHeaderItemSchema = z.looseObject({
  guideCollapsibleSectionEntryRenderer: z.looseObject({
    headerEntry: z.looseObject({
      guideEntryRenderer: z.looseObject({
        mouseEnterEndpoint: z.looseObject({
          showSheetCommand: z.looseObject({
            panelLoadingStrategy: z.looseObject({
              inlineContent: z.looseObject({
                sheetViewModel: z.looseObject({
                  content: z.looseObject({
                    listViewModel: z.looseObject({})
                  })
                })
              })
            })
          })
        })
      })
    })
  })
});

/**
 * No `entryData.guideEntryData.guideEntryId`: YouTube keys subscribe/unsubscribe and unread-count commands on it,
 * so leaving it out keeps a real subscription to the same channel from being mistaken for "already listed"
 */
export function buildSemiGuideEntry(subscription: SemiSubscription) {
  const { channelId, title, avatarUrl } = subscription;
  const picture = avatarUrl ?
    {
      thumbnail: {
        thumbnails: [{ url: avatarUrl }]
      }
    } :
    {
      icon: {
        iconType: NO_AVATAR_ICON
      }
    };
  return {
    guideEntryRenderer: {
      navigationEndpoint: buildChannelEndpoint(subscription),
      ...picture,
      formattedTitle: {
        simpleText: title
      },
      accessibility: {
        accessibilityData: {
          label: title
        }
      },
      presentationStyle: PLAIN_PRESENTATION_STYLE,
      [SEMI_ENTRY_CHANNEL_ID_KEY]: channelId
    }
  };
}

function buildSemiSection(entries: unknown[]) {
  return {
    [GuideItemKey.section]: {
      formattedTitle: {
        simpleText: SEMI_SECTION_TITLE
      },
      items: entries,
      [SEMI_SECTION_KEY]: true
    }
  };
}

/** The channel a rendered guide entry stands for when it is one of ours, else null */
export function readSemiGuideEntryChannelId(entryData: unknown) {
  const parsed = semiGuideEntryDataSchema.safeParse(entryData);
  return parsed.success ? parsed.data[SEMI_ENTRY_CHANNEL_ID_KEY] : null;
}

function isSemiGuideEntryItem(item: unknown) {
  return semiGuideEntryItemSchema.safeParse(item).success;
}

function isSemiSectionItem(item: unknown) {
  return semiSectionItemSchema.safeParse(item).success;
}

function isSubscriptionsHeaderItem(item: unknown) {
  return subscriptionsHeaderItemSchema.safeParse(item).success;
}

/** Same references where nothing moved; our freshly built entries compare by content */
function isSameGuideItems({ current, next }: {
  current: unknown[];
  next: unknown[];
}) {
  const isSameLength = current.length === next.length;
  return isSameLength && current.every((item, i) => {
    const nextItem = next[i];
    return item === nextItem || JSON.stringify(item) === JSON.stringify(nextItem);
  });
}

function placeSemiEntries({ items, entries }: {
  items: unknown[];
  entries: unknown[];
}) {
  const ownItems = items.filter(item => !isSemiGuideEntryItem(item));
  const iHeader = ownItems.findIndex(isSubscriptionsHeaderItem);
  const iInsert = iHeader === -1 ? 0 : iHeader + 1;
  return [...ownItems.slice(0, iInsert), ...entries, ...ownItems.slice(iInsert)];
}

/** The section YouTube itself adds new subscriptions to: the dedicated renderer, or any section that handles it */
function readSubscriptionsSection(item: unknown) {
  const subscriptionsSection = subscriptionsSectionItemSchema.safeParse(item);
  if (subscriptionsSection.success) {
    return {
      key: GuideItemKey.subscriptionsSection,
      wrapper: subscriptionsSection.data,
      section: subscriptionsSection.data[GuideItemKey.subscriptionsSection]
    };
  }

  const plainSection = plainSectionItemSchema.safeParse(item);
  if (!plainSection.success) {
    return null;
  }

  const section = plainSection.data[GuideItemKey.section];
  const actionHandling = actionHandlingSectionSchema.safeParse(section);
  const isSubscribeHandler = actionHandling.success &&
    actionHandling.data.handlerDatas.includes(SUBSCRIBE_ACTION_HANDLER);
  const isSubscriptionsSection = isSubscribeHandler || section.items.some(isSubscriptionsHeaderItem);
  if (!isSubscriptionsSection) {
    return null;
  }

  return {
    key: GuideItemKey.section,
    wrapper: plainSection.data,
    section
  };
}

function withEntriesInSubscriptionsSection({ items, iSection, entries }: {
  items: unknown[];
  iSection: number;
  entries: unknown[];
}) {
  const subscriptions = readSubscriptionsSection(items[iSection]);
  if (!subscriptions) {
    return items;
  }

  const sectionItems = placeSemiEntries({
    items: subscriptions.section.items,
    entries
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
function withSemiSection({ items, entries }: {
  items: unknown[];
  entries: unknown[];
}) {
  const isEmpty = entries.length === 0;
  if (isEmpty) {
    return items;
  }

  const iAfterSignInPromo = signInPromoItemSchema.safeParse(items[1]).success ? 2 : 1;
  const iInsert = Math.min(iAfterSignInPromo, items.length);
  return [...items.slice(0, iInsert), buildSemiSection(entries), ...items.slice(iInsert)];
}

/** The guide's top-level `items` with the semi-subscribed entries in place, or null when they already are */
export function patchGuideItems({ items, entries }: {
  items: unknown[];
  entries: unknown[];
}) {
  const ownItems = items.filter(item => !isSemiSectionItem(item));
  const iSubscriptions = ownItems.findIndex(item => readSubscriptionsSection(item) !== null);
  const patched = iSubscriptions === -1 ?
    withSemiSection({
      items: ownItems,
      entries
    }) :
    withEntriesInSubscriptionsSection({
      items: ownItems,
      iSection: iSubscriptions,
      entries
    });
  const isUnchanged = isSameGuideItems({
    current: items,
    next: patched
  });
  return isUnchanged ? null : patched;
}

function withoutCachedFlyout(item: unknown) {
  const parsed = cachedFlyoutHeaderItemSchema.safeParse(item);
  if (!parsed.success) {
    return item;
  }

  const collapsible = parsed.data.guideCollapsibleSectionEntryRenderer;
  const { mouseEnterEndpoint: _flyout, mouseLeaveEndpoint: _flyoutClose, ...headerEntry } =
    collapsible.headerEntry.guideEntryRenderer;
  return {
    ...parsed.data,
    guideCollapsibleSectionEntryRenderer: {
      ...collapsible,
      headerEntry: {
        ...collapsible.headerEntry,
        guideEntryRenderer: headerEntry
      }
    }
  };
}

/**
 * The mini guide builds its Subscriptions flyout once and caches it on the section's header entry, so it would keep
 * showing stale channels. Without the cache it rebuilds the flyout from the section's current entries
 */
export function withoutCachedSubscriptionsFlyout(items: unknown[]) {
  const iSubscriptions = items.findIndex(item => readSubscriptionsSection(item) !== null);
  const subscriptions = readSubscriptionsSection(items[iSubscriptions]);
  if (!subscriptions) {
    return items;
  }

  return items.with(iSubscriptions, {
    ...subscriptions.wrapper,
    [subscriptions.key]: {
      ...subscriptions.section,
      items: subscriptions.section.items.map(withoutCachedFlyout)
    }
  });
}

/** A whole /youtubei/v1/guide response body, or null when it is not one or needs no change */
export function patchGuideResponse({ response, entries }: {
  response: unknown;
  entries: unknown[];
}) {
  const parsed = guideDataSchema.safeParse(response);
  if (!parsed.success) {
    return null;
  }

  const items = patchGuideItems({
    items: parsed.data.items,
    entries
  });
  if (!items) {
    return null;
  }

  return {
    ...parsed.data,
    items
  };
}
