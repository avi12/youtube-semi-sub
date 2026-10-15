<script lang="ts">
  import Disclosure from "./Disclosure.svelte";
  import { popTile, slideTile } from "./tile-motion";
  import type { PreviewRow, TitleFilterPreview } from "./title-matches";
  import { pluralize } from "@/lib/pluralize";
  import { formatRelativeTime } from "@/lib/youtube/relative-time";

  interface Props {
    /** `isStale`: the filter is mid-edit and invalid, so this is the last valid result */
    preview: TitleFilterPreview & { isStale: boolean };
    videoCount: number;
    isLoading: boolean;
    /** The filter input the summary describes */
    inputId: string;
  }

  const { preview, videoCount, isLoading, inputId }: Props = $props();

  const SKELETON_TILE_COUNT = 4;
  const SKELETON_TILES = Array.from({ length: SKELETON_TILE_COUNT }, (_, i) => i);
  const NOW = Date.now();

  const labelId = $derived(`${inputId}-preview-label`);
  const summaryText = $derived.by(() => {
    if (isLoading) {
      return "Fetching recent videos";
    }

    if (videoCount === 0) {
      return "No recent videos to preview yet";
    }

    if (preview.isStale || !preview.isValid) {
      return "Fix the pattern to update the preview";
    }

    const { matchCount, pendingCount } = preview;
    const noun = pluralize({
      count: videoCount,
      one: "video",
      other: "videos"
    });
    const verb = pluralize({
      count: matchCount,
      one: "matches",
      other: "match"
    });
    const matchSummary = `${matchCount} of ${videoCount} recent ${noun} ${verb}`;
    if (pendingCount === 0) {
      return matchSummary;
    }

    return `${matchSummary} - checking ${pendingCount} more`;
  });
</script>

{#snippet videoCard(row: PreviewRow)}
  <img
    class="video__thumbnail"
    alt=""
    decoding="async"
    loading="lazy"
    src={row.video.thumbnailUrl} />
  <span class="video__text">
    <span class="video__title">
      <bdi>
        {#each row.segments as segment, i (i)}
          {#if segment.isHighlighted}
            <mark class="video__match">{segment.text}</mark>
          {:else}
            {segment.text}
          {/if}
        {/each}
      </bdi>
    </span>
    <time class="video__time" datetime={new Date(row.video.publishedAt).toISOString()}>
      {formatRelativeTime({
        time: row.video.publishedAt,
        now: NOW
      })}
    </time>
  </span>
{/snippet}

<section class="preview" aria-labelledby={labelId}>
  <header class="preview__header">
    <span id={labelId} class="preview__label">Lands in your feed</span>
    <output class="preview__summary" for={inputId}>{summaryText}</output>
  </header>

  {#if isLoading}
    <ul class="feed" aria-busy="true">
      {#each SKELETON_TILES as tile (tile)}
        <li class="tile tile--skeleton" aria-hidden="true">
          <span class="video__thumbnail"></span>
          <span class="tile__placeholder"></span>
          <span class="tile__placeholder tile__placeholder--short"></span>
        </li>
      {/each}
    </ul>
  {:else if videoCount > 0}
    <ul class={["feed", preview.isStale && "feed--stale"]}>
      {#each preview.feedRows as row (row.video.videoId)}
        <li
          class="tile"
          data-match-state={row.matchState}
          in:popTile
          out:popTile
          animate:slideTile>
          {@render videoCard(row)}
        </li>
      {:else}
        <li class="feed__empty">
          {#if preview.isValid}
            Nothing recent matches - try a looser pattern
          {:else}
            Fix the pattern to see what lands in your feed
          {/if}
        </li>
      {/each}
    </ul>
    {#if preview.skippedRows.length > 0}
      <Disclosure>
        {#snippet summary()}
          {preview.skippedRows.length} won't appear
        {/snippet}
        <ul class="skipped">
          {#each preview.skippedRows as row (row.video.videoId)}
            <li class="skipped__item">
              {@render videoCard(row)}
            </li>
          {/each}
        </ul>
      </Disclosure>
    {/if}
  {/if}
</section>

<style>
  .preview {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .preview__header {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    justify-content: space-between;
    align-items: baseline;
  }

  .preview__label {
    color: var(--editor-fg);
    font-weight: 600;
    font-size: 13px;
  }

  .preview__summary {
    color: var(--editor-muted);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .feed {
    position: relative;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 136px), 1fr));
    gap: 14px 10px;
    overflow-y: auto;
    overscroll-behavior: contain;
    max-block-size: var(--filter-editor-preview-max-block-size, 340px);
    margin: 0;
    padding: 2px;
    scrollbar-width: thin;
    list-style: none;

    @media (prefers-reduced-motion: no-preference) {
      transition: opacity 150ms var(--editor-ease);
    }
  }

  .feed--stale {
    opacity: 45%;
  }

  .feed__empty {
    grid-column: 1 / -1;
    padding-block: 20px;
    padding-inline: 12px;
    border: 1px dashed var(--editor-border);
    border-radius: 10px;
    color: var(--editor-muted);
    font-size: 13px;
    text-align: center;
  }

  .tile {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-inline-size: 0;
  }

  .tile[data-match-state="pending"] {
    opacity: 55%;

    @media (prefers-reduced-motion: no-preference) {
      animation: placeholder-pulse 1200ms ease-in-out infinite alternate;
    }
  }

  .video__thumbnail {
    display: block;
    object-fit: cover;
    inline-size: 100%;
    border-radius: 8px;
    background: color-mix(in sRGB, var(--editor-fg) 10%, transparent);
    aspect-ratio: 16 / 9;
  }

  .video__text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-inline-size: 0;
  }

  .video__title {
    display: -webkit-box;
    overflow: hidden;
    color: var(--editor-fg);
    font-weight: 500;
    font-size: 13px;
    line-height: 1.35;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .video__time {
    color: var(--editor-muted);
    font-size: 12px;
  }

  .video__match {
    padding-inline: 1px;
    border-radius: 3px;
    background: color-mix(in sRGB, var(--editor-accent) 28%, transparent);
    color: inherit;
    box-decoration-break: clone;
    font-weight: 700;
  }

  .tile__placeholder {
    block-size: 12px;
    border-radius: 4px;
    background: color-mix(in sRGB, var(--editor-fg) 10%, transparent);
  }

  .tile__placeholder--short {
    inline-size: 45%;
  }

  .tile--skeleton > * {
    @media (prefers-reduced-motion: no-preference) {
      animation: placeholder-pulse 1200ms ease-in-out infinite alternate;
    }
  }

  @keyframes placeholder-pulse {
    to {
      opacity: 45%;
    }
  }

  .skipped {
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow-y: auto;
    overscroll-behavior: contain;
    max-block-size: 240px;
    margin: 0;
    margin-block-start: 6px;
    padding: 0;
    scrollbar-width: thin;
    list-style: none;
  }

  .skipped__item {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    opacity: 60%;

    & .video__thumbnail {
      border-radius: 6px;
      filter: grayscale(1);
    }

    & .video__title {
      font-weight: 400;
      font-size: 12px;
    }
  }
</style>
