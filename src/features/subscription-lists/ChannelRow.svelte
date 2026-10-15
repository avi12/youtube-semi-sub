<script lang="ts">
  import ChannelAvatar from "./ChannelAvatar.svelte";
  import FilterGlyph from "./FilterGlyph.svelte";
  import FilterLiteral from "./FilterLiteral.svelte";
  import { getManageLabel, opensSemiSubDialog } from "./open-dialog";
  import { getChannelPath } from "./semi-channels";
  import { followsChannelLink } from "./spa-navigation";
  import { formatHandle } from "@/features/popup/channel-link";
  import type { SemiSubscription } from "@/lib/semi-subscription";

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
        <FilterLiteral filter={subscription.filter} />
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
