<script lang="ts">
  import { MODE_COPY } from "./mode-copy";
  import { AiEngine, type AiStatus, isAiEngineAvailable } from "@/lib/ai/ai-status";
  import { FILTER_MATCH_CONNECTOR } from "@/lib/filter/filter-literal";
  import {
    buildVideoFilter,
    DEFAULT_TITLE_FILTER,
    EMPTY_AI_FILTER,
    type FilterCondition,
    FilterKind,
    type FilterMatch,
    FilterMethod,
    getFilterMatch,
    isFilterConditionValid,
    listFilterConditions,
    TITLE_FILTER_KINDS,
    type TitleFilter,
    type VideoFilter
  } from "@/lib/filter/title-filter";
  import type { FeedVideo } from "@/lib/schemas/feed-video";
  import { SubscriptionMode } from "@/lib/schemas/subscription-mode";
  import AiFilterFields from "#filter-editor/components/fields/AiFilterFields.svelte";
  import FilterPreview from "#filter-editor/components/FilterPreview.svelte";
  import FilterRule from "#filter-editor/components/FilterRule.svelte";
  import LengthFilterFields from "#filter-editor/components/fields/LengthFilterFields.svelte";
  import MethodPicker from "#filter-editor/components/MethodPicker.svelte";
  import RegexFilterFields from "#filter-editor/components/fields/RegexFilterFields.svelte";
  import SegmentedSwitch from "#filter-editor/components/controls/SegmentedSwitch.svelte";
  import TypeFilterFields from "#filter-editor/components/fields/TypeFilterFields.svelte";
  import { type EditorControls, setEditorControls } from "#filter-editor/controls";
  import { DEFAULT_EDITOR_CONTROLS } from "#filter-editor/default-controls";
  import {
    createDefaultCondition,
    FILTER_MATCH_LABEL,
    FILTER_MATCHES,
    FILTER_METHOD_LABEL,
    getConditionMethod,
    TITLE_KIND_LABEL,
    withMethodCondition
  } from "#filter-editor/filter-methods";
  import { watchAiMatchPreview } from "#filter-editor/preview/ai-match-preview.svelte";
  import { previewVideoFilter, type VideoFilterPreview } from "#filter-editor/preview/title-matches";
  import { type Snippet, untrack } from "svelte";

  interface Props {
    filter: VideoFilter;
    /** Following picks the videos added to the feed, hiding the ones hidden from it */
    mode: SubscriptionMode;
    /** A sample of the channel's recent uploads to preview the filter on - may be empty */
    videos: FeedVideo[];
    isLoading?: boolean;
    /** A member of the channel: following then adds its members-only videos too */
    isMember?: boolean;
    /** The toggles to build the editor from - YouTube's own in-page, the editor's plain ones elsewhere */
    controls?: EditorControls;
    /** The host's way to turn AI match on or finish setting it up, shown while an AI filter can't run yet */
    aiSetup?: Snippet<[{
      isAiEnabled: boolean;
      aiStatus: AiStatus | null;
    }]>;
  }

  let {
    filter = $bindable(),
    mode,
    videos,
    isLoading = false,
    isMember = $bindable(false),
    controls = DEFAULT_EDITOR_CONTROLS,
    aiSetup
  }: Props = $props();

  setEditorControls(untrack(() => controls));

  const id = $props.id();
  const TITLE_INPUT_ID = `${id}-title`;
  const LENGTH_INPUT_ID = `${id}-length`;
  const RULE_ID = `${id}-rule`;
  const MEMBERSHIP_LABEL = "I'm a member of this channel";
  const PREVIEW_LABEL = "Shows in your feed";

  const copy = $derived(MODE_COPY[mode]);
  const conditions = $derived(listFilterConditions(filter));
  const pickedMethods = $derived(conditions.map(getConditionMethod));
  const isCombined = $derived(conditions.length > 1);
  /** Kept while a single condition is left, so picking a second method again brings the same match back */
  let preferredMatch = $state(untrack(() => getFilterMatch(filter)));
  const match = $derived(isCombined ? getFilterMatch(filter) : preferredMatch);

  /** Dropping a method or switching kinds keeps what was typed, so flipping back and forth loses nothing */
  const parkedConditions: Partial<Record<FilterMethod, FilterCondition>> = {};
  const parkedTitleFilters: Partial<Record<TitleFilter["kind"], TitleFilter>> = {};

  function setConditions(nextConditions: FilterCondition[]) {
    filter = buildVideoFilter({
      conditions: nextConditions,
      match
    });
  }

  function setCondition({ method, condition }: {
    method: FilterMethod;
    condition: FilterCondition | null;
  }) {
    setConditions(
      withMethodCondition({
        conditions,
        method,
        condition
      })
    );
  }

  function setMatch(nextMatch: FilterMatch) {
    preferredMatch = nextMatch;
    filter = buildVideoFilter({
      conditions,
      match: nextMatch
    });
  }

  function pickMethod({ method, isPicked }: {
    method: FilterMethod;
    isPicked: boolean;
  }) {
    const condition = conditions.find(other => getConditionMethod(other) === method);
    if (!isPicked && condition) {
      parkedConditions[method] = condition;
    }

    setCondition({
      method,
      condition: isPicked ? parkedConditions[method] ?? createDefaultCondition({
        method,
        mode
      }) : null
    });
  }

  function createEmptyTitleFilter(kind: TitleFilter["kind"]) {
    const emptyFilter: TitleFilter = kind === FilterKind.AI_MATCH ? { ...EMPTY_AI_FILTER } : { ...DEFAULT_TITLE_FILTER };
    return emptyFilter;
  }

  function switchTitleKind(kind: TitleFilter["kind"]) {
    const titleFilter = regexFilter ?? aiFilter;
    if (!titleFilter || kind === titleFilter.kind) {
      return;
    }

    parkedTitleFilters[titleFilter.kind] = titleFilter;
    setCondition({
      method: FilterMethod.TITLE,
      condition: parkedTitleFilters[kind] ?? createEmptyTitleFilter(kind)
    });
  }

  const aiFilter = $derived(conditions.find(condition => condition.kind === FilterKind.AI_MATCH) ?? null);
  const regexFilter = $derived(conditions.find(condition => condition.kind === FilterKind.REGEX) ?? null);
  const lengthFilter = $derived(conditions.find(condition => condition.kind === FilterKind.LENGTH) ?? null);
  const titleKind = $derived(aiFilter ? FilterKind.AI_MATCH : FilterKind.REGEX);

  const aiMatch = watchAiMatchPreview(() => ({
    filter: aiFilter,
    videos
  }));

  const aiNotice = $derived.by(() => {
    if (!aiFilter) {
      return null;
    }

    if (!aiMatch.isAiEnabled) {
      return "AI match is off - turn it on to let a model judge each video";
    }

    const { aiStatus } = aiMatch;
    if (aiStatus?.engine === AiEngine.NONE) {
      return "AI match isn't available in this browser";
    }

    if (aiStatus && !aiStatus.isModelReady) {
      return "The AI model isn't on this device yet - videos get checked once it is";
    }

    return null;
  });
  const isSetupOffered = $derived(aiNotice !== null && isAiEngineAvailable(aiMatch.aiStatus));

  let lastValidPreview: {
    videos: FeedVideo[];
    preview: VideoFilterPreview;
  } | null = null;

  /** While a condition is mid-edit and invalid, keep showing the last valid result instead of emptying the feed */
  const preview = $derived.by(() => {
    const currentPreview = previewVideoFilter({
      filter,
      videos,
      mode,
      isMember,
      aiVerdicts: aiMatch.aiVerdicts,
      isAiEnabled: aiMatch.isAiEnabled
    });
    if (currentPreview.isValid) {
      lastValidPreview = {
        videos,
        preview: currentPreview
      };
      return {
        ...currentPreview,
        isStale: false
      };
    }

    const isPausedByAi = aiFilter !== null && !aiMatch.isAiEnabled;
    const isLastValidPreviewCurrent = lastValidPreview?.videos === videos;
    if (lastValidPreview && isLastValidPreviewCurrent && !isPausedByAi) {
      return {
        ...lastValidPreview.preview,
        isStale: true
      };
    }

    return {
      ...currentPreview,
      isStale: false
    };
  });
  /** Worded after the condition that stops the preview, else after the one most likely to explain no match */
  const hints = $derived.by(() => {
    const invalidCondition = conditions.find(condition => !isFilterConditionValid(condition));
    const kind = invalidCondition?.kind ?? aiFilter?.kind ?? regexFilter?.kind ?? FilterKind.LENGTH;
    if (kind === FilterKind.REGEX) {
      return copy.regexHints;
    }

    if (kind === FilterKind.LENGTH) {
      return copy.lengthHints;
    }

    if (!aiMatch.isAiEnabled) {
      return {
        ...copy.aiHints,
        invalidSummary: "AI match is off",
        invalid: copy.pausedAiInvalid
      };
    }

    return copy.aiHints;
  });
  /** Only a followed channel with members-only videos asks - a subscribed one never shows them in the feed */
  const isMembershipAsked = $derived(
    mode === SubscriptionMode.FOLLOW && (isMember || videos.some(video => video.isMembersOnly))
  );
  const membershipHint = $derived.by(() => {
    if (isMember) {
      return "Members-only videos are added like any other";
    }

    return "Members-only videos are left out, since only members can watch them";
  });
  const previewInputId = $derived(regexFilter || aiFilter ? TITLE_INPUT_ID : LENGTH_INPUT_ID);
</script>

<div class="filter-editor">
  <div class="filter-editor__controls">
    <MethodPicker onPickedChange={pickMethod} {pickedMethods} />
    {#if isCombined}
      <div class="filter-editor__match">
        <span class="filter-editor__match-label" aria-hidden="true">{copy.matchLegend}</span>
        <SegmentedSwitch
          labels={FILTER_MATCH_LABEL}
          legend={copy.matchLegend}
          onValueChange={setMatch}
          options={FILTER_MATCHES}
          value={match} />
      </div>
    {/if}
  </div>

  <ol class="conditions">
    {#each conditions as condition, i (getConditionMethod(condition))}
      <li class="condition">
        {#if i > 0}
          <span class="condition__connector">{FILTER_MATCH_CONNECTOR[match]}</span>
        {/if}
        <section class={["condition__card", isCombined && "condition__card--framed"]}>
          {#if condition.kind === FilterKind.TYPE}
            <header class="condition__header">
              <span class="condition__label">{FILTER_METHOD_LABEL[FilterMethod.TYPE]}</span>
            </header>
            <TypeFilterFields
              bind:filter={() => condition, edited => setCondition({
                method: FilterMethod.TYPE,
                condition: edited
              })} />
          {:else if condition.kind === FilterKind.LENGTH}
            <header class="condition__header">
              <label class="condition__label" for={LENGTH_INPUT_ID}>{FILTER_METHOD_LABEL[FilterMethod.LENGTH]}</label>
            </header>
            <LengthFilterFields
              inputId={LENGTH_INPUT_ID}
              bind:filter={() => condition, edited => setCondition({
                method: FilterMethod.LENGTH,
                condition: edited
              })} />
          {:else}
            <header class="condition__header">
              <label class="condition__label" for={TITLE_INPUT_ID}>
                {#if condition.kind === FilterKind.AI_MATCH}
                  {copy.aiLabel}
                {:else}
                  {FILTER_METHOD_LABEL[FilterMethod.TITLE]}
                {/if}
              </label>
              <SegmentedSwitch
                labels={TITLE_KIND_LABEL}
                legend="Match titles with"
                onValueChange={switchTitleKind}
                options={TITLE_FILTER_KINDS}
                value={titleKind} />
            </header>
            {#if condition.kind === FilterKind.REGEX}
              <RegexFilterFields
                emptyPatternHint={isCombined ? "Leave it empty to judge by the other filters only" : copy.emptyPatternHint}
                inputId={TITLE_INPUT_ID}
                placeholder={copy.regexPlaceholder}
                bind:filter={() => condition, edited => setCondition({
                  method: FilterMethod.TITLE,
                  condition: edited
                })} />
            {:else}
              <AiFilterFields
                hint={copy.aiHint}
                inputId={TITLE_INPUT_ID}
                placeholder={copy.aiPlaceholder}
                bind:filter={() => condition, edited => setCondition({
                  method: FilterMethod.TITLE,
                  condition: edited
                })} />
            {/if}
          {/if}
        </section>
      </li>
    {/each}
  </ol>

  <FilterRule id={RULE_ID} {filter} inputIds="{TITLE_INPUT_ID} {LENGTH_INPUT_ID}" {mode} />

  {#if isMembershipAsked}
    <controls.Checkbox
      hint={membershipHint}
      isChecked={isMember}
      label={MEMBERSHIP_LABEL}
      onCheckedChange={isChecked => {
        isMember = isChecked;
      }} />
  {/if}

  {#if aiNotice}
    <section class="ai-notice" aria-live="polite">
      <p class="ai-notice__text">{aiNotice}</p>
      {#if aiSetup && isSetupOffered}
        <div class="ai-notice__action">
          {@render aiSetup({
            isAiEnabled: aiMatch.isAiEnabled,
            aiStatus: aiMatch.aiStatus
          })}
        </div>
      {/if}
    </section>
  {/if}

  <FilterPreview
    {hints}
    inputId={previewInputId}
    {isLoading}
    label={PREVIEW_LABEL}
    {preview}
    skippedLabel={copy.skippedLabel}
    videoCount={videos.length} />
</div>

<style>
  .filter-editor {
    --editor-fg: var(--filter-editor-fg, CanvasText);
    --editor-muted: var(--filter-editor-muted, color-mix(in srgb, CanvasText 60%, Canvas));
    --editor-accent: var(--filter-editor-accent, LinkText);
    --editor-error: var(--filter-editor-error, #d93025);
    --editor-surface: var(--filter-editor-surface, Canvas);
    --editor-border: var(--filter-editor-border, color-mix(in srgb, CanvasText 20%, Canvas));
    --editor-font: var(--filter-editor-font, system-ui, sans-serif);
    --editor-mono: ui-monospace, "Cascadia Mono", "Roboto Mono", "SF Mono", consolas, monospace;
    --editor-ease: cubic-bezier(0.2, 0, 0, 1);

    display: flex;
    flex-direction: column;
    gap: 16px;
    color: var(--editor-fg);
    font-family: var(--editor-font);
    font-size: 14px;
    line-height: 1.4;

    & :global(:where(:focus-visible)) {
      outline: 2px solid var(--editor-accent);
      outline-offset: 2px;
      animation: none;
    }

    /* The frame every text field of the editor sits in */
    & :global(.filter-editor-field) {
      display: flex;
      align-items: center;
      padding-inline: 12px;
      border: 1px solid var(--editor-border);
      border-radius: 10px;
      background: var(--editor-surface);

      @media (prefers-reduced-motion: no-preference) {
        transition:
          border-color 120ms var(--editor-ease),
          box-shadow 120ms var(--editor-ease);
      }

      &:focus-within {
        border-color: var(--editor-accent);
        box-shadow: 0 0 0 1px var(--editor-accent);
      }
    }

    & :global(.filter-editor-field:has([aria-invalid="true"])) {
      border-color: var(--editor-error);
      box-shadow: 0 0 0 1px var(--editor-error);
    }
  }

  .filter-editor__controls {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .filter-editor__match {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .filter-editor__match-label {
    color: var(--editor-muted);
    font-size: 13px;
  }

  .conditions {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .condition {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
  }

  .condition__connector {
    padding-block: 2px;
    padding-inline: 10px;
    border-radius: 999px;
    background: color-mix(in sRGB, var(--editor-accent) 14%, transparent);
    color: var(--editor-fg);
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .condition__card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-self: stretch;
  }

  .condition__card--framed {
    padding: 12px;
    border: 1px solid var(--editor-border);
    border-radius: 12px;
  }

  .condition__header {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: space-between;
    align-items: center;
  }

  .condition__label {
    color: var(--editor-fg);
    font-weight: 600;
    font-size: 13px;
  }

  .ai-notice {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    justify-content: space-between;
    align-items: center;
    margin-block-start: -4px;
    padding-block: 10px;
    padding-inline: 14px;
    border-radius: 10px;
    background: color-mix(in sRGB, var(--editor-accent) 10%, transparent);
  }

  .ai-notice__text {
    flex: 1 1 200px;
    margin: 0;
    color: var(--editor-fg);
    font-size: 13px;
    text-wrap: pretty;
  }

  .ai-notice__action {
    display: flex;
    flex: none;
    gap: 8px;
    align-items: center;
  }
</style>
