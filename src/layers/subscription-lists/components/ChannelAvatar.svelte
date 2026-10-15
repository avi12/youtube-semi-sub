<script lang="ts">
  import type { SemiSubscription } from "@/lib/schemas/semi-subscription";

  const { subscription }: { subscription: SemiSubscription } = $props();

  const initial = $derived(Array.from(subscription.title).at(0) ?? "");
</script>

{#if subscription.avatarUrl}
  <img
    class="yss-avatar"
    alt=""
    decoding="async"
    draggable="false"
    loading="lazy"
    src={subscription.avatarUrl} />
{:else}
  <span class="yss-avatar yss-avatar--initial" aria-hidden="true">{initial}</span>
{/if}
