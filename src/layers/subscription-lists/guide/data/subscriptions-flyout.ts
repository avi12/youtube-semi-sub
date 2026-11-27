import { readSubscriptionsSection } from "#subscription-lists/guide/data/subscriptions-section";
import { z } from "@/lib/zod";

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

function withoutCachedFlyout(item: unknown) {
  const parsed = cachedFlyoutHeaderItemSchema.safeParse(item);
  if (!parsed.success) {
    return item;
  }

  const collapsible = parsed.data.guideCollapsibleSectionEntryRenderer;
  const {
    mouseEnterEndpoint: flyout,
    mouseLeaveEndpoint: flyoutClose,
    ...headerEntry
  } = collapsible.headerEntry.guideEntryRenderer;
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
