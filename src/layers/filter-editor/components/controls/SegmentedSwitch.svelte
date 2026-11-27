<script generics="Value extends string" lang="ts">
  import { getEditorControls } from "#filter-editor/controls";

  interface Props {
    /** Read by screen readers only - the switch sits beside a visible heading */
    legend: string;
    options: readonly Value[];
    labels: Record<Value, string>;
    value: Value;
    onValueChange: (value: Value) => void;
  }

  const { legend, options, labels, value, onValueChange }: Props = $props();

  const { Chip } = getEditorControls();
</script>

<fieldset class="segmented">
  <legend class="segmented__legend">{legend}</legend>
  {#each options as option (option)}
    <Chip isSelected={value === option} label={labels[option]} onToggle={() => onValueChange(option)} />
  {/each}
</fieldset>

<style>
  .segmented {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    border: 0;
  }

  .segmented__legend {
    position: absolute;
    overflow: hidden;
    block-size: 1px;
    inline-size: 1px;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
