<script lang="ts">
  import { listAiFilters, selectFeedVideos, selectHiddenVideoIds } from "@/lib/filter/title-filter";
  import { MessageType, sendMessage } from "@/lib/messaging/extension-messaging";
  import { videosByChannelFromCache } from "@/lib/schemas/feed-video";
  import {
    getActiveFilter,
    isUploadsWatched,
    listByTitle,
    type SemiSubscription
  } from "@/lib/schemas/semi-subscription";
  import type { StoredState } from "@/lib/schemas/stored-state";
  import { removeSemiSubscription, restoreSemiSubscription } from "@/lib/semi-subscription-storage";
  import { isAnimationsEnabledItem, isExtensionEnabledItem, readStoredState, watchStoredState } from "@/lib/storage";
  import { prefersReducedMotion } from "@/lib/utils/motion";
  import { pluralize } from "@/lib/utils/pluralize";
  import { formatRelativeTime } from "@/lib/youtube/relative-time";
  import { followModelDownload, refreshAiStatus } from "#popup/ai/ai-match-setup.svelte";
  import AiMatchCard from "#popup/ai/AiMatchCard.svelte";
  import ChannelRow from "#popup/ChannelRow.svelte";
  import EmptyState from "#popup/EmptyState.svelte";
  import { LOADING_INDICATOR_SIZE, REFRESH_ICON } from "#popup/icons";
  import Button from "#popup/ui/Button.svelte";
  import Icon from "#popup/ui/Icon.svelte";
  import ListItem from "#popup/ui/ListItem.svelte";
  import LoadingIndicator from "#popup/ui/LoadingIndicator.svelte";
  import Snackbar from "#popup/ui/Snackbar.svelte";
  import { showSnackbar } from "#popup/ui/snackbar-state.svelte";
  import Switch from "#popup/ui/Switch.svelte";
  import { untrack } from "svelte";

  interface Props {
    initialState: StoredState;
  }

  const { initialState }: Props = $props();

  const UNDO_SNACKBAR_TIMEOUT_MS = 10_000;
  const IS_MOTION_ALLOWED = !prefersReducedMotion();

  let storedState = $state.raw(untrack(() => initialState));
  const { subscriptions, channelVideos, aiVerdicts, isAiEnabled, isExtensionEnabled, isAnimationsEnabled } = $derived(
    storedState
  );
  let editingChannelId = $state<string | null>(null);
  let announcement = $state("");
  let isRefreshing = $state(false);
  let isRefreshFailed = $state(false);

  $effect(() =>
    watchStoredState(async () => {
      storedState = await readStoredState();
    }));

  $effect(() => {
    void refreshAiStatus();
    return followModelDownload();
  });

  const subscriptionList = $derived(listByTitle(subscriptions));
  const aiFilterCount = $derived(
    subscriptionList.filter(subscription => listAiFilters(getActiveFilter(subscription)).length > 0).length
  );
  const filterInput = $derived({
    subscriptions,
    videosByChannel: videosByChannelFromCache(channelVideos),
    aiVerdicts,
    isAiEnabled
  });
  const feedVideos = $derived(selectFeedVideos(filterInput));
  const hiddenVideoCount = $derived(selectHiddenVideoIds(filterInput).length);
  const followedCount = $derived(subscriptionList.filter(subscription => !subscription.isSubscribed).length);
  const watchedList = $derived(subscriptionList.filter(isUploadsWatched));
  const feedSummary = $derived.by(() => {
    const channelNoun = pluralize({
      count: followedCount,
      one: "channel",
      other: "channels"
    });
    const videoNoun = pluralize({
      count: feedVideos.length,
      one: "video",
      other: "videos"
    });
    const summary = `${feedVideos.length} ${videoNoun} from ${followedCount} ${channelNoun} in your feed`;
    if (hiddenVideoCount === 0) {
      return summary;
    }

    return `${summary}, ${hiddenVideoCount} hidden`;
  });
  const oldestCheckAt = $derived.by(() => {
    let oldest = Infinity;
    for (const { channelId } of watchedList) {
      oldest = Math.min(oldest, channelVideos[channelId]?.fetchedAt ?? Infinity);
    }
    return oldest;
  });
  const refreshStatus = $derived.by(() => {
    if (isRefreshing) {
      return "Checking for new uploads";
    }

    if (isRefreshFailed) {
      return "Couldn't refresh - try again in a bit";
    }

    if (!Number.isFinite(oldestCheckAt)) {
      return "Not checked yet";
    }

    return `Checked ${formatRelativeTime({
      time: oldestCheckAt,
      now: Date.now()
    })}`;
  });

  async function removeSubscription(subscription: SemiSubscription) {
    const { channelId, title } = subscription;
    editingChannelId = null;
    await removeSemiSubscription(channelId);
    announcement = `Removed ${title}`;
    showSnackbar({
      message: announcement,
      actionLabel: "Undo",
      onAction() {
        announcement = `Restored ${title}`;
        void restoreSemiSubscription(subscription);
      },
      timeoutMs: UNDO_SNACKBAR_TIMEOUT_MS
    });
  }
</script>

<main style:--motion-scale={isAnimationsEnabled ? 1 : 0} class="app">
  <header class="top-bar">
    <div class="top-bar__row">
      <h1 class="top-bar__title">
        <span class="top-bar__mark" aria-hidden="true"></span>
        Semi-Subscribe
      </h1>
      {#if watchedList.length > 0}
        <Button
          disabled={isRefreshing}
          onclick={async () => {
            if (isRefreshing) {
              return;
            }

            isRefreshing = true;
            isRefreshFailed = false;
            await sendMessage(MessageType.REFRESH_ALL_CHANNELS).catch(() => {
              isRefreshFailed = true;
            });
            isRefreshing = false;
          }}
          size="s"
          variant="tonal">
          {#if isRefreshing && IS_MOTION_ALLOWED}
            <LoadingIndicator label="Refreshing" size={LOADING_INDICATOR_SIZE} />
          {:else}
            <Icon path={REFRESH_ICON} />
          {/if}
          Refresh now
        </Button>
      {/if}
    </div>
    {#if subscriptionList.length > 0}
      <p class="top-bar__summary">{feedSummary}</p>
      {#if watchedList.length > 0}
        <output class="top-bar__status">{refreshStatus}</output>
      {/if}
    {/if}
  </header>

  {#if !isExtensionEnabled}
    <p class="paused">Paused - nothing gets added to or hidden from your feed until you turn it back on</p>
  {/if}

  {#if subscriptionList.length === 0}
    <EmptyState />
  {:else}
    <section class="group" aria-labelledby="channels-heading">
      <h2 id="channels-heading" class="group__heading">Channels</h2>
      <ul class="group__list">
        {#each subscriptionList as subscription (subscription.channelId)}
          <ChannelRow
            {aiVerdicts}
            channelVideos={channelVideos[subscription.channelId]}
            {isAiEnabled}
            isEditing={editingChannelId === subscription.channelId}
            onEditingChange={isEditing => {
              editingChannelId = isEditing ? subscription.channelId : null;
            }}
            onRemove={() => removeSubscription(subscription)}
            {subscription} />
        {/each}
      </ul>
    </section>
  {/if}

  <section class="group" aria-labelledby="settings-heading">
    <h2 id="settings-heading" class="group__heading">Settings</h2>
    <ul class="group__list">
      <ListItem headline="Enabled" isLabel supporting="Add or hide matching videos in your subscriptions feed">
        {#snippet trailing()}
          <Switch
            bind:checked={() => isExtensionEnabled, isEnabled => {
              storedState = {
                ...storedState,
                isExtensionEnabled: isEnabled
              };
              void isExtensionEnabledItem.setValue(isEnabled);
            }} />
        {/snippet}
      </ListItem>
      <ListItem
        headline="Animations"
        isLabel
        supporting="Slide videos into and out of the feed - also off when your system asks for reduced motion">
        {#snippet trailing()}
          <Switch
            bind:checked={() => isAnimationsEnabled, isEnabled => {
              storedState = {
                ...storedState,
                isAnimationsEnabled: isEnabled
              };
              void isAnimationsEnabledItem.setValue(isEnabled);
            }} />
        {/snippet}
      </ListItem>
    </ul>
  </section>

  <AiMatchCard {aiFilterCount} {isAiEnabled} />

  <output class="visually-hidden">{announcement}</output>
  <Snackbar />
</main>

<style>
  .app {
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-inline-size: 640px;
    margin-inline: auto;
    padding-block: 16px 24px;
    padding-inline: 12px;
  }

  .top-bar {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-inline: 4px;
  }

  .top-bar__row {
    display: flex;
    gap: 12px;
    justify-content: space-between;
    align-items: center;
    margin-block-end: 6px;
  }

  .top-bar__title {
    display: flex;
    gap: 10px;
    align-items: center;
    margin: 0;
    color: var(--m3c-on-surface);
    font-weight: 600;
    font-size: 22px;
    letter-spacing: -0.01em;
  }

  .top-bar__mark {
    flex: none;
    block-size: 18px;
    inline-size: 18px;
    border-radius: 50%;
    background: linear-gradient(to right, var(--m3c-primary) 50%, transparent 50%);
    box-shadow: inset 0 0 0 2.5px var(--m3c-primary);
  }

  .top-bar__summary,
  .top-bar__status {
    margin: 0;
    color: var(--m3c-on-surface-variant);
    font-size: 12px;
  }

  .top-bar__summary {
    color: var(--m3c-on-surface);
    font-weight: 500;
    font-size: 14px;
  }

  .paused {
    margin: 0;
    padding-block: 12px;
    padding-inline: 16px;
    border-radius: var(--m3-shape-large);
    background: var(--m3c-error-container);
    color: var(--m3c-on-error-container);
    font-weight: 500;
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .group__heading {
    margin: 0;
    padding-inline: 16px;
    color: var(--m3c-primary);
    font-weight: 500;
    font-size: 14px;
  }

  .group__list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .visually-hidden {
    position: absolute;
    overflow: hidden;
    block-size: 1px;
    inline-size: 1px;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
