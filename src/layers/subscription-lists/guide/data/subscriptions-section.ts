import {
  guideDataSchema,
  guideEntryWithIdSchema,
  GuideItemKey,
  guideSectionSchema,
  subscribedChannelEntrySchema
} from "#subscription-lists/guide/data/guide-schemas";
import { z } from "@/lib/zod";

/** YouTube inserts a fresh subscription right after this header entry - semi-subscriptions go to the same spot */
const SUBSCRIPTIONS_HEADER_ENTRY_ID = "subscriptions-channels-header";
/** Any of YouTube's continuation keys - a section that has one was cut short and loads the rest later */
const CONTINUATION_KEY_PREFIX = '"continuation';
const SUBSCRIBE_ACTION_HANDLER = "GUIDE_ACTION_ADD_TO_SUBSCRIPTIONS";

const actionHandlingSectionSchema = z.looseObject({
  handlerDatas: z.array(z.unknown())
});

const subscriptionsSectionItemSchema = z.looseObject({
  [GuideItemKey.SUBSCRIPTIONS_SECTION]: guideSectionSchema
});

const plainSectionItemSchema = z.looseObject({
  [GuideItemKey.SECTION]: guideSectionSchema
});

const subscriptionsHeaderItemSchema = z.looseObject({
  guideCollapsibleSectionEntryRenderer: z.looseObject({
    headerEntry: guideEntryWithIdSchema(z.literal(SUBSCRIPTIONS_HEADER_ENTRY_ID))
  })
});

export function isSubscriptionsHeaderItem(item: unknown) {
  return subscriptionsHeaderItemSchema.safeParse(item).success;
}

/** The section YouTube itself adds new subscriptions to: the dedicated renderer, or any section that handles it */
export function readSubscriptionsSection(item: unknown) {
  const subscriptionsSection = subscriptionsSectionItemSchema.safeParse(item);
  if (subscriptionsSection.success) {
    return {
      key: GuideItemKey.SUBSCRIPTIONS_SECTION,
      wrapper: subscriptionsSection.data,
      section: subscriptionsSection.data[GuideItemKey.SUBSCRIPTIONS_SECTION]
    };
  }

  const plainSection = plainSectionItemSchema.safeParse(item);
  if (!plainSection.success) {
    return null;
  }

  const section = plainSection.data[GuideItemKey.SECTION];
  const actionHandling = actionHandlingSectionSchema.safeParse(section);
  const isSubscribeHandler =
    actionHandling.success && actionHandling.data.handlerDatas.includes(SUBSCRIBE_ACTION_HANDLER);
  const isSubscriptionsSection = isSubscribeHandler || section.items.some(isSubscriptionsHeaderItem);
  if (!isSubscriptionsSection) {
    return null;
  }

  return {
    key: GuideItemKey.SECTION,
    wrapper: plainSection.data,
    section
  };
}

function collectSubscribedChannelIds(root: unknown) {
  const channelIds = new Set<string>();
  const pending = [root];
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value !== "object" || value === null) {
      continue;
    }

    const entry = subscribedChannelEntrySchema.safeParse(value);
    if (entry.success) {
      channelIds.add(entry.data.guideEntryRenderer.entryData.guideEntryData.guideEntryId);
      continue;
    }

    pending.push(...Object.values(value));
  }
  return channelIds;
}

/**
 * Whether the user is officially subscribed to a channel, as a raw guide response tells it - or null when the guide has
 * no Subscriptions section (signed out, or no subscriptions yet). The guide lists every subscription, those past
 * "Show more" too, so a channel it leaves out isn't subscribed - unless the section was cut short, then it can't say
 */
export function readGuideSubscriptions(response: unknown) {
  const parsed = guideDataSchema.safeParse(response);
  const subscriptions = parsed.success
    ? parsed.data.items.map(readSubscriptionsSection).find(section => section !== null)
    : undefined;
  if (!subscriptions) {
    return null;
  }

  const subscribedChannelIds = collectSubscribedChannelIds(subscriptions.section.items);
  const isComplete = !JSON.stringify(subscriptions.section).includes(CONTINUATION_KEY_PREFIX);
  return (channelId: string) => {
    if (subscribedChannelIds.has(channelId)) {
      return true;
    }

    return isComplete ? false : undefined;
  };
}
