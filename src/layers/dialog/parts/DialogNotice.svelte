<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    children: Snippet;
  }

  const { children }: Props = $props();
</script>

<p class="notice" role="alert">
  {@render children()}
</p>

<style>
  .notice {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: space-between;
    align-items: center;
    margin: 0;
    padding-block: 8px;
    padding-inline: 16px 8px;
    border-radius: 12px;
    background: var(--additive);
  }
</style>
