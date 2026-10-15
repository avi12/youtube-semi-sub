<script lang="ts">
  import { FilterKind, type TitleFilter } from "@/lib/filter/title-filter";

  const { filter, isAiEnabled, isHalted }: {
    filter: TitleFilter;
    isAiEnabled: boolean;
    /** Officially subscribed, so nothing reaches the feed until they unsubscribe */
    isHalted: boolean;
  } = $props();
</script>

{#if filter.kind === FilterKind.aiMatch}
  <span class={["yss-filter-literal", "yss-filter-literal--ai", !isAiEnabled && "yss-filter-literal--paused"]}>
    <span class="yss-filter-literal__badge">AI</span>
    <bdi>{filter.description}</bdi>
    {#if !isAiEnabled}
      <span class="yss-filter-literal__paused">paused</span>
    {/if}
  </span>
{:else if filter.pattern}
  <code class="yss-filter-literal" dir="ltr">/{filter.pattern}/{filter.flags}</code>
{:else}
  <span class="yss-filter-literal yss-filter-literal--any">Any title</span>
{/if}
{#if isHalted}
  <span class="yss-filter-literal__paused">Paused - you're subscribed</span>
{/if}
