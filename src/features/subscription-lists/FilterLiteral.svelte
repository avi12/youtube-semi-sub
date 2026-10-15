<script lang="ts">
  import type { TitleFilter } from "@/lib/title-filter";

  const { filter }: { filter: TitleFilter } = $props();
</script>

{#if filter.pattern}
  <code class="yss-filter-literal" dir="ltr">/{filter.pattern}/{filter.flags}</code>
{:else}
  <span class="yss-filter-literal yss-filter-literal--any">Any title</span>
{/if}
