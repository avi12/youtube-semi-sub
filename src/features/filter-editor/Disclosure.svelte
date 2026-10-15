<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    summary: Snippet;
    children: Snippet;
  }

  const { summary, children }: Props = $props();
</script>

<details class="disclosure">
  <summary class="disclosure__summary">{@render summary()}</summary>
  {@render children()}
</details>

<style>
  .disclosure__summary {
    display: flex;
    gap: 6px;
    align-items: center;
    inline-size: fit-content;
    padding-block: 4px;
    padding-inline: 8px;
    border-radius: 8px;
    color: var(--editor-muted);
    list-style: none;
    font-size: 13px;
    cursor: pointer;

    &::-webkit-details-marker {
      display: none;
    }

    &::before {
      content: "";
      flex: none;
      block-size: 6px;
      inline-size: 6px;
      border-block-end: 1.5px solid currentColor;
      border-inline-end: 1.5px solid currentColor;
      rotate: -45deg;

      @media (prefers-reduced-motion: no-preference) {
        transition: rotate 150ms var(--editor-ease);
      }
    }

    &:hover {
      color: var(--editor-fg);
    }
  }

  .disclosure[open] > .disclosure__summary::before {
    rotate: 45deg;
  }
</style>
