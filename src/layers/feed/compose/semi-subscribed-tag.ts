import { z } from "@/lib/zod";

// Every item this extension injects into the feed carries a tag beside its renderer - inside `richItemRenderer`, next
// to `content` - so another extension rewriting the feed (YouTube Auto Feed) can tell semi-subscribed items from
// YouTube's own. m's Shorts shelf lists bare renderers with no `richItemRenderer` around them; there the tag sits
// beside the renderer itself. A halted channel injects nothing, so it is never tagged

export const SEMI_SUBSCRIBED_TAG = "yssSemiSubscribed";

const semiSubscribedTagSchema = z.literal(true);

const contentSchema = z.record(z.string(), z.unknown());

const semiSubscribedRichItemSchema = z.looseObject({
  richItemRenderer: z.looseObject({
    content: contentSchema,
    [SEMI_SUBSCRIBED_TAG]: semiSubscribedTagSchema
  })
});
type SemiSubscribedRichItem = z.infer<typeof semiSubscribedRichItemSchema>;

const semiSubscribedBareItemSchema = z.looseObject({
  [SEMI_SUBSCRIBED_TAG]: semiSubscribedTagSchema
});

/** A grid item around `content`, tagged as injected by this extension */
export function buildSemiSubscribedRichItem(content: z.infer<typeof contentSchema>) {
  const item: SemiSubscribedRichItem = {
    richItemRenderer: {
      content,
      [SEMI_SUBSCRIBED_TAG]: true
    }
  };
  return item;
}

/** A bare renderer entry (m's Shorts shelf), tagged as injected by this extension */
export function buildSemiSubscribedBareItem(content: z.infer<typeof contentSchema>) {
  return {
    ...content,
    [SEMI_SUBSCRIBED_TAG]: true
  };
}

export function isSemiSubscribedItem(item: unknown) {
  return semiSubscribedRichItemSchema.safeParse(item).success || semiSubscribedBareItemSchema.safeParse(item).success;
}
