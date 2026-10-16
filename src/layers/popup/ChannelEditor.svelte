<script lang="ts">
  import { DELETE_ICON } from "./icons";
  import { DEFAULT_TITLE_FILTER, isTitleFilterValid, type TitleFilter } from "@/lib/filter/title-filter";
  import { MessageType, sendMessage } from "@/lib/messaging/extension-messaging";
  import type { FeedVideo } from "@/lib/schemas/feed-video";
  import { getModeFilter, type SemiSubscription } from "@/lib/schemas/semi-subscription";
  import type { SubscriptionMode } from "@/lib/schemas/subscription-mode";
  import { setSemiSubscriptionFilter } from "@/lib/semi-subscription-storage";
  import { FilterEditor } from "#filter-editor";
  import AiSetupAction from "#popup/ai/AiSetupAction.svelte";
  import { Button, ConnectedButtons, Icon } from "m3-svelte";
  import { onMount, untrack } from "svelte";

  interface Props {
    id: string;
    subscription: SemiSubscription;
    /** The mode whose filter this edits - the one that applies when the editor opens */
    mode: SubscriptionMode;
    videos: FeedVideo[];
    isCached: boolean;
    onClose: () => void;
    onRemove: () => void;
  }

  const { id, subscription, mode, videos, isCached, onClose, onRemove }: Props = $props();

  let draftFilter = $state<TitleFilter>(
    untrack(() => ({
      ...getModeFilter({
        subscription,
        mode
      }) ?? DEFAULT_TITLE_FILTER
    }))
  );
  let isFetching = $state(false);
  const isDraftValid = $derived(isTitleFilterValid(draftFilter));

  onMount(async () => {
    if (isCached) {
      return;
    }

    isFetching = true;
    await sendMessage(MessageType.refreshChannel, { channelId: subscription.channelId }).catch(() => {});
    isFetching = false;
  });

  function focusFilterInput(elForm: HTMLFormElement) {
    elForm.querySelector<HTMLElement>("[data-filter-input]")?.focus();
  }
</script>

<form
  {id}
  class="editor"
  {@attach focusFilterInput}
  aria-label="Filter for {subscription.title}"
  onsubmit={async e => {
    e.preventDefault();

    if (!isDraftValid) {
      return;
    }

    await setSemiSubscriptionFilter({
      channelId: subscription.channelId,
      mode,
      filter: $state.snapshot(draftFilter)
    });
    onClose();
  }}>
  <FilterEditor
    isLoading={isFetching && videos.length === 0}
    {mode}
    {videos}
    bind:filter={draftFilter}>
    {#snippet aiSetup({ isAiEnabled })}
      <AiSetupAction {isAiEnabled} />
    {/snippet}
  </FilterEditor>
  <footer class="editor__actions">
    <Button iconType="left" onclick={onRemove} size="s" variant="text">
      <Icon icon={DELETE_ICON} />
      Remove
    </Button>
    <ConnectedButtons>
      <Button onclick={onClose} size="s" square variant="tonal">Cancel</Button>
      <Button disabled={!isDraftValid} size="s" square type="submit" variant="filled">Save</Button>
    </ConnectedButtons>
  </footer>
</form>

<style>
  .editor {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-block: 16px 4px;

    @media (prefers-reduced-motion: no-preference) {
      @starting-style {
        opacity: 0%;
        translate: 0 -6px;
      }

      transition:
        opacity var(--m3-easing),
        translate var(--m3-easing-spatial);
    }
  }

  .editor__actions {
    display: flex;
    gap: 8px;
    justify-content: space-between;
    align-items: center;
  }
</style>
