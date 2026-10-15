import type { PageState } from "@/lib/messaging/page-messaging";
import type { SemiSubscription } from "@/lib/schemas/semi-subscription";

/**
 * What every in-page list renders: the semi-subscriptions, already filtered and sorted (see `listSemiSubscriptions`),
 * and whether AI match is on, since AI filters show as paused while it's off
 */
export const listsView = $state<Pick<PageState, "isAiEnabled"> & { subscriptions: SemiSubscription[] }>({
  subscriptions: [],
  isAiEnabled: false
});
