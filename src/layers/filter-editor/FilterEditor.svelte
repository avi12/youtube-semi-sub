<script lang="ts">
  import { watchAiMatchPreview } from "./ai-match-preview.svelte";
  import { previewAiFilter, type PreviewHints, previewTitleFilter, type TitleFilterPreview } from "./title-matches";
  import { AiEngine, type AiStatus } from "@/lib/ai/ai-status";
  import {
    DEFAULT_TITLE_FILTER,
    EMPTY_AI_FILTER,
    FilterKind,
    type RegexFilter,
    type TitleFilter
  } from "@/lib/filter/title-filter";
  import type { FeedVideo } from "@/lib/schemas/feed-video";
  import AiFilterFields from "#filter-editor/components/AiFilterFields.svelte";
  import FilterPreview from "#filter-editor/components/FilterPreview.svelte";
  import KindSwitch from "#filter-editor/components/KindSwitch.svelte";
  import RegexFilterFields from "#filter-editor/components/RegexFilterFields.svelte";
  import type { Snippet } from "svelte";

  interface Props {
    filter: TitleFilter;
    /** A sample of the channel's recent uploads to preview the filter on - may be empty */
    videos: FeedVideo[];
    isLoading?: boolean;
    /** The host's way to turn AI match on or finish setting it up, shown while an AI filter can't run yet */
    aiSetup?: Snippet<[{
      isAiEnabled: boolean;
      aiStatus: AiStatus | null;
    }]>;
  }

  let { filter = $bindable(), videos, isLoading = false, aiSetup }: Props = $props();

  const id = $props.id();
  const inputId = `${id}-filter`;

  const REGEX_HINTS: PreviewHints = {
    invalidSummary: "Fix the pattern to update the preview",
    invalid: "Fix the pattern to see what lands in your feed",
    noMatch: "Nothing recent matches - try a looser pattern"
  };
  const AI_HINTS: PreviewHints = {
    invalidSummary: "Describe the videos you want",
    invalid: "Describe the videos you want to see what lands in your feed",
    noMatch: "Nothing recent fits - try a broader description"
  };
  const PAUSED_AI_HINTS: PreviewHints = {
    ...AI_HINTS,
    invalidSummary: "AI match is off",
    invalid: "Turn on AI match to see what lands in your feed"
  };

  /** Switching kinds keeps what was typed for the other one, so flipping back and forth loses nothing */
  const parkedFilters: Partial<Record<FilterKind, TitleFilter>> = {};

  function createEmptyFilter(kind: FilterKind) {
    const emptyFilter: TitleFilter = kind === FilterKind.aiMatch ? { ...EMPTY_AI_FILTER } : { ...DEFAULT_TITLE_FILTER };
    return emptyFilter;
  }

  function switchKind(kind: FilterKind) {
    if (kind === filter.kind) {
      return;
    }

    parkedFilters[filter.kind] = filter;
    filter = parkedFilters[kind] ?? createEmptyFilter(kind);
  }

  const aiFilter = $derived.by(() => {
    if (filter.kind === FilterKind.aiMatch) {
      return filter;
    }

    return null;
  });
  const regexFilter = $derived.by(() => {
    if (filter.kind === FilterKind.regex) {
      return filter;
    }

    return null;
  });

  const aiMatch = watchAiMatchPreview(() => ({
    filter: aiFilter,
    videos
  }));

  const aiNotice = $derived.by(() => {
    if (!aiFilter) {
      return null;
    }

    if (!aiMatch.isAiEnabled) {
      return "AI match is off - turn it on to let a model judge each video";
    }

    const { aiStatus } = aiMatch;
    if (aiStatus?.engine === AiEngine.none) {
      return "AI match isn't available in this browser";
    }

    if (aiStatus && !aiStatus.isModelReady) {
      return "The AI model isn't on this device yet - videos get checked once it is";
    }

    return null;
  });
  const isSetupOffered = $derived(aiNotice !== null && aiMatch.aiStatus?.engine !== AiEngine.none);

  let lastValidRegexPreview: {
    videos: FeedVideo[];
    preview: TitleFilterPreview;
  } | null = null;

  /** While the pattern is mid-edit and invalid, keep showing the last valid result instead of emptying the feed */
  function buildRegexPreview(currentFilter: RegexFilter) {
    const currentPreview = previewTitleFilter({
      filter: currentFilter,
      videos
    });
    if (currentPreview.isValid) {
      lastValidRegexPreview = {
        videos,
        preview: currentPreview
      };
      return {
        ...currentPreview,
        isStale: false
      };
    }

    const isLastValidPreviewCurrent = lastValidRegexPreview?.videos === videos;
    if (lastValidRegexPreview && isLastValidPreviewCurrent) {
      return {
        ...lastValidRegexPreview.preview,
        isStale: true
      };
    }

    return {
      ...currentPreview,
      isStale: false
    };
  }

  const preview = $derived.by(() => {
    if (regexFilter) {
      return buildRegexPreview(regexFilter);
    }

    if (!aiFilter) {
      return null;
    }

    return {
      ...previewAiFilter({
        filter: aiFilter,
        videos,
        aiVerdicts: aiMatch.aiVerdicts,
        isAiEnabled: aiMatch.isAiEnabled
      }),
      isStale: false
    };
  });
  const hints = $derived.by(() => {
    if (regexFilter) {
      return REGEX_HINTS;
    }

    if (!aiMatch.isAiEnabled) {
      return PAUSED_AI_HINTS;
    }

    return AI_HINTS;
  });
</script>

<div class="filter-editor">
  <header class="filter-editor__header">
    <label class="filter-editor__label" for={inputId}>
      {#if aiFilter}
        Describe the videos you want
      {:else}
        Title filter
      {/if}
    </label>
    <KindSwitch kind={filter.kind} onKindChange={switchKind} />
  </header>

  {#if regexFilter}
    <RegexFilterFields
      {inputId}
      bind:filter={() => regexFilter, editedFilter => {
        filter = editedFilter;
      }} />
  {:else if aiFilter}
    <AiFilterFields
      {inputId}
      bind:filter={() => aiFilter, editedFilter => {
        filter = editedFilter;
      }} />
  {/if}

  {#if aiNotice}
    <section class="ai-notice" aria-live="polite">
      <p class="ai-notice__text">{aiNotice}</p>
      {#if aiSetup && isSetupOffered}
        <div class="ai-notice__action">
          {@render aiSetup({
            isAiEnabled: aiMatch.isAiEnabled,
            aiStatus: aiMatch.aiStatus
          })}
        </div>
      {/if}
    </section>
  {/if}

  {#if preview}
    <FilterPreview {hints} {inputId} {isLoading} {preview} videoCount={videos.length} />
  {/if}
</div>

<style>
  .filter-editor {
    --editor-fg: var(--filter-editor-fg, CanvasText);
    --editor-muted: var(--filter-editor-muted, color-mix(in srgb, CanvasText 60%, Canvas));
    --editor-accent: var(--filter-editor-accent, LinkText);
    --editor-error: var(--filter-editor-error, #d93025);
    --editor-surface: var(--filter-editor-surface, Canvas);
    --editor-border: var(--filter-editor-border, color-mix(in srgb, CanvasText 20%, Canvas));
    --editor-font: var(--filter-editor-font, system-ui, sans-serif);
    --editor-mono: ui-monospace, "Cascadia Mono", "Roboto Mono", "SF Mono", consolas, monospace;
    --editor-ease: cubic-bezier(0.2, 0, 0, 1);

    display: flex;
    flex-direction: column;
    gap: 16px;
    color: var(--editor-fg);
    font-family: var(--editor-font);
    font-size: 14px;
    line-height: 1.4;

    & :global(:where(:focus-visible)) {
      outline: 2px solid var(--editor-accent);
      outline-offset: 2px;
      animation: none;
    }
  }

  .filter-editor__header {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: space-between;
    align-items: center;
    margin-block-end: -8px;
  }

  .filter-editor__label {
    color: var(--editor-fg);
    font-weight: 600;
    font-size: 13px;
  }

  .ai-notice {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    justify-content: space-between;
    align-items: center;
    margin-block-start: -4px;
    padding-block: 10px;
    padding-inline: 14px;
    border-radius: 10px;
    background: color-mix(in sRGB, var(--editor-accent) 10%, transparent);
  }

  .ai-notice__text {
    flex: 1 1 200px;
    margin: 0;
    color: var(--editor-fg);
    font-size: 13px;
    text-wrap: pretty;
  }

  .ai-notice__action {
    display: flex;
    flex: none;
    gap: 8px;
    align-items: center;
  }
</style>
