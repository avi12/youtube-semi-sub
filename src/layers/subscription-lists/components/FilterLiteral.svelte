<script lang="ts">
  import { FilterKind, isHidingNothing } from "@/lib/filter/title-filter";
  import { getModeFilter, getSubscriptionMode, type SemiSubscription } from "@/lib/schemas/semi-subscription";
  import { SUBSCRIPTION_MODE_NAME } from "@/lib/schemas/subscription-mode";

  const { subscription, isAiEnabled }: {
    subscription: SemiSubscription;
    isAiEnabled: boolean;
  } = $props();

  const mode = $derived(getSubscriptionMode(subscription));
  const filter = $derived(
    getModeFilter({
      subscription,
      mode
    })
  );
  const isHidingNone = $derived(
    isHidingNothing({
      filter,
      mode
    })
  );
</script>

<span class="yss-filter-literal__mode">{SUBSCRIPTION_MODE_NAME[mode]}</span>
{#if filter.kind === FilterKind.aiMatch}
  <span class={["yss-filter-literal", "yss-filter-literal--ai", !isAiEnabled && "yss-filter-literal--paused"]}>
    <span class="yss-filter-literal__badge">AI</span>
    <bdi>{filter.description}</bdi>
    {#if !isAiEnabled}
      <span class="yss-filter-literal__paused">paused</span>
    {/if}
  </span>
{:else if isHidingNone}
  <span class="yss-filter-literal yss-filter-literal--any">Nothing hidden</span>
{:else if filter.pattern}
  <code class="yss-filter-literal" dir="ltr">/{filter.pattern}/{filter.flags}</code>
{:else}
  <span class="yss-filter-literal yss-filter-literal--any">Any title</span>
{/if}
