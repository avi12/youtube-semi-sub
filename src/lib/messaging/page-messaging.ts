import type { ChannelInfo } from "@/lib/schemas/channel";
import { feedVideoSchema } from "@/lib/schemas/feed-video";
import { semiSubscriptionsSchema } from "@/lib/schemas/semi-subscription";
import { z } from "@/lib/zod";
import { defineCustomEventMessaging } from "@webext-core/messaging/page";

export const pageStateSchema = z.object({
  isExtensionEnabled: z.boolean(),
  isAnimationsEnabled: z.boolean(),
  subscriptions: semiSubscriptionsSchema,
  /** The semi-subscribed videos that pass their channel's filter, newest first */
  feedVideos: z.array(feedVideoSchema)
});
export type PageState = z.infer<typeof pageStateSchema>;

export const officialSubscriptionChangeSchema = z.object({
  channelId: z.string(),
  isSubscribed: z.boolean()
});
type OfficialSubscriptionChange = z.infer<typeof officialSubscriptionChangeSchema>;

export enum PageMessage {
  getPageState = "getPageState",
  pageStateChanged = "pageStateChanged",
  openSemiSubDialog = "openSemiSubDialog",
  officialSubscriptionChanged = "officialSubscriptionChanged"
}

interface PageProtocolMap {
  /** MAIN -> ISOLATED: the current state (null until storage is read) */
  [PageMessage.getPageState](): PageState | null;
  /** ISOLATED -> MAIN: pushed on every storage change, and once when the bridge is ready */
  [PageMessage.pageStateChanged](state: PageState): void;
  /** MAIN -> ISOLATED: the injected Semi-subscribe button was pressed */
  [PageMessage.openSemiSubDialog](channel: ChannelInfo): void;
  /** MAIN -> ISOLATED: the user pressed YouTube's own Subscribe/Unsubscribe and it succeeded */
  [PageMessage.officialSubscriptionChanged](change: OfficialSubscriptionChange): void;
}

export const pageMessenger = defineCustomEventMessaging<PageProtocolMap>({ namespace: "youtube-semi-sub" });
