<script lang="ts">
  import { FILTER_MATCH_CONNECTOR } from "@/lib/filter/filter-literal";
  import {
    DEFAULT_TITLE_FILTER,
    EMPTY_AI_FILTER,
    type FilterCondition,
    FilterKind,
    type FilterMatch,
    FilterMethod,
    TITLE_FILTER_KINDS,
    type TitleFilter
  } from "@/lib/filter/schema/video-filter-schema";
  import type { SubscriptionMode } from "@/lib/schemas/subscription-mode";
  import SegmentedSwitch from "#filter-editor/components/controls/SegmentedSwitch.svelte";
  import AiFilterFields from "#filter-editor/components/fields/AiFilterFields.svelte";
  import LengthFilterFields from "#filter-editor/components/fields/LengthFilterFields.svelte";
  import RegexFilterFields from "#filter-editor/components/fields/RegexFilterFields.svelte";
  import TypeFilterFields from "#filter-editor/components/fields/TypeFilterFields.svelte";
  import { FILTER_METHOD_LABEL, getConditionMethod, TITLE_KIND_LABEL } from "#filter-editor/filter-methods";
  import { MODE_COPY } from "#filter-editor/mode-copy";

  interface Props {
    conditions: FilterCondition[];
    match: FilterMatch;
    mode: SubscriptionMode;
    titleInputId: string;
    lengthInputId: string;
    onConditionChange: (change: {
      method: FilterMethod;
      condition: FilterCondition;
    }) => void;
  }

  const { conditions, match, mode, titleInputId, lengthInputId, onConditionChange }: Props = $props();

  const copy = $derived(MODE_COPY[mode]);
  const isCombined = $derived(conditions.length > 1);
  const titleFilter = $derived(
    conditions.find(condition => condition.kind === FilterKind.REGEX)
    ?? conditions.find(condition => condition.kind === FilterKind.AI_MATCH)
    ?? null
  );
  const titleKind = $derived.by(() => {
    if (conditions.some(condition => condition.kind === FilterKind.AI_MATCH)) {
      return FilterKind.AI_MATCH;
    }

    return FilterKind.REGEX;
  });

  /** Switching kinds keeps what was typed, so flipping back and forth loses nothing */
  const parkedTitleFilters: Partial<Record<TitleFilter["kind"], TitleFilter>> = {};

  function createEmptyTitleFilter(kind: TitleFilter["kind"]) {
    const emptyFilter: TitleFilter = kind === FilterKind.AI_MATCH ? { ...EMPTY_AI_FILTER } : { ...DEFAULT_TITLE_FILTER };
    return emptyFilter;
  }

  function switchTitleKind(kind: TitleFilter["kind"]) {
    if (!titleFilter || kind === titleFilter.kind) {
      return;
    }

    parkedTitleFilters[titleFilter.kind] = titleFilter;
    onConditionChange({
      method: FilterMethod.TITLE,
      condition: parkedTitleFilters[kind] ?? createEmptyTitleFilter(kind)
    });
  }
</script>

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
            bind:filter={() => condition, edited => onConditionChange({
              method: FilterMethod.TYPE,
              condition: edited
            })} />
        {:else if condition.kind === FilterKind.LENGTH}
          <header class="condition__header">
            <label class="condition__label" for={lengthInputId}>{FILTER_METHOD_LABEL[FilterMethod.LENGTH]}</label>
          </header>
          <LengthFilterFields
            inputId={lengthInputId}
            bind:filter={() => condition, edited => onConditionChange({
              method: FilterMethod.LENGTH,
              condition: edited
            })} />
        {:else}
          <header class="condition__header">
            <label class="condition__label" for={titleInputId}>
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
              inputId={titleInputId}
              placeholder={copy.regexPlaceholder}
              bind:filter={() => condition, edited => onConditionChange({
                method: FilterMethod.TITLE,
                condition: edited
              })} />
          {:else}
            <AiFilterFields
              hint={copy.aiHint}
              inputId={titleInputId}
              placeholder={copy.aiPlaceholder}
              bind:filter={() => condition, edited => onConditionChange({
                method: FilterMethod.TITLE,
                condition: edited
              })} />
          {/if}
        {/if}
      </section>
    </li>
  {/each}
</ol>

<style>
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
</style>
