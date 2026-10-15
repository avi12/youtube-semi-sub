import type { SemiSubscription } from "@/lib/semi-subscription";

/** The semi-subscriptions every in-page list renders, already filtered and sorted - see `listSemiSubscriptions` */
export const listsView = $state<{ subscriptions: SemiSubscription[] }>({ subscriptions: [] });
