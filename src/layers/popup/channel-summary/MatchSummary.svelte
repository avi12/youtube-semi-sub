<script lang="ts">
  import type { AiJudgeContext } from "@/lib/filter/judge/condition-judges";
  import { listAiFilters, MatchState, type VideoFilter } from "@/lib/filter/schema/video-filter-schema";
  import { createModeJudge, isFilterInert } from "@/lib/filter/title-filter";
  import type { FeedVideo } from "@/lib/schemas/feed-video";
  import { SubscriptionMode } from "@/lib/schemas/subscription-mode";
  import { pluralize } from "@/lib/utils/pluralize";

  interface Props extends AiJudgeContext {
    filter: VideoFilter | null;
    mode: SubscriptionMode;
    videos: FeedVideo[];
    /** The channel's uploads have been fetched at least once */
    isCached: boolean;
  }

  const { filter, mode, videos, isCached, aiVerdicts, isAiEnabled }: Props = $props();

  const MATCH_WORDING = {
    [SubscriptionMode.FOLLOW]: {
      matched: "matching",
      inertSummary: "Adds nothing yet"
    },
    [SubscriptionMode.HIDE]: {
      matched: "hidden",
      inertSummary: "Hides nothing yet"
    }
  } as const;

  const wording = $derived(MATCH_WORDING[mode]);
  const isInert = $derived(
    isFilterInert({
      filter,
      mode
    })
  );
  const videosOldestFirst = $derived(videos.toSorted((left, right) => left.publishedAt - right.publishedAt));
  /** The same judge the feed is filtered by in this mode - null while the filter can't run (AI match is off) */
  const judge = $derived(
    createModeJudge({
      filter,
      mode,
      aiVerdicts,
      isAiEnabled
    })
  );
  const isPaused = $derived(judge === null && listAiFilters(filter).length > 0 && !isAiEnabled);
  const matchStateById = $derived(
    new Map(videos.map(video => [video.videoId, judge?.(video) ?? MatchState.DOES_NOT_MATCH]))
  );
  const matchStates = $derived([...matchStateById.values()]);
  const matchCount = $derived(matchStates.filter(matchState => matchState === MatchState.MATCHES).length);
  const pendingCount = $derived(matchStates.filter(matchState => matchState === MatchState.PENDING).length);
  const matchSummary = $derived.by(() => {
    if (isInert) {
      return wording.inertSummary;
    }

    if (isPaused) {
      return "Paused - AI match is off";
    }

    if (!isCached) {
      return "Waiting for the first check";
    }

    const noun = pluralize({
      count: matchCount,
      one: "video",
      other: "videos"
    });
    const summary = `${matchCount} ${wording.matched} ${noun}`;
    if (pendingCount === 0) {
      return summary;
    }

    return `${summary} - checking ${pendingCount} more`;
  });
</script>

<p class="matches">
  {#if videosOldestFirst.length > 0}
    <span class="matches__strip" aria-hidden="true">
      {#each videosOldestFirst as video (video.videoId)}
        <span class="matches__tick" data-match-state={matchStateById.get(video.videoId)} title={video.title}></span>
      {/each}
    </span>
  {/if}
  <span class="matches__summary">{matchSummary}</span>
</p>

<style>
  .matches {
    display: flex;
    gap: 10px;
    align-items: center;
    margin: 0;
  }

  .matches__strip {
    display: flex;
    gap: 2px;
  }

  .matches__tick {
    block-size: 14px;
    inline-size: 5px;
    border-radius: 3px;
    background: var(--m3c-outline-variant);
  }

  .matches__tick[data-match-state="matches"] {
    background: var(--m3c-primary);
  }

  .matches__tick[data-match-state="pending"] {
    background: transparent;
    box-shadow: inset 0 0 0 1.5px var(--m3c-outline-variant);
  }

  .matches__summary {
    color: var(--m3c-on-surface-variant);
    font-weight: 500;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
</style>
