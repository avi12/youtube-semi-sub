<script lang="ts">
  import { DELETE_ICON } from "./icons";
  import { compileTitleFilter } from "@/lib/filter/title-filter";
  import { MessageType, sendMessage } from "@/lib/messaging/extension-messaging";
  import type { FeedVideo } from "@/lib/schemas/feed-video";
  import type { SemiSubscription } from "@/lib/schemas/semi-subscription";
  import { setSemiSubscriptionFilter } from "@/lib/semi-subscription-storage";
  import { FilterEditor } from "#filter-editor";
  import { Button, ConnectedButtons, Icon } from "m3-svelte";
  import { onMount, untrack } from "svelte";

  interface Props {
    id: string;
    subscription: SemiSubscription;
    videos: FeedVideo[];
    isCached: boolean;
    onClose: () => void;
    onRemove: () => void;
  }

  const { id, subscription, videos, isCached, onClose, onRemove }: Props = $props();

  let draftFilter = $state(untrack(() => ({ ...subscription.filter })));
  let isFetching = $state(false);
  const isDraftValid = $derived(compileTitleFilter(draftFilter) !== null);

  onMount(async () => {
    if (isCached) {
      return;
    }

    isFetching = true;
    await sendMessage(MessageType.refreshChannel, { channelId: subscription.channelId }).catch(() => {});
    isFetching = false;
  });

  function focusPatternInput(elForm: HTMLFormElement) {
    elForm.querySelector("input")?.focus();
  }
</script>

<form
  {id}
  class="editor"
  {@attach focusPatternInput}
  aria-label="Filter for {subscription.title}"
  onsubmit={async e => {
    e.preventDefault();

    if (!isDraftValid) {
      return;
    }

    await setSemiSubscriptionFilter({
      channelId: subscription.channelId,
      filter: $state.snapshot(draftFilter)
    });
    onClose();
  }}>
  <FilterEditor isLoading={isFetching && videos.length === 0} {videos} bind:filter={draftFilter} />
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
