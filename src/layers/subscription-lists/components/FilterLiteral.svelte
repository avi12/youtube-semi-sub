<script lang="ts">
  import { FilterKind, type TitleFilter } from "@/lib/filter/title-filter";

  const { filter }: { filter: TitleFilter } = $props();
</script>

{#if filter.kind === FilterKind.aiMatch}
  <span class="yss-filter-literal yss-filter-literal--any" dir="auto">{filter.description}</span>
{:else if filter.pattern}
  <code class="yss-filter-literal" dir="ltr">/{filter.pattern}/{filter.flags}</code>
{:else}
  <span class="yss-filter-literal yss-filter-literal--any">Any title</span>
{/if}
