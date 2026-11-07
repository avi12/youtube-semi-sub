<script lang="ts">
  import { describeLengthRange } from "@/lib/filter/filter-literal";
  import { formatLengthExpression, parseLengthExpression } from "@/lib/filter/length-expression";
  import { FilterKind, type LengthFilter } from "@/lib/filter/title-filter";
  import { getEditorControls } from "#filter-editor/controls";
  import { untrack } from "svelte";

  interface Props {
    filter: LengthFilter;
    /** The expression input's id, so the card's heading can point at it */
    inputId: string;
  }

  let { filter = $bindable(), inputId }: Props = $props();

  const EXAMPLES = [">=10m", "<=20m", "5-20m", "under 1h"] as const;
  const { Chip, TextField } = getEditorControls();

  const hintId = $derived(`${inputId}-hint`);
  const readingId = $derived(`${inputId}-reading`);
  /** What the user typed - the filter only keeps the bounds it reads as */
  let expression = $state(untrack(() => formatLengthExpression(filter)));
  const parsed = $derived(parseLengthExpression(expression));
  const reading = $derived.by(() => {
    if (!parsed.bounds) {
      return null;
    }

    return `Videos that run ${describeLengthRange({
      kind: FilterKind.length,
      ...parsed.bounds
    })}`;
  });

  /** A filter swapped in from outside (a mode switch) resets the text; one that reads the same as it keeps it */
  $effect(() => {
    const filterExpression = formatLengthExpression(filter);
    const typedExpression = untrack(() => formatLengthExpression({
      kind: FilterKind.length,
      ...parsed.bounds
    }));
    if (filterExpression !== typedExpression) {
      expression = filterExpression;
    }
  });

  /** An expression it can't read sets no bound, so the filter can't be saved until it reads */
  function setExpression(text: string) {
    expression = text;
    const updated: LengthFilter = {
      kind: FilterKind.length,
      ...parsed.bounds
    };
    filter = updated;
  }
</script>

<div class="length">
  <TextField
    id={inputId}
    describedBy="{readingId} {hintId}"
    error={parsed.error}
    isCode
    label="Range"
    onValueChange={setExpression}
    placeholder=">=10m, 5-20m, under 1h"
    value={expression} />
  <output id={readingId} class="length__reading" for={inputId}>{reading}</output>
  <p id={hintId} class="length__hint">
    <span>Use s, m or h, compare with &lt; &gt; &lt;= &gt;=, or give a range - Shorts run up to 3 min</span>
    <span class="length__examples">
      {#each EXAMPLES as example (example)}
        <Chip isSelected={expression === example} label={example} onToggle={() => setExpression(example)} />
      {/each}
    </span>
  </p>
</div>

<style>
  .length {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .length__reading {
    color: var(--editor-fg);
    font-weight: 500;
    font-size: 12px;

    &:empty {
      display: none;
    }
  }

  .length__hint {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 10px;
    align-items: center;
    margin: 0;
    color: var(--editor-muted);
    font-size: 12px;
  }

  .length__examples {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
</style>
