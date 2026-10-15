<script lang="ts">
  import ChannelAvatar from "./ChannelAvatar.svelte";
  import FilterGlyph from "./FilterGlyph.svelte";
  import { listsView } from "./lists-view.svelte";
  import { getManageLabel, opensSemiSubDialog } from "./open-dialog";
  import { getChannelPath } from "./semi-channels";
  import { markSurface, SemiListSurface } from "./semi-list-surface";
</script>

<!-- m.youtube.com/feed/subscriptions: leads the horizontal channel strip above the feed -->
{#each listsView.subscriptions as subscription (subscription.channelId)}
  <div class="yss-m-strip-item" {@attach markSurface(SemiListSurface.mobileStrip)}>
    <a class="yss-m-strip-item__link" href={getChannelPath(subscription)}>
      <ChannelAvatar {subscription} />
      <span class="yss-m-strip-item__title" dir="auto">{subscription.title}</span>
    </a>
    <button
      class="yss-m-strip-item__manage"
      {@attach opensSemiSubDialog(subscription)}
      aria-haspopup="dialog"
      aria-label={getManageLabel(subscription)}
      type="button">
      <FilterGlyph />
    </button>
  </div>
{/each}
