<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    children: Snippet;
  }

  const { children }: Props = $props();
</script>

<li class="card">{@render children()}</li>

<style>
  .card {
    display: grid;
    border-radius: var(--m3-shape-extra-small);
    background: var(--m3c-surface-container);

    &:first-child {
      border-start-end-radius: var(--m3-shape-large-increased);
      border-start-start-radius: var(--m3-shape-large-increased);
    }

    &:last-child {
      border-end-start-radius: var(--m3-shape-large-increased);
      border-end-end-radius: var(--m3-shape-large-increased);
    }
  }
</style>
