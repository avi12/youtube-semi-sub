<script lang="ts">
  import { FilterKind } from "@/lib/filter/title-filter";

  interface Props {
    kind: FilterKind;
    onKindChange: (kind: FilterKind) => void;
  }

  const { kind, onKindChange }: Props = $props();

  const id = $props.id();
  const KIND_LABELS = {
    [FilterKind.regex]: "RegExp",
    [FilterKind.aiMatch]: "AI match"
  } satisfies Record<FilterKind, string>;
  const KINDS = Object.values(FilterKind);
</script>

<fieldset class="kind-switch">
  <legend class="kind-switch__legend">Filter by</legend>
  {#each KINDS as option (option)}
    <label class="kind-switch__option">
      <input
        name="{id}-kind"
        class="kind-switch__radio"
        checked={kind === option}
        onchange={() => onKindChange(option)}
        type="radio"
        value={option} />
      {KIND_LABELS[option]}
    </label>
  {/each}
</fieldset>

<style>
  .kind-switch {
    display: inline-flex;
    margin: 0;
    padding: 2px;
    border: 1px solid var(--editor-border);
    border-radius: 999px;
    background: var(--editor-surface);
  }

  .kind-switch__legend {
    position: absolute;
    overflow: hidden;
    block-size: 1px;
    inline-size: 1px;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .kind-switch__option {
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

  .kind-switch__radio {
    position: absolute;
    opacity: 0%;
    pointer-events: none;
  }
</style>
