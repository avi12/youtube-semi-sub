<script lang="ts">
  import type { EditorChipProps } from "#filter-editor/controls";

  const { label, isSelected, isDisabled = false, onToggle }: EditorChipProps = $props();
</script>

<button
  class="chip"
  aria-pressed={isSelected}
  disabled={isDisabled}
  onclick={() => {
    if (!isDisabled) {
      onToggle();
    }
  }}
  type="button">
  {label}
</button>

<style>
  /* Inside the editor its tokens apply; a host placing a chip elsewhere themes it through `--filter-editor-*` */
  .chip {
    --chip-fg: var(--editor-fg, var(--filter-editor-fg, CanvasText));
    --chip-muted: var(--editor-muted, var(--filter-editor-muted, color-mix(in srgb, CanvasText 60%, Canvas)));
    --chip-accent: var(--editor-accent, var(--filter-editor-accent, LinkText));
    --chip-border: var(--editor-border, var(--filter-editor-border, color-mix(in srgb, CanvasText 20%, Canvas)));
    --chip-ease: var(--editor-ease, cubic-bezier(0.2, 0, 0, 1));

    padding-block: 5px;
    padding-inline: 12px;
    border: 1px solid var(--chip-border);
    border-radius: 8px;
    background: transparent;
    color: var(--chip-muted);
    font: inherit;
    font-weight: 500;
    font-size: 13px;
    cursor: pointer;

    @media (prefers-reduced-motion: no-preference) {
      transition:
        background-color 150ms var(--chip-ease),
        border-color 150ms var(--chip-ease),
        color 150ms var(--chip-ease);
    }

    &:hover {
      color: var(--chip-fg);
    }

    &:disabled {
      cursor: default;
    }

    &[aria-pressed="true"] {
      border-color: transparent;
      background: color-mix(in sRGB, var(--chip-accent) 18%, transparent);
      color: var(--chip-fg);
    }

    &:focus-visible {
      outline: 2px solid var(--chip-accent);
      outline-offset: 1px;
    }
  }
</style>
