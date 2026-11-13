<script lang="ts">
  import ChannelEditor from "./ChannelEditor.svelte";
  import { EDIT_ICON, OPEN_IN_NEW_ICON } from "./icons";
  import { AI_LITERAL_PREFIX, describeFilterLiteral, FilterLiteralKind } from "@/lib/filter/filter-literal";
  import {
    type AiJudgeContext,
    createModeJudge,
    isFilterInert,
    listAiFilters,
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

  const MATCH_WORDING = {
    [SubscriptionMode.FOLLOW]: {
      matched: "matching",
      inertSummary: "Adds nothing yet"
    },
    [SubscriptionMode.HIDE]: {
      matched: "hidden",
      inertSummary: "Hides nothing yet"
    }
  } as const;

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
  const wording = $derived(MATCH_WORDING[mode]);
  const isInert = $derived(
    isFilterInert({
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
  const isPaused = $derived(judge === null && listAiFilters(filter).length > 0 && !isAiEnabled);
  const literal = $derived(
    describeFilterLiteral({
      subscription,
      isAiEnabled
    })
  );
  const matchStateById = $derived(
    new Map(videos.map(video => [video.videoId, judge?.(video) ?? MatchState.DOES_NOT_MATCH]))
  );
  const matchStates = $derived([...matchStateById.values()]);
  const matchCount = $derived(matchStates.filter(matchState => matchState === MatchState.MATCHES).length);
  const pendingCount = $derived(matchStates.filter(matchState => matchState === MatchState.PENDING).length);
  const initial = $derived(getChannelInitial(subscription.title));
  const matchSummary = $derived.by(() => {
    if (isInert) {
      return wording.inertSummary;
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
        aria-controls={EDITOR_ID}
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
      id={EDITOR_ID}
      isCached={channelVideos !== undefined}
      {mode}
      onClose={closeEditor}
      {onRemove}
      {subscription}
      {videos} />
  {:else}
    <div class="channel__summary">
      <ul class="literal">
        {#each literal.parts as part, i (i)}
          <li class="literal__part">
            {#if i > 0}
              <span class="literal__connector">{literal.connector}</span>
            {/if}
            {#if part.kind === FilterLiteralKind.AI_MATCH}
              <p class={["ai-literal", part.isPaused && "ai-literal--paused"]}>
                <span class="ai-literal__badge">{AI_LITERAL_PREFIX}</span>
                <bdi class="ai-literal__description">{part.text}</bdi>
              </p>
            {:else if part.kind === FilterLiteralKind.REGEX}
              <code class="filter-literal" dir="ltr">
                <span class="filter-literal__pattern">{part.text}</span><span class="filter-literal__flags"
                >{part.flags}</span>
              </code>
            {:else}
              <code class="filter-literal"><span class="filter-literal__any">{part.text}</span></code>
            {/if}
          </li>
        {/each}
      </ul>
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

  .literal {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .literal__part {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .literal__connector {
    color: var(--m3c-on-surface-variant);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
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
