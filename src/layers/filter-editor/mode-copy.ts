import { SubscriptionMode } from "@/lib/schemas/subscription-mode";
import type { PreviewHints } from "#filter-editor/preview/title-matches";

// The editor's words per mode: a follow filter picks what is added to the feed, a hide filter what is hidden from it

const FOLLOW_REGEX_HINTS: PreviewHints = {
  invalidSummary: "Fix the pattern to update the preview",
  invalid: "Fix the pattern to see what's added to your feed",
  noMatch: "Nothing recent matches - try a looser pattern"
};
const FOLLOW_AI_HINTS: PreviewHints = {
  invalidSummary: "Describe the videos you want",
  invalid: "Describe the videos you want to see what's added to your feed",
  noMatch: "Nothing recent fits - try a broader description"
};
const HIDE_REGEX_HINTS: PreviewHints = {
  invalidSummary: "Fix the pattern to update the preview",
  invalid: "Fix the pattern to see what's hidden from your feed",
  noMatch: "Nothing recent matches, so nothing's hidden"
};
const HIDE_AI_HINTS: PreviewHints = {
  invalidSummary: "Describe the videos to hide",
  invalid: "Describe the videos to hide to see what's hidden from your feed",
  noMatch: "Nothing recent fits, so nothing's hidden"
};

export const MODE_COPY = {
  [SubscriptionMode.follow]: {
    regexLabel: "Title filter",
    aiLabel: "Describe the videos you want",
    regexPlaceholder: "tutorial|review",
    aiPlaceholder: "Only phone reviews, not unboxings",
    emptyPatternHint: "Leave it empty to add every video",
    aiHint: "A model reads each video's title and description, and adds the ones that fit - it reads topics broadly, so say what to leave out too",
    previewLabel: "Added to your feed",
    skippedLabel: "won't be added",
    regexHints: FOLLOW_REGEX_HINTS,
    aiHints: FOLLOW_AI_HINTS,
    pausedAiInvalid: "Turn on AI match to see what's added to your feed"
  },
  [SubscriptionMode.hide]: {
    regexLabel: "Hide titles matching",
    aiLabel: "Describe the videos to hide",
    regexPlaceholder: "live|reaction",
    aiPlaceholder: "Livestreams and reaction videos, not interviews",
    emptyPatternHint: "Leave it empty to hide nothing",
    aiHint: "A model reads each video's title and description, and hides the ones that fit - it reads topics broadly, so say what to keep too",
    previewLabel: "Hidden from your feed",
    skippedLabel: "stay in your feed",
    regexHints: HIDE_REGEX_HINTS,
    aiHints: HIDE_AI_HINTS,
    pausedAiInvalid: "Turn on AI match to see what's hidden from your feed"
  }
} as const satisfies Record<SubscriptionMode, Record<string, string | PreviewHints>>;
