<script lang="ts">
  import ChannelAvatar from "./ChannelAvatar.svelte";
  import FilterGlyph from "./FilterGlyph.svelte";
  import FilterLiteral from "./FilterLiteral.svelte";
  import { getManageLabel, opensSemiSubDialog } from "./open-dialog";
  import { followsChannelLink } from "./spa-navigation";
  import type { SemiSubscription } from "@/lib/schemas/semi-subscription";
  import { formatHandle } from "@/lib/youtube/channel-link";
  import { listsView } from "#subscription-lists/lists-view.svelte";
  import { getChannelPath } from "#subscription-lists/semi-channels";

  const { subscription }: { subscription: SemiSubscription } = $props();

  const channelPath = $derived(getChannelPath(subscription));
</script>

<li class="yss-channel">
  <a
    class="yss-channel__avatar-link"
    {@attach followsChannelLink(subscription)}
    aria-hidden="true"
    href={channelPath}
    tabindex="-1">
    <ChannelAvatar {subscription} />
  </a>

  <div class="yss-channel__info-section">
    <a class="yss-channel__info" {@attach followsChannelLink(subscription)} href={channelPath}>
      <h3 class="yss-channel__title" dir="auto">{subscription.title}</h3>
      {#if subscription.handle}
        <p class="yss-channel__metadata" dir="auto">{formatHandle(subscription.handle)}</p>
      {/if}
      <p class="yss-channel__filter">
        <FilterLiteral
          filter={subscription.filter}
          isAiEnabled={listsView.isAiEnabled}
          isHalted={subscription.isHalted} />
      </p>
    </a>

    <button
      class="yss-button"
      {@attach opensSemiSubDialog(subscription)}
      aria-haspopup="dialog"
      title={getManageLabel(subscription)}
      type="button">
      <FilterGlyph />
      Semi-subscribed
    </button>
  </div>
</li>
