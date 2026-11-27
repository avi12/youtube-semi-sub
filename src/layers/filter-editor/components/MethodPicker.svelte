<script lang="ts">
  import type { FilterMethod } from "@/lib/filter/schema/video-filter-schema";
  import { getEditorControls } from "#filter-editor/controls";
  import { FILTER_METHOD_LABEL, FILTER_METHODS } from "#filter-editor/filter-methods";

  interface Props {
    pickedMethods: FilterMethod[];
    onPickedChange: (change: {
      method: FilterMethod;
      isPicked: boolean;
    }) => void;
  }

  const { pickedMethods, onPickedChange }: Props = $props();

  const { Chip } = getEditorControls();
  /** A filter always judges by something, so the last picked method can't be dropped */
  const isLastPick = $derived(pickedMethods.length === 1);
</script>

<fieldset class="methods">
  <legend class="methods__legend">Filter by</legend>
  {#each FILTER_METHODS as method (method)}
    {@const isPicked = pickedMethods.includes(method)}
    <Chip
      isDisabled={isPicked && isLastPick}
      isSelected={isPicked}
      label={FILTER_METHOD_LABEL[method]}
      onToggle={() => onPickedChange({
        method,
        isPicked: !isPicked
      })} />
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
</style>
