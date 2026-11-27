import { findValueByKey } from "#channel-button/page/readers/renderer-search";
import { CHANNEL_ID_SOURCE } from "@/lib/schemas/channel";
import { z } from "@/lib/zod";

const CHANNEL_ID_IN_TEXT_PATTERN = new RegExp(CHANNEL_ID_SOURCE);
const SUBSCRIBE_BUTTON_RENDERER_KEYS = ["subscribeButtonRenderer"];

const frameworkMutationsSchema = z.looseObject({
  frameworkUpdates: z.looseObject({
    entityBatchUpdate: z.looseObject({
      mutations: z.array(z.unknown())
    })
  })
});

const subscriptionMutationSchema = z.looseObject({
  payload: z.looseObject({
    subscriptionStateEntity: z.looseObject({
      key: z.string(),
      subscribed: z.boolean()
    })
  })
});

const subscribeButtonRendererSchema = z.looseObject({
  channelId: z.string(),
  subscribed: z.boolean()
});

/** Entity keys are base64 protobufs that embed the channel id, so they map straight to a channel */
function decodeEntityChannelId(key: string) {
  try {
    return CHANNEL_ID_IN_TEXT_PATTERN.exec(atob(decodeURIComponent(key)))?.[0];
  } catch {
    return undefined;
  }
}

/** The `subscriptionStateEntity` values a response seeds YouTube's entity store with, by channel id */
export function readSubscriptionEntities(response: unknown) {
  const subscribedByChannel = new Map<string, boolean>();
  const parsed = frameworkMutationsSchema.safeParse(response);
  if (!parsed.success) {
    return subscribedByChannel;
  }

  for (const mutation of parsed.data.frameworkUpdates.entityBatchUpdate.mutations) {
    const parsedMutation = subscriptionMutationSchema.safeParse(mutation);
    const entity = parsedMutation.success ? parsedMutation.data.payload.subscriptionStateEntity : null;
    const channelId = entity && decodeEntityChannelId(entity.key);
    if (entity && channelId) {
      subscribedByChannel.set(channelId, entity.subscribed);
    }
  }
  return subscribedByChannel;
}

export function readPageOfficialSubscription({
  response,
  searchRoot,
  channelId
}: {
  response: unknown;
  searchRoot: unknown;
  channelId: string;
}) {
  const entitySubscription = readSubscriptionEntities(response).get(channelId);
  if (entitySubscription !== undefined) {
    return entitySubscription;
  }

  const renderer = subscribeButtonRendererSchema.safeParse(
    findValueByKey({
      root: searchRoot,
      keys: SUBSCRIBE_BUTTON_RENDERER_KEYS,
      isMatch(candidate) {
        const parsed = subscribeButtonRendererSchema.safeParse(candidate);
        return parsed.success && parsed.data.channelId === channelId;
      }
    })
  );
  return renderer.success ? renderer.data.subscribed : undefined;
}
