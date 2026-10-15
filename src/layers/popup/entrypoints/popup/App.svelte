<script lang="ts">
  import { FilterKind, selectFeedVideos, selectHiddenVideoIds } from "@/lib/filter/title-filter";
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
  import {
    aiVerdictsItem,
    channelVideosItem,
    isAiEnabledItem,
    isAnimationsEnabledItem,
    isExtensionEnabledItem,
    semiSubscriptionsItem
  } from "@/lib/storage";
  import { prefersReducedMotion } from "@/lib/utils/motion";
  import { pluralize } from "@/lib/utils/pluralize";
  import { formatRelativeTime } from "@/lib/youtube/relative-time";
  import { followModelDownload, refreshAiStatus } from "#popup/ai/ai-match-setup.svelte";
  import AiMatchCard from "#popup/ai/AiMatchCard.svelte";
  import ChannelRow from "#popup/ChannelRow.svelte";
  import EmptyState from "#popup/EmptyState.svelte";
  import { REFRESH_ICON } from "#popup/icons";
  import {
    Button,
    Icon,
    ListItem,
    LoadingIndicator,
    Snackbar,
    snackbar,
    Switch
  } from "m3-svelte";
  import { untrack } from "svelte";

  interface Props {
    initialState: StoredState;
  }

  const { initialState }: Props = $props();

  const UNDO_SNACKBAR_TIMEOUT_MS = 10_000;
  const LOADING_INDICATOR_SIZE = 20;
  const isMotionAllowed = !prefersReducedMotion();

  let subscriptions = $state.raw(untrack(() => initialState.subscriptions));
  let channelVideos = $state.raw(untrack(() => initialState.channelVideos));
  let aiVerdicts = $state.raw(untrack(() => initialState.aiVerdicts));
  let isAiEnabled = $state(untrack(() => initialState.isAiEnabled));
  let isExtensionEnabled = $state(untrack(() => initialState.isExtensionEnabled));
  let isAnimationsEnabled = $state(untrack(() => initialState.isAnimationsEnabled));
  let editingChannelId = $state<string | null>(null);
  let announcement = $state("");
  let isRefreshing = $state(false);
  let isRefreshFailed = $state(false);

  $effect(() => {
    const unwatchers = [
      semiSubscriptionsItem.watch(value => {
        subscriptions = value;
      }),
      channelVideosItem.watch(value => {
        channelVideos = value;
      }),
      aiVerdictsItem.watch(value => {
        aiVerdicts = value;
      }),
      isAiEnabledItem.watch(value => {
        isAiEnabled = value;
      }),
      isExtensionEnabledItem.watch(value => {
        isExtensionEnabled = value;
      }),
      isAnimationsEnabledItem.watch(value => {
        isAnimationsEnabled = value;
      })
    ];
    return () => {
      for (const unwatch of unwatchers) {
        unwatch();
      }
    };
  });

  $effect(() => {
    void refreshAiStatus();
    return followModelDownload();
  });

  const subscriptionList = $derived(listByTitle(subscriptions));
  const aiFilterCount = $derived(
    subscriptionList.filter(subscription => getActiveFilter(subscription).kind === FilterKind.aiMatch).length
  );
  const filterInput = $derived({
    subscriptions,
    videosByChannel: videosByChannelFromCache(channelVideos),
    aiVerdicts,
    isAiEnabled
  });
  const feedVideos = $derived(selectFeedVideos(filterInput));
  const hiddenVideoCount = $derived(selectHiddenVideoIds(filterInput).length);
  const feedSummary = $derived.by(() => {
    const channelNoun = pluralize({
      count: subscriptionList.length,
      one: "channel",
      other: "channels"
    });
    const videoNoun = pluralize({
      count: feedVideos.length,
      one: "video",
      other: "videos"
    });
    const summary = `${feedVideos.length} ${videoNoun} from ${subscriptionList.length} ${channelNoun} in your feed`;
    if (hiddenVideoCount === 0) {
      return summary;
    }

    return `${summary}, ${hiddenVideoCount} hidden`;
  });
  const oldestCheckAt = $derived.by(() => {
    let oldest = Infinity;
    for (const { channelId } of subscriptionList.filter(isUploadsWatched)) {
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
    snackbar(announcement, {
      Undo() {
        announcement = `Restored ${title}`;
        void restoreSemiSubscription(subscription);
      }
    }, true, UNDO_SNACKBAR_TIMEOUT_MS);
  }
</script>

<main style:--motion-scale={isAnimationsEnabled ? 1 : 0} class="app">
  <header class="top-bar">
    <div class="top-bar__row">
      <h1 class="top-bar__title">
        <span class="top-bar__mark" aria-hidden="true"></span>
        Semi-Subscribe
      </h1>
      {#if subscriptionList.length > 0}
        <Button
          disabled={isRefreshing}
          iconType="left"
          onclick={async () => {
            if (isRefreshing) {
              return;
            }

            isRefreshing = true;
            isRefreshFailed = false;
            await sendMessage(MessageType.refreshAllChannels).catch(() => {
              isRefreshFailed = true;
            });
            isRefreshing = false;
          }}
          size="s"
          variant="tonal">
          {#if isRefreshing && isMotionAllowed}
            <LoadingIndicator aria-label="Refreshing" center={false} size={LOADING_INDICATOR_SIZE} />
          {:else}
            <Icon icon={REFRESH_ICON} />
          {/if}
          Refresh now
        </Button>
      {/if}
    </div>
    {#if subscriptionList.length > 0}
      <p class="top-bar__summary">{feedSummary}</p>
      <output class="top-bar__status">{refreshStatus}</output>
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
    <ul class="group__list group__list--settings">
      <ListItem headline="Enabled" label supporting="Add matching videos to your subscriptions feed">
        {#snippet trailing()}
          <Switch
            bind:checked={() => isExtensionEnabled, isEnabled => {
              isExtensionEnabled = isEnabled;
              void isExtensionEnabledItem.setValue(isEnabled);
            }} />
        {/snippet}
      </ListItem>
      <ListItem
        headline="Animations"
        label
        supporting="Slide new videos into the feed - also off when your system asks for reduced motion">
        {#snippet trailing()}
          <Switch
            bind:checked={() => isAnimationsEnabled, isEnabled => {
              isAnimationsEnabled = isEnabled;
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

  .group__list--settings {
    & :global(li > .m3-container) {
      block-size: auto;
      min-block-size: 72px;
      padding-inline-end: 16px;
      border-radius: var(--m3-shape-extra-small);
      background: var(--m3c-surface-container);
    }

    & :global(li:first-child > .m3-container) {
      border-start-end-radius: var(--m3-shape-large-increased);
      border-start-start-radius: var(--m3-shape-large-increased);
    }

    & :global(li:last-child > .m3-container) {
      border-end-start-radius: var(--m3-shape-large-increased);
      border-end-end-radius: var(--m3-shape-large-increased);
    }
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
