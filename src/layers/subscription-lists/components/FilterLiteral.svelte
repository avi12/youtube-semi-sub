<script lang="ts">
  import { AI_LITERAL_PREFIX, describeFilterLiteral, FilterLiteralKind, PAUSED_LABEL } from "./filter-literal";
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
{#if literal.kind === FilterLiteralKind.aiMatch}
  <span class={["yss-filter-literal", "yss-filter-literal--ai", literal.isPaused && "yss-filter-literal--paused"]}>
    <span class="yss-filter-literal__badge">{AI_LITERAL_PREFIX}</span>
    <bdi>{literal.text}</bdi>
    {#if literal.isPaused}
      <span class="yss-filter-literal__paused">{PAUSED_LABEL}</span>
    {/if}
  </span>
{:else if literal.kind === FilterLiteralKind.regex}
  <code class="yss-filter-literal" dir="ltr">{literal.text}</code>
{:else}
  <span class="yss-filter-literal yss-filter-literal--any">{literal.text}</span>
{/if}
