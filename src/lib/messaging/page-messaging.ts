import { channelInfoSchema } from "@/lib/schemas/channel";
import { feedVideoSchema, videoIdSchema } from "@/lib/schemas/feed-video";
import { storedStateSchema } from "@/lib/schemas/stored-state";
import { z } from "@/lib/zod";
import { defineCustomEventMessaging } from "@webext-core/messaging/page";

export const pageStateSchema = storedStateSchema
  .pick({
    isExtensionEnabled: true,
    isAnimationsEnabled: true,
    isAiEnabled: true,
    subscriptions: true,
    aiVerdicts: true
  })
  .extend({
    /** The followed channels' videos that pass their follow filter, newest first */
    feedVideos: z.array(feedVideoSchema),
    /** The subscribed channels' cached uploads their hide filter hides - Shorts included, which name no channel */
    hiddenVideoIds: z.array(videoIdSchema)
  });
export type PageState = z.infer<typeof pageStateSchema>;

export const officialSubscriptionChangeSchema = z.object({
  channelId: z.string(),
  isSubscribed: z.boolean()
});
export type OfficialSubscriptionChange = z.infer<typeof officialSubscriptionChangeSchema>;

export const semiUnsubscribeRequestSchema = officialSubscriptionChangeSchema.pick({ channelId: true });

/** The channel to open the dialog for, and - from a page that shows it - whether the user is subscribed to it */
export const openDialogRequestSchema = channelInfoSchema.extend(
  officialSubscriptionChangeSchema.pick({ isSubscribed: true }).partial().shape
);
type OpenDialogRequest = z.infer<typeof openDialogRequestSchema>;
type SemiUnsubscribeRequest = z.infer<typeof semiUnsubscribeRequestSchema>;

export enum PageMessage {
  getPageState = "getPageState",
  pageStateChanged = "pageStateChanged",
  openSemiSubDialog = "openSemiSubDialog",
  officialSubscriptionChanged = "officialSubscriptionChanged",
  semiUnsubscribe = "semiUnsubscribe"
}

interface PageProtocolMap {
  /** MAIN -> ISOLATED: the current state (null until storage is read) */
  [PageMessage.getPageState](): PageState | null;
  /** ISOLATED -> MAIN: pushed on every storage change, and once when the bridge is ready */
  [PageMessage.pageStateChanged](state: PageState): void;
  /** MAIN -> ISOLATED: the injected button or a list's manage button was pressed */
  [PageMessage.openSemiSubDialog](request: OpenDialogRequest): void;
  /** MAIN -> ISOLATED: the user pressed YouTube's own Subscribe/Unsubscribe and it succeeded */
  [PageMessage.officialSubscriptionChanged](change: OfficialSubscriptionChange): void;
  /** MAIN -> ISOLATED: "Semi-unsubscribe" was picked in an inserted video's menu */
  [PageMessage.semiUnsubscribe](request: SemiUnsubscribeRequest): void;
}

export const pageMessenger = defineCustomEventMessaging<PageProtocolMap>({ namespace: "youtube-semi-sub" });
