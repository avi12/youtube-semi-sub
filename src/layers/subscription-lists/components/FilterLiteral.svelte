<script lang="ts">
  import { AI_LITERAL_PREFIX, describeFilterLiteral, FilterLiteralKind, PAUSED_LABEL } from "@/lib/filter/filter-literal";
  import type { SemiSubscription } from "@/lib/schemas/semi-subscription";

  const { subscription, isAiEnabled }: {
    subscription: SemiSubscription;
    isAiEnabled: boolean;
  } = $props();

  const literal = $derived(
    describeFilterLiteral({
      subscription,
      isAiEnabled
    })
  );
</script>

<span class="yss-filter-literal__mode">{literal.modeName}</span>
{#each literal.parts as part, i (i)}
  {#if i > 0}
    <span class="yss-filter-literal__connector">{literal.connector}</span>
  {/if}
  {#if part.kind === FilterLiteralKind.AI_MATCH}
    <span class={["yss-filter-literal", "yss-filter-literal--ai", part.isPaused && "yss-filter-literal--paused"]}>
      <span class="yss-filter-literal__badge">{AI_LITERAL_PREFIX}</span>
      <bdi>{part.text}</bdi>
      {#if part.isPaused}
        <span class="yss-filter-literal__paused">{PAUSED_LABEL}</span>
      {/if}
    </span>
  {:else if part.kind === FilterLiteralKind.REGEX}
    <code class="yss-filter-literal" dir="ltr">/{part.text}/{part.flags}</code>
  {:else}
    <span class="yss-filter-literal yss-filter-literal--any">{part.text}</span>
  {/if}
{/each}
