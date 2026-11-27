import { describe, expect, it } from "vitest";

import { buildSemiGuideEntry } from "#subscription-lists/guide/data/semi-guide-entries";
import { cloneItems, HANDLE_CHANNEL } from "#subscription-lists/guide/fixtures/guide-fixtures";
import signedInGuide from "#subscription-lists/guide/fixtures/guide-signed-in.json";
import signedOutGuide from "#subscription-lists/guide/fixtures/guide-signed-out.json";

import { withoutCachedSubscriptionsFlyout } from "./subscriptions-flyout";

describe("withoutCachedSubscriptionsFlyout", () => {
  function buildSubscriptionsSection(headerFlyout: Record<string, unknown>) {
    return [
      {
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
      }
    ];
  }

  const cachedFlyout = {
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
    const cleared = withoutCachedSubscriptionsFlyout(buildSubscriptionsSection(cachedFlyout));

    expect(cleared).toEqual(buildSubscriptionsSection({}));
  });

  it("keeps every other item as it is", () => {
    const items = cloneItems(signedOutGuide);

    expect(withoutCachedSubscriptionsFlyout(items)).toBe(items);
    expect(withoutCachedSubscriptionsFlyout(cloneItems(signedInGuide))).toEqual(cloneItems(signedInGuide));
  });
});
