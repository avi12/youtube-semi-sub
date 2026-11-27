<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    children: Snippet;
  }

  const { children }: Props = $props();
</script>

<div class="connected">{@render children()}</div>

<style>
  .connected {
    display: flex;
    gap: 2px;

    & > :global(.button) {
      border-radius: var(--m3-shape-small);

      &:first-child {
        border-end-start-radius: var(--m3-shape-full);
        border-start-start-radius: var(--m3-shape-full);
      }

      &:last-child {
        border-end-end-radius: var(--m3-shape-full);
        border-start-end-radius: var(--m3-shape-full);
      }

      &:active {
        border-radius: var(--m3-shape-extra-small);
      }
    }
  }
</style>
