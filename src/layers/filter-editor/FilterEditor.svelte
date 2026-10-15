<script lang="ts">
  import { previewTitleFilter, type TitleFilterPreview } from "./title-matches";
  import { FilterKind, type RegexFilter, type TitleFilter } from "@/lib/filter/title-filter";
  import type { FeedVideo } from "@/lib/schemas/feed-video";
  import FilterPreview from "#filter-editor/components/FilterPreview.svelte";
  import RegexFilterFields from "#filter-editor/components/RegexFilterFields.svelte";

  interface Props {
    filter: TitleFilter;
    /** A sample of the channel's recent uploads to preview the filter on - may be empty */
    videos: FeedVideo[];
    isLoading?: boolean;
  }

  let { filter = $bindable(), videos, isLoading = false }: Props = $props();

  const id = $props.id();
  const inputId = `${id}-filter`;

  let lastValidPreview: {
    videos: FeedVideo[];
    preview: TitleFilterPreview;
  } | null = null;

  const regexFilter = $derived.by(() => {
    if (filter.kind === FilterKind.regex) {
      return filter;
    }

    return null;
  });

  /** While the pattern is mid-edit and invalid, keep showing the last valid result instead of emptying the feed */
  function buildPreview(currentFilter: RegexFilter) {
    const currentPreview = previewTitleFilter({
      filter: currentFilter,
      videos
    });
    if (currentPreview.isValid) {
      lastValidPreview = {
        videos,
        preview: currentPreview
      };
      return {
        ...currentPreview,
        isStale: false
      };
    }

    const isLastValidPreviewCurrent = lastValidPreview?.videos === videos;
    if (lastValidPreview && isLastValidPreviewCurrent) {
      return {
        ...lastValidPreview.preview,
        isStale: true
      };
    }

    return {
      ...currentPreview,
      isStale: false
    };
  }
</script>

<div class="filter-editor">
  <header class="filter-editor__header">
    <label class="filter-editor__label" for={inputId}>Title filter</label>
  </header>
  {#if regexFilter}
    <RegexFilterFields
      {inputId}
      bind:filter={() => regexFilter, editedFilter => {
        filter = editedFilter;
      }} />
    <FilterPreview {inputId} {isLoading} preview={buildPreview(regexFilter)} videoCount={videos.length} />
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
</style>
