<script lang="ts">
  import ChannelAvatar from "#subscription-lists/components/ChannelAvatar.svelte";
  import FilterGlyph from "#subscription-lists/components/FilterGlyph.svelte";
  import { describeManageButton, opensSemiSubDialog } from "#subscription-lists/components/open-dialog";
  import { listsView } from "#subscription-lists/lists-view.svelte";
  import { getChannelPath, listFollowedSubscriptions } from "#subscription-lists/semi-channels";
  import { markSurface, SemiListSurface } from "#subscription-lists/semi-list-surface";
</script>

<!-- m.youtube.com/feed/subscriptions: leads the horizontal channel strip above the feed -->
{#each listFollowedSubscriptions(listsView.subscriptions) as subscription (subscription.channelId)}
  <div class="yss-m-strip-item" {@attach markSurface(SemiListSurface.mobileStrip)}>
    <a class="yss-m-strip-item__link" href={getChannelPath(subscription)}>
      <ChannelAvatar {subscription} />
      <span class="yss-m-strip-item__title" dir="auto">{subscription.title}</span>
    </a>
    <button
      class="yss-m-strip-item__manage"
      {@attach opensSemiSubDialog(subscription)}
      aria-haspopup="dialog"
      aria-label={describeManageButton(subscription).accessibilityText}
      type="button">
      <FilterGlyph />
    </button>
  </div>
{/each}
