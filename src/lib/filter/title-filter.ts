import { type FeedVideo, sortNewestFirst } from "@/lib/schemas/feed-video";
import type { SemiSubscriptions } from "@/lib/schemas/semi-subscription";
import { z } from "@/lib/zod";

// `g` and `y` make RegExp.test stateful, `d` only adds indices - none of them mean anything for a title filter
export const ALLOWED_FILTER_FLAGS = ["i", "m", "s", "u", "v"] as const;
const FILTER_FLAGS_PATTERN = new RegExp(`^[${ALLOWED_FILTER_FLAGS.join("")}]*$`);

export const titleFilterSchema = z.object({
  pattern: z.string(),
  flags: z.string().regex(FILTER_FLAGS_PATTERN)
});
export type TitleFilter = z.infer<typeof titleFilterSchema>;

export const DEFAULT_TITLE_FILTER: TitleFilter = {
  pattern: "",
  flags: "i"
};

export function compileTitleFilter(filter: TitleFilter) {
  const isFlagSetValid = titleFilterSchema.safeParse(filter).success;
  if (!isFlagSetValid) {
    return null;
  }

  try {
    return new RegExp(filter.pattern, filter.flags);
  } catch {
    return null;
  }
}

export function getTitleFilterError(filter: TitleFilter) {
  try {
    new RegExp(filter.pattern, filter.flags);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

export function selectFeedVideos({ subscriptions, videosByChannel }: {
  subscriptions: SemiSubscriptions;
  videosByChannel: Partial<Record<string, FeedVideo[]>>;
}) {
  const selectedById = new Map<string, FeedVideo>();
  for (const channelId in subscriptions) {
    const subscription = subscriptions[channelId];
    const regex = subscription && compileTitleFilter(subscription.filter);
    if (!regex) {
      continue;
    }

    for (const video of videosByChannel[channelId] ?? []) {
      if (regex.test(video.title)) {
        selectedById.set(video.videoId, video);
      }
    }
  }
  return sortNewestFirst([...selectedById.values()]);
}
