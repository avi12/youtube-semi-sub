<script lang="ts">
  import ChannelRow from "./ChannelRow.svelte";
  import { listsView } from "./lists-view.svelte";
  import { markSurface, SemiListSurface } from "./semi-list-surface";

  const titleId = $props.id();
</script>

<!-- www.youtube.com/feed/channels: sits above YouTube's own "All subscriptions" list -->
<section class="yss-channels" {@attach markSurface(SemiListSurface.channels)} aria-labelledby={titleId}>
  <h2 id={titleId} class="yss-channels__title">Semi-subscriptions</h2>
  <ul class="yss-channels__list">
    {#each listsView.subscriptions as subscription (subscription.channelId)}
      <ChannelRow {subscription} />
    {/each}
  </ul>
</section>
