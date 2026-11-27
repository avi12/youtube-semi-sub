<script lang="ts">
  import {
    buildVideoFilter,
    type FilterCondition,
    FilterKind,
    type FilterMatch,
    FilterMethod,
    getFilterMatch,
    listFilterConditions,
    type VideoFilter
  } from "@/lib/filter/schema/video-filter-schema";
  import type { FeedVideo } from "@/lib/schemas/feed-video";
  import { SubscriptionMode } from "@/lib/schemas/subscription-mode";
  import AiNotice from "#filter-editor/components/AiNotice.svelte";
  import ConditionList from "#filter-editor/components/ConditionList.svelte";
  import SegmentedSwitch from "#filter-editor/components/controls/SegmentedSwitch.svelte";
  import FilterPreview from "#filter-editor/components/FilterPreview.svelte";
  import FilterRule from "#filter-editor/components/FilterRule.svelte";
  import MethodPicker from "#filter-editor/components/MethodPicker.svelte";
  import { type EditorControls, setEditorControls } from "#filter-editor/controls";
  import { DEFAULT_EDITOR_CONTROLS } from "#filter-editor/default-controls";
  import {
    createDefaultCondition,
    FILTER_MATCH_LABEL,
    FILTER_MATCHES,
    getConditionMethod,
    withMethodCondition
  } from "#filter-editor/filter-methods";
  import { MODE_COPY } from "#filter-editor/mode-copy";
  import { watchAiMatchPreview } from "#filter-editor/preview/ai-match-preview.svelte";
  import { getPreviewHints, watchEditorPreview } from "#filter-editor/preview/editor-preview.svelte";
  import { type ComponentProps, untrack } from "svelte";

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
    aiSetup?: ComponentProps<typeof AiNotice>["aiSetup"];
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
  const match = $derived.by(() => {
    if (isCombined) {
      return getFilterMatch(filter);
    }

    return preferredMatch;
  });

  /** Dropping a method keeps what was typed, so picking it again loses nothing */
  const parkedConditions: Partial<Record<FilterMethod, FilterCondition>> = {};

  function setCondition({ method, condition }: {
    method: FilterMethod;
    condition: FilterCondition | null;
  }) {
    filter = buildVideoFilter({
      conditions: withMethodCondition({
        conditions,
        method,
        condition
      }),
      match
    });
  }

  const isAiFilterShown = $derived(conditions.some(condition => condition.kind === FilterKind.AI_MATCH));
  const isTitleFilterShown = $derived(
    conditions.some(condition => condition.kind === FilterKind.AI_MATCH || condition.kind === FilterKind.REGEX)
  );

  const aiMatch = watchAiMatchPreview(() => ({
    filter: conditions.find(condition => condition.kind === FilterKind.AI_MATCH) ?? null,
    videos
  }));

  const editorPreview = watchEditorPreview(() => ({
    filter,
    videos,
    mode,
    isMember,
    aiVerdicts: aiMatch.aiVerdicts,
    isAiEnabled: aiMatch.isAiEnabled
  }));
  const hints = $derived(
    getPreviewHints({
      filter,
      mode,
      isAiEnabled: aiMatch.isAiEnabled
    })
  );
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
  const previewInputId = $derived.by(() => {
    if (isTitleFilterShown) {
      return TITLE_INPUT_ID;
    }

    return LENGTH_INPUT_ID;
  });
</script>

<div class="filter-editor">
  <div class="filter-editor__controls">
    <MethodPicker
      onPickedChange={({ method, isPicked }) => {
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
      }}
      {pickedMethods} />
    {#if isCombined}
      <div class="filter-editor__match">
        <span class="filter-editor__match-label" aria-hidden="true">{copy.matchLegend}</span>
        <SegmentedSwitch
          labels={FILTER_MATCH_LABEL}
          legend={copy.matchLegend}
          onValueChange={(nextMatch: FilterMatch) => {
            preferredMatch = nextMatch;
            filter = buildVideoFilter({
              conditions,
              match: nextMatch
            });
          }}
          options={FILTER_MATCHES}
          value={match} />
      </div>
    {/if}
  </div>

  <ConditionList
    {conditions}
    lengthInputId={LENGTH_INPUT_ID}
    {match}
    {mode}
    onConditionChange={setCondition}
    titleInputId={TITLE_INPUT_ID} />

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

  <AiNotice {aiSetup} aiStatus={aiMatch.aiStatus} isAiEnabled={aiMatch.isAiEnabled} {isAiFilterShown} />

  <FilterPreview
    {hints}
    inputId={previewInputId}
    {isLoading}
    label={PREVIEW_LABEL}
    preview={editorPreview.preview}
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
</style>
