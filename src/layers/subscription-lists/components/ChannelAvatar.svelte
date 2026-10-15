<script lang="ts">
  import { getChannelInitial } from "@/lib/schemas/channel";
  import type { SemiSubscription } from "@/lib/schemas/semi-subscription";

  const { subscription }: { subscription: SemiSubscription } = $props();

  const initial = $derived(getChannelInitial(subscription.title));
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
