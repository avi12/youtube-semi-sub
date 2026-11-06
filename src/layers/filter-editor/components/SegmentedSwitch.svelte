<script generics="Value extends string" lang="ts">
  interface Props {
    /** Read by screen readers only - the switch sits beside a visible heading */
    legend: string;
    options: readonly Value[];
    labels: Record<Value, string>;
    value: Value;
    onValueChange: (value: Value) => void;
  }

  const { legend, options, labels, value, onValueChange }: Props = $props();

  const id = $props.id();
</script>

<fieldset class="segmented">
  <legend class="segmented__legend">{legend}</legend>
  {#each options as option (option)}
    <label class="segmented__option">
      <input
        name="{id}-option"
        class="segmented__radio"
        checked={value === option}
        onchange={() => onValueChange(option)}
        type="radio"
        value={option} />
      {labels[option]}
    </label>
  {/each}
</fieldset>

<style>
  .segmented {
    display: inline-flex;
    margin: 0;
    padding: 2px;
    border: 1px solid var(--editor-border);
    border-radius: 999px;
    background: var(--editor-surface);
  }

  .segmented__legend {
    position: absolute;
    overflow: hidden;
    block-size: 1px;
    inline-size: 1px;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .segmented__option {
    position: relative;
    padding-block: 4px;
    padding-inline: 12px;
    border-radius: 999px;
    color: var(--editor-muted);
    font-weight: 500;
    font-size: 12px;
    cursor: pointer;

    @media (prefers-reduced-motion: no-preference) {
      transition:
        background-color 150ms var(--editor-ease),
        color 150ms var(--editor-ease);
    }

    &:hover {
      color: var(--editor-fg);
    }

    &:has(:checked) {
      background: color-mix(in sRGB, var(--editor-accent) 18%, transparent);
      color: var(--editor-fg);
    }

    &:has(:focus-visible) {
      outline: 2px solid var(--editor-accent);
      outline-offset: 1px;
    }
  }

  .segmented__radio {
    position: absolute;
    opacity: 0%;
    pointer-events: none;
  }
</style>
