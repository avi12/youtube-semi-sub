<script lang="ts">
  import { DELETE_ICON } from "./icons";
  import type { FeedVideo } from "@/lib/feed-video";
  import { MessageType, sendMessage } from "@/lib/messaging/extension-messaging";
  import type { SemiSubscription } from "@/lib/semi-subscription";
  import { mutateStorageItem, semiSubscriptionsItem } from "@/lib/storage";
  import { compileTitleFilter } from "@/lib/title-filter";
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

    const { channelId } = subscription;
    const filter = $state.snapshot(draftFilter);
    await mutateStorageItem({
      item: semiSubscriptionsItem,
      mutator(subscriptions) {
        const current = subscriptions[channelId];
        if (!current) {
          return subscriptions;
        }

        return {
          ...subscriptions,
          [channelId]: {
            ...current,
            filter
          }
        };
      }
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
