import { buildSemiGuideEntry } from "#subscription-lists/guide/data/semi-guide-entries";
import { DEFAULT_TITLE_FILTER, FilterKind } from "@/lib/filter/schema/video-filter-schema";
import type { SemiSubscription } from "@/lib/schemas/semi-subscription";
import { z } from "@/lib/zod";

export const HANDLE_CHANNEL: SemiSubscription = {
  channelId: "UCX6OQ3DkcsbYNE6H8uQQuVA",
  title: "MrBeast",
  handle: "@MrBeast",
  avatarUrl: "https://yt3.ggpht.com/avatar=s88-c-k-c0x00ffffff-no-rj",
  followFilter: {
    kind: FilterKind.REGEX,
    pattern: "challenge",
    flags: "i"
  },
  createdAt: 1,
  hideFilter: DEFAULT_TITLE_FILTER,
  isSubscribed: false
};
export const HANDLELESS_CHANNEL: SemiSubscription = {
  channelId: "UCBR8-60-B28hp2BmDPdntcQ",
  title: "YouTube",
  followFilter: {
    kind: FilterKind.REGEX,
    pattern: "",
    flags: "i"
  },
  createdAt: 2,
  hideFilter: DEFAULT_TITLE_FILTER,
  isSubscribed: false
};
export const ENTRIES = [buildSemiGuideEntry(HANDLE_CHANNEL), buildSemiGuideEntry(HANDLELESS_CHANNEL)];
export const SUBSCRIPTIONS_KEY = "guideSubscriptionsSectionRenderer";
export const SECTION_KEY = "guideSectionRenderer";
/** The first title in an item: an entry's own, a section header's or a "Show more" expander's */
const FIRST_TITLE_PATTERN = /"formattedTitle":\{"simpleText":"([^"]+)"/;

export const sectionItemSchema = z.record(z.string(), z.looseObject({ items: z.array(z.unknown()) }));

export function cloneItems(guide: { items: unknown[] }) {
  return structuredClone(guide.items);
}

export function readSectionTitles({ items, index, key }: { items: unknown[] | null; index: number; key: string }) {
  const sectionItems = sectionItemSchema.parse(items?.[index])[key]?.items ?? [];
  return sectionItems.map(item => JSON.stringify(item).match(FIRST_TITLE_PATTERN)?.[1]);
}
