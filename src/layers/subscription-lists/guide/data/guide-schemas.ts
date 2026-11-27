import { channelIdSchema } from "@/lib/schemas/channel";
import { z } from "@/lib/zod";

export enum GuideItemKey {
  SECTION = "guideSectionRenderer",
  SUBSCRIPTIONS_SECTION = "guideSubscriptionsSectionRenderer",
  SIGN_IN_PROMO = "guideSigninPromoRenderer"
}

const guideItemsSchema = z.array(z.unknown());

export const guideDataSchema = z.looseObject({
  items: guideItemsSchema
});

export const guideSectionSchema = z.looseObject({
  items: guideItemsSchema
});

/** A guide entry YouTube keys its commands on: a subscribed channel's entry carries the channel id */
export function guideEntryWithIdSchema(guideEntryIdSchema: z.ZodType<string>) {
  return z.looseObject({
    guideEntryRenderer: z.looseObject({
      entryData: z.looseObject({
        guideEntryData: z.looseObject({
          guideEntryId: guideEntryIdSchema
        })
      })
    })
  });
}

/** Ours carry no `guideEntryId` (see `buildSemiGuideEntry`), so only YouTube's own subscriptions match */
export const subscribedChannelEntrySchema = guideEntryWithIdSchema(channelIdSchema);
