<script lang="ts">
  import ChannelEditor from "./ChannelEditor.svelte";
  import { EDIT_ICON, OPEN_IN_NEW_ICON } from "./icons";
  import type { AiJudgeContext } from "@/lib/filter/judge/condition-judges";
  import { getChannelInitial } from "@/lib/schemas/channel";
  import type { ChannelVideos } from "@/lib/schemas/feed-video";
  import { getModeFilter, getSubscriptionMode, type SemiSubscription } from "@/lib/schemas/semi-subscription";
  import { SUBSCRIPTION_MODE_NAME } from "@/lib/schemas/subscription-mode";
  import { formatHandle, getChannelUrl } from "@/lib/youtube/channel-link";
  import FilterLiteral from "#popup/channel-summary/FilterLiteral.svelte";
  import MatchSummary from "#popup/channel-summary/MatchSummary.svelte";
  import Button from "#popup/ui/buttons/Button.svelte";
  import Icon from "#popup/ui/Icon.svelte";
  import ListCard from "#popup/ui/list/ListCard.svelte";
  import { tick } from "svelte";

  interface Props extends AiJudgeContext {
    subscription: SemiSubscription;
    channelVideos: ChannelVideos | undefined;
    isEditing: boolean;
    onEditingChange: (isEditing: boolean) => void;
    onRemove: () => void;
  }

  const {
    subscription,
    channelVideos,
    aiVerdicts,
    isAiEnabled,
    isEditing,
    onEditingChange,
    onRemove
  }: Props = $props();

  const id = $props.id();
  const EDITOR_ID = `${id}-editor`;
  let elEditToggle = $state<HTMLInputElement>();

  const mode = $derived(getSubscriptionMode(subscription));
  const filter = $derived(
    getModeFilter({
      subscription,
      mode
    })
  );
  const isCached = $derived(channelVideos !== undefined);
  const videos = $derived(channelVideos?.videos ?? []);
  const initial = $derived(getChannelInitial(subscription.title));

  async function closeEditor() {
    onEditingChange(false);
    await tick();
    elEditToggle?.focus();
  }
</script>

<ListCard>
  <div class="channel">
    <div class="channel__header">
      {#if subscription.avatarUrl}
        <img
          class="channel__avatar"
          alt=""
          decoding="async"
          loading="lazy"
          referrerpolicy="no-referrer"
          src={subscription.avatarUrl} />
      {:else}
        <span class="channel__avatar channel__avatar--initial" aria-hidden="true">{initial}</span>
      {/if}

      <div class="channel__identity">
        <h3 class="channel__title"><bdi>{subscription.title}</bdi></h3>
        <p class="channel__mode">{SUBSCRIPTION_MODE_NAME[mode]}</p>
        <a
          class="channel__link"
          href={getChannelUrl(subscription)}
          rel="noreferrer"
          target="_blank">
          {#if subscription.handle}
            {formatHandle(subscription.handle)}
          {:else}
            Open channel
          {/if}
          <Icon path={OPEN_IN_NEW_ICON} />
        </a>
      </div>

      <Button isLabel size="xs" variant="tonal">
        <input
          bind:this={elEditToggle}
          aria-controls={EDITOR_ID}
          type="checkbox"
          bind:checked={() => isEditing, isChecked => {
          if (isChecked) {
            onEditingChange(true);
            return;
          }

          void closeEditor();
        }} />
        <Icon path={EDIT_ICON} />
        Edit
      </Button>
    </div>

    {#if isEditing}
      <ChannelEditor
        id={EDITOR_ID}
        {isCached}
        {mode}
        onClose={closeEditor}
        {onRemove}
        {subscription}
        {videos} />
    {:else}
      <div class="channel__summary">
        <FilterLiteral {isAiEnabled} {subscription} />
        <MatchSummary {aiVerdicts} {filter} {isAiEnabled} {isCached} {mode} {videos} />
      </div>
    {/if}
  </div>
</ListCard>

<style>
  .channel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-block: 14px;
    padding-inline: 16px;
  }

  .channel__header {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
  }

  .channel__avatar {
    object-fit: cover;
    block-size: 40px;
    inline-size: 40px;
    border-radius: 50%;
    background: var(--m3c-primary-container);
  }

  .channel__avatar--initial {
    display: grid;
    place-items: center;
    color: var(--m3c-on-primary-container);
    font-weight: 600;
    font-size: 17px;
  }

  .channel__identity {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
  }

  .channel__title {
    overflow: hidden;
    margin: 0;
    color: var(--m3c-on-surface);
    font-weight: 500;
    font-size: 16px;
    line-height: 1.4;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .channel__mode {
    overflow: hidden;
    margin: 0;
    color: var(--m3c-primary);
    font-weight: 500;
    font-size: 12px;
    line-height: 1.4;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .channel__link {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    overflow: hidden;
    inline-size: fit-content;
    max-inline-size: 100%;
    color: var(--m3c-on-surface-variant);
    font-weight: 500;
    font-size: 12px;
    text-decoration: none;
    text-overflow: ellipsis;
    white-space: nowrap;

    &:hover {
      color: var(--m3c-primary);
      text-decoration: underline;
    }
  }

  .channel__summary {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-inline-start: 52px;
  }
</style>
