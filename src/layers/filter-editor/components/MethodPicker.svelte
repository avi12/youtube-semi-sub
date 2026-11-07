<script lang="ts">
  import type { FilterMethod } from "@/lib/filter/title-filter";
  import { FILTER_METHOD_LABEL, FILTER_METHODS } from "#filter-editor/filter-methods";

  interface Props {
    pickedMethods: FilterMethod[];
    onPickedChange: (change: {
      method: FilterMethod;
      isPicked: boolean;
    }) => void;
  }

  const { pickedMethods, onPickedChange }: Props = $props();

  /** A filter always judges by something, so the last picked method can't be dropped */
  const isLastPick = $derived(pickedMethods.length === 1);
</script>

<fieldset class="methods">
  <legend class="methods__legend">Filter by</legend>
  {#each FILTER_METHODS as method (method)}
    {@const isPicked = pickedMethods.includes(method)}
    <label class="filter-editor-chip methods__chip">
      <input
        class="filter-editor-chip__input"
        checked={isPicked}
        disabled={isPicked && isLastPick}
        onchange={e => onPickedChange({
          method,
          isPicked: e.currentTarget.checked
        })}
        type="checkbox" />
      <svg class="methods__check" aria-hidden="true" viewBox="0 0 16 16">
        <path d="m3.5 8.5 3 3 6-7" />
      </svg>
      {FILTER_METHOD_LABEL[method]}
    </label>
  {/each}
</fieldset>

<style>
  .methods {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin: 0;
    padding: 0;
    border: 0;
  }

  .methods__legend {
    float: inline-start;
    margin-inline-end: 4px;
    padding: 0;
    color: var(--editor-fg);
    font-weight: 600;
    font-size: 13px;
  }

  .methods__chip {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    padding-inline: 10px 14px;
  }

  .methods__check {
    block-size: 16px;
    inline-size: 0;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2;

    @media (prefers-reduced-motion: no-preference) {
      transition: inline-size 150ms var(--editor-ease);
    }

    .filter-editor-chip:has(:checked) & {
      inline-size: 16px;
    }
  }
</style>
