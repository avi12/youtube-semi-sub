import { z } from "@/lib/zod";

// Every item this extension injects into the feed carries a tag beside its renderer - inside `richItemRenderer`, next
// to `content` - so another extension rewriting the feed (YouTube Auto Feed) can tell semi-subscribed items from
// YouTube's own. A halted channel injects nothing, so it is never tagged

export const SEMI_SUBSCRIBED_TAG = "yssSemiSubscribed";

const semiSubscribedTagSchema = z.literal(true);

const semiSubscribedRichItemSchema = z.looseObject({
  richItemRenderer: z.looseObject({
    content: z.record(z.string(), z.unknown()),
    [SEMI_SUBSCRIBED_TAG]: semiSubscribedTagSchema
  })
});
type SemiSubscribedRichItem = z.infer<typeof semiSubscribedRichItemSchema>;

/** A grid item around `content`, tagged as injected by this extension */
export function buildSemiSubscribedRichItem(content: SemiSubscribedRichItem["richItemRenderer"]["content"]) {
  const item: SemiSubscribedRichItem = {
    richItemRenderer: {
      content,
      [SEMI_SUBSCRIBED_TAG]: true
    }
  };
  return item;
}
