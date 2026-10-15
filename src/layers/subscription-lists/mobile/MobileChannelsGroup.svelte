<script lang="ts">
  import ChannelAvatar from "#subscription-lists/components/ChannelAvatar.svelte";
  import FilterGlyph from "#subscription-lists/components/FilterGlyph.svelte";
  import FilterLiteral from "#subscription-lists/components/FilterLiteral.svelte";
  import { describeManageButton, opensSemiSubDialog } from "#subscription-lists/components/open-dialog";
  import { listsView } from "#subscription-lists/lists-view.svelte";
  import { getChannelPath } from "#subscription-lists/semi-channels";
  import { markSurface, SemiListSurface } from "#subscription-lists/semi-list-surface";

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
            <FilterLiteral isAiEnabled={listsView.isAiEnabled} {subscription} />
          </span>
        </a>
        <button
          class="yss-icon-button"
          {@attach opensSemiSubDialog(subscription)}
          aria-haspopup="dialog"
          aria-label={describeManageButton(subscription).accessibilityText}
          type="button">
          <FilterGlyph />
        </button>
      </li>
    {/each}
  </ul>
</section>
