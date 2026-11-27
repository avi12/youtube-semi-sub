import { MODE_COPY } from "#filter-editor/mode-copy";
import { previewVideoFilter, type VideoFilterPreview } from "#filter-editor/preview/title-matches";
import { isFilterConditionValid } from "@/lib/filter/schema/filter-validity";
import {
  FilterKind,
  listAiFilters,
  listFilterConditions,
  type VideoFilter
} from "@/lib/filter/schema/video-filter-schema";
import type { FeedVideo } from "@/lib/schemas/feed-video";
import type { SubscriptionMode } from "@/lib/schemas/subscription-mode";

/** While a condition is mid-edit and invalid, keep showing the last valid result instead of emptying the feed */
export function watchEditorPreview(readInput: () => Parameters<typeof previewVideoFilter>[0]) {
  let lastValidPreview: {
    videos: FeedVideo[];
    preview: VideoFilterPreview;
  } | null = null;

  const preview = $derived.by(() => {
    const input = readInput();
    const currentPreview = previewVideoFilter(input);
    if (currentPreview.isValid) {
      lastValidPreview = {
        videos: input.videos,
        preview: currentPreview
      };
      return {
        ...currentPreview,
        isStale: false
      };
    }

    const isPausedByAi = listAiFilters(input.filter).length > 0 && !input.isAiEnabled;
    const isLastValidPreviewCurrent = lastValidPreview?.videos === input.videos;
    if (lastValidPreview && isLastValidPreviewCurrent && !isPausedByAi) {
      return {
        ...lastValidPreview.preview,
        isStale: true
      };
    }

    return {
      ...currentPreview,
      isStale: false
    };
  });

  return {
    get preview() {
      return preview;
    }
  };
}

/** Worded after the condition that stops the preview, else after the one most likely to explain no match */
export function getPreviewHints({
  filter,
  mode,
  isAiEnabled
}: {
  filter: VideoFilter;
  mode: SubscriptionMode;
  isAiEnabled: boolean;
}) {
  const copy = MODE_COPY[mode];
  const conditions = listFilterConditions(filter);
  const invalidCondition = conditions.find(condition => !isFilterConditionValid(condition));
  const kind =
    invalidCondition?.kind ??
    conditions.find(condition => condition.kind === FilterKind.AI_MATCH)?.kind ??
    conditions.find(condition => condition.kind === FilterKind.REGEX)?.kind ??
    FilterKind.LENGTH;
  if (kind === FilterKind.REGEX) {
    return copy.regexHints;
  }

  if (kind === FilterKind.LENGTH) {
    return copy.lengthHints;
  }

  if (!isAiEnabled) {
    return {
      ...copy.aiHints,
      invalidSummary: "AI match is off",
      invalid: copy.pausedAiInvalid
    };
  }

  return copy.aiHints;
}
