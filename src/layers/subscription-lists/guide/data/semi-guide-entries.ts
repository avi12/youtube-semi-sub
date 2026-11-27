import { GuideItemKey, subscribedChannelEntrySchema } from "#subscription-lists/guide/data/guide-schemas";
import { buildListedChannelEndpoint, SEMI_LIST_TITLE } from "#subscription-lists/semi-channels";
import { channelIdSchema } from "@/lib/schemas/channel";
import type { SemiSubscription } from "@/lib/schemas/semi-subscription";
import { z } from "@/lib/zod";

const SEMI_ENTRY_CHANNEL_ID_KEY = "youtubeSemiSubChannelId";
const SEMI_SECTION_KEY = "youtubeSemiSubSection";
const NO_AVATAR_ICON = "ACCOUNT_CIRCLE";
const PLAIN_PRESENTATION_STYLE = "GUIDE_ENTRY_PRESENTATION_STYLE_NONE";

const semiSectionItemSchema = z.looseObject({
  [GuideItemKey.SECTION]: z.looseObject({
    [SEMI_SECTION_KEY]: z.literal(true)
  })
});

/** A `ytd-guide-entry-renderer` element's own `data` - the inner renderer object */
const semiGuideEntryDataSchema = z.looseObject({
  [SEMI_ENTRY_CHANNEL_ID_KEY]: channelIdSchema
});

const semiGuideEntryItemSchema = z.looseObject({
  guideEntryRenderer: semiGuideEntryDataSchema
});

/** A rendered entry's `data` for one of YouTube's own subscriptions */
const subscribedChannelEntryDataSchema = subscribedChannelEntrySchema.shape.guideEntryRenderer;

/**
 * No `entryData.guideEntryData.guideEntryId`: YouTube keys subscribe/unsubscribe and unread-count commands on it,
 * so leaving it out keeps a real subscription to the same channel from being mistaken for "already listed"
 */
export function buildSemiGuideEntry(subscription: SemiSubscription) {
  const { channelId, title, avatarUrl } = subscription;
  const picture = avatarUrl
    ? {
        thumbnail: {
          thumbnails: [{ url: avatarUrl }]
        }
      }
    : {
        icon: {
          iconType: NO_AVATAR_ICON
        }
      };
  return {
    guideEntryRenderer: {
      navigationEndpoint: buildListedChannelEndpoint(subscription),
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

export function buildSemiSection(entries: unknown[]) {
  return {
    [GuideItemKey.SECTION]: {
      formattedTitle: {
        simpleText: SEMI_LIST_TITLE
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

/** The channel a rendered guide entry of YouTube's own subscriptions stands for, else null */
export function readSubscribedGuideEntryChannelId(entryData: unknown) {
  const parsed = subscribedChannelEntryDataSchema.safeParse(entryData);
  return parsed.success ? parsed.data.entryData.guideEntryData.guideEntryId : null;
}

export function isSemiGuideEntryItem(item: unknown) {
  return semiGuideEntryItemSchema.safeParse(item).success;
}

export function isSemiSectionItem(item: unknown) {
  return semiSectionItemSchema.safeParse(item).success;
}
