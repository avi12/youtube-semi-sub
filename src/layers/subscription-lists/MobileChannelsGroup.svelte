<script lang="ts">
  import ChannelAvatar from "./ChannelAvatar.svelte";
  import FilterGlyph from "./FilterGlyph.svelte";
  import FilterLiteral from "./FilterLiteral.svelte";
  import { listsView } from "./lists-view.svelte";
  import { getManageLabel, opensSemiSubDialog } from "./open-dialog";
  import { getChannelPath } from "./semi-channels";
  import { markSurface, SemiListSurface } from "./semi-list-surface";

  const titleId = $props.id();
</script>

<!-- m.youtube.com/feed/channels: above YouTube's own "All channels" shelf. m.youtube.com routes plain links itself -->
<section class="yss-m-channels" {@attach markSurface(SemiListSurface.mobileChannels)} aria-labelledby={titleId}>
  <h2 id={titleId} class="yss-m-channels__title">Semi-subscriptions</h2>
  <ul class="yss-m-channels__list">
    {#each listsView.subscriptions as subscription (subscription.channelId)}
      <li class="yss-m-channel">
        <a class="yss-m-channel__link" href={getChannelPath(subscription)}>
          <ChannelAvatar {subscription} />
          <span class="yss-m-channel__text">
            <span class="yss-m-channel__title" dir="auto">{subscription.title}</span>
            <FilterLiteral filter={subscription.filter} />
          </span>
        </a>
        <button
          class="yss-icon-button"
          {@attach opensSemiSubDialog(subscription)}
          aria-haspopup="dialog"
          aria-label={getManageLabel(subscription)}
          type="button">
          <FilterGlyph />
        </button>
      </li>
    {/each}
  </ul>
</section>
