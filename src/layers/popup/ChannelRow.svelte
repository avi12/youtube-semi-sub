<script lang="ts">
  import ChannelEditor from "./ChannelEditor.svelte";
  import { EDIT_ICON, OPEN_IN_NEW_ICON } from "./icons";
  import {
    type AiJudgeContext,
    createModeJudge,
    FilterKind,
    isHidingNothing,
    MatchState
  } from "@/lib/filter/title-filter";
  import { getChannelInitial } from "@/lib/schemas/channel";
  import type { ChannelVideos } from "@/lib/schemas/feed-video";
  import { getModeFilter, getSubscriptionMode, type SemiSubscription } from "@/lib/schemas/semi-subscription";
  import { SUBSCRIPTION_MODE_NAME, SubscriptionMode } from "@/lib/schemas/subscription-mode";
  import { pluralize } from "@/lib/utils/pluralize";
  import { formatHandle, getChannelUrl } from "@/lib/youtube/channel-link";
  import { Button, Icon } from "m3-svelte";
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

  const HIDES_NOTHING_SUMMARY = "Hides nothing yet";
  const MATCH_WORDING = {
    [SubscriptionMode.follow]: {
      matched: "matching",
      emptyPattern: "Any title"
    },
    [SubscriptionMode.hide]: {
      matched: "hidden",
      emptyPattern: "Nothing hidden"
    }
  } as const;

  const id = $props.id();
  const editorId = `${id}-editor`;
  let elEditToggle = $state<HTMLInputElement>();

  const mode = $derived(getSubscriptionMode(subscription));
  const filter = $derived(
    getModeFilter({
      subscription,
      mode
    })
  );
  const wording = $derived(MATCH_WORDING[mode]);
  const isHidingNone = $derived(
    isHidingNothing({
      filter,
      mode
    })
  );
  const videos = $derived(channelVideos?.videos ?? []);
  const videosOldestFirst = $derived(videos.toSorted((left, right) => left.publishedAt - right.publishedAt));
  /** The same judge the feed is filtered by in this mode - null while the filter can't run (AI match is off) */
  const judge = $derived(
    createModeJudge({
      filter,
      mode,
      aiVerdicts,
      isAiEnabled
    })
  );
  const isPaused = $derived(filter.kind === FilterKind.aiMatch && !isAiEnabled);
  const matchStateById = $derived(
    new Map(videos.map(video => [video.videoId, judge?.(video) ?? MatchState.doesNotMatch]))
  );
  const matchStates = $derived([...matchStateById.values()]);
  const matchCount = $derived(matchStates.filter(matchState => matchState === MatchState.matches).length);
  const pendingCount = $derived(matchStates.filter(matchState => matchState === MatchState.pending).length);
  const initial = $derived(getChannelInitial(subscription.title));
  const matchSummary = $derived.by(() => {
    if (isHidingNone) {
      return HIDES_NOTHING_SUMMARY;
    }

    if (isPaused) {
      return "Paused - AI match is off";
    }

    if (!channelVideos) {
      return "Waiting for the first check";
    }

    const noun = pluralize({
      count: matchCount,
      one: "video",
      other: "videos"
    });
    const summary = `${matchCount} ${wording.matched} ${noun}`;
    if (pendingCount === 0) {
      return summary;
    }

    return `${summary} - checking ${pendingCount} more`;
  });

  async function closeEditor() {
    onEditingChange(false);
    await tick();
    elEditToggle?.focus();
  }
</script>

<li class="channel">
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
        <Icon icon={OPEN_IN_NEW_ICON} />
      </a>
    </div>

    <Button iconType="left" label size="xs" variant="tonal">
      <input
        bind:this={elEditToggle}
        aria-controls={editorId}
        type="checkbox"
        bind:checked={() => isEditing, isChecked => {
          if (isChecked) {
            onEditingChange(true);
            return;
          }

          void closeEditor();
        }} />
      <Icon icon={EDIT_ICON} />
      Edit
    </Button>
  </div>

  {#if isEditing}
    <ChannelEditor
      id={editorId}
      isCached={channelVideos !== undefined}
      {mode}
      onClose={closeEditor}
      {onRemove}
      {subscription}
      {videos} />
  {:else}
    <div class="channel__summary">
      {#if filter.kind === FilterKind.aiMatch}
        <p class={["ai-literal", isPaused && "ai-literal--paused"]}>
          <span class="ai-literal__badge">AI</span>
          <bdi class="ai-literal__description">{filter.description}</bdi>
        </p>
      {:else}
        <code class="filter-literal" dir="ltr">
          {#if filter.pattern}
            {@const { pattern, flags } = filter}
            <span class="filter-literal__pattern">{pattern}</span><span class="filter-literal__flags">{flags}</span>
          {:else}
            <span class="filter-literal__any">{wording.emptyPattern}</span>
          {/if}
        </code>
      {/if}
      <p class="matches">
        {#if videosOldestFirst.length > 0}
          <span class="matches__strip" aria-hidden="true">
            {#each videosOldestFirst as video (video.videoId)}
              <span
                class="matches__tick"
                data-match-state={matchStateById.get(video.videoId)}
                title={video.title}></span>
            {/each}
          </span>
        {/if}
        <span class="matches__summary">{matchSummary}</span>
      </p>
    </div>
  {/if}
</li>

<style>
  .channel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-block: 14px;
    padding-inline: 16px;
    border-radius: var(--m3-shape-extra-small);
    background: var(--m3c-surface-container);

    &:first-child {
      border-start-end-radius: var(--m3-shape-large-increased);
      border-start-start-radius: var(--m3-shape-large-increased);
    }

    &:last-child {
      border-end-start-radius: var(--m3-shape-large-increased);
      border-end-end-radius: var(--m3-shape-large-increased);
    }
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

  .filter-literal {
    display: -webkit-box;
    overflow: hidden;
    color: var(--m3c-on-surface);
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.4;
    overflow-wrap: anywhere;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .filter-literal__pattern {
    &::before,
    &::after {
      content: "/";
      color: var(--m3c-on-surface-variant);
    }
  }

  .filter-literal__flags {
    color: var(--m3c-primary);
    font-weight: 700;
  }

  .filter-literal__any {
    color: var(--m3c-on-surface-variant);
    font-family: var(--m3-font);
    font-style: italic;
  }

  .matches {
    display: flex;
    gap: 10px;
    align-items: center;
    margin: 0;
  }

  .matches__strip {
    display: flex;
    gap: 2px;
  }

  .matches__tick {
    block-size: 14px;
    inline-size: 5px;
    border-radius: 3px;
    background: var(--m3c-outline-variant);
  }

  .matches__tick[data-match-state="matches"] {
    background: var(--m3c-primary);
  }

  .matches__tick[data-match-state="pending"] {
    background: transparent;
    box-shadow: inset 0 0 0 1.5px var(--m3c-outline-variant);
  }

  .ai-literal {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    margin: 0;
    color: var(--m3c-on-surface);
    font-size: 13px;
    line-height: 1.4;
  }

  .ai-literal__badge {
    flex: none;
    padding-inline: 6px;
    border-radius: var(--m3-shape-full);
    background: var(--m3c-primary-container);
    color: var(--m3c-on-primary-container);
    font-weight: 700;
    font-size: 11px;
    line-height: 18px;
  }

  .ai-literal__description {
    display: -webkit-box;
    overflow: hidden;
    overflow-wrap: anywhere;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .ai-literal--paused {
    color: var(--m3c-on-surface-variant);

    & .ai-literal__badge {
      background: var(--m3c-surface-container-highest);
      color: var(--m3c-on-surface-variant);
    }
  }

  .matches__summary {
    color: var(--m3c-on-surface-variant);
    font-weight: 500;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
</style>
