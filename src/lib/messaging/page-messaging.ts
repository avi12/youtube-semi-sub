import type { ProtocolWithReturn } from "@webext-core/messaging";
import { defineCustomEventMessaging } from "@webext-core/messaging/page";

import { defineValidatedMessaging } from "@/lib/messaging/validated-messaging";
import { channelIdSchema, channelInfoSchema } from "@/lib/schemas/channel";
import { feedVideoSchema, videoIdSchema } from "@/lib/schemas/feed-video";
import { storedStateSchema } from "@/lib/schemas/stored-state";
import { z } from "@/lib/zod";

const pageStateSchema = storedStateSchema
  .pick({
    isExtensionEnabled: true,
    isAnimationsEnabled: true,
    isAiEnabled: true,
    subscriptions: true,
    aiVerdicts: true
  })
  .extend({
    /**
     * Every cached upload of the followed channels, unfiltered: the page judges each by the title its tile will show,
     * which a YouTube title test can make differ from the cached one
     */
    followedUploads: z.array(feedVideoSchema),
    /** The subscribed channels' cached uploads their hide filter hides - Shorts included, which name no channel */
    hiddenVideoIds: z.array(videoIdSchema)
  });
export type PageState = z.infer<typeof pageStateSchema>;

const officialSubscriptionChangeSchema = z.object({
  channelId: channelIdSchema,
  isSubscribed: z.boolean()
});
export type OfficialSubscriptionChange = z.infer<typeof officialSubscriptionChangeSchema>;

export enum PageMessage {
  getPageState = "get-page-state",
  pageStateChanged = "page-state-changed",
  openSemiSubDialog = "open-semi-sub-dialog",
  officialSubscriptionChanged = "official-subscription-changed",
  semiUnsubscribe = "semi-unsubscribe"
}

const NO_PAYLOAD = z.undefined();
const NO_REPLY = z.void();

/** Every page message's payload and reply: the one source of their types, checked on both ends */
const PAGE_MESSAGE_SCHEMAS = {
  /** MAIN -> ISOLATED: the current state (null until storage is read) */
  [PageMessage.getPageState]: {
    request: NO_PAYLOAD,
    reply: pageStateSchema.nullable()
  },
  /** ISOLATED -> MAIN: pushed on every storage change, and once when the bridge is ready */
  [PageMessage.pageStateChanged]: {
    request: pageStateSchema,
    reply: NO_REPLY
  },
  /**
   * MAIN -> ISOLATED: the injected button or a list's manage button was pressed - for this channel, and, from a page
   * that shows it, whether the user is subscribed to it
   */
  [PageMessage.openSemiSubDialog]: {
    request: channelInfoSchema.extend(officialSubscriptionChangeSchema.pick({ isSubscribed: true }).partial().shape),
    reply: NO_REPLY
  },
  /** MAIN -> ISOLATED: the user pressed YouTube's own Subscribe/Unsubscribe and it succeeded */
  [PageMessage.officialSubscriptionChanged]: {
    request: officialSubscriptionChangeSchema,
    reply: NO_REPLY
  },
  /** MAIN -> ISOLATED: "Semi-unsubscribe" was picked in an inserted video's menu */
  [PageMessage.semiUnsubscribe]: {
    request: officialSubscriptionChangeSchema.pick({ channelId: true }),
    reply: NO_REPLY
  }
};

export const pageMessenger = defineValidatedMessaging({
  schemas: PAGE_MESSAGE_SCHEMAS,
  messenger: defineCustomEventMessaging<Record<PageMessage, ProtocolWithReturn<unknown, unknown>>>({
    namespace: "youtube-semi-sub"
  })
});
