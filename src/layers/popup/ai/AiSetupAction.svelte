<script lang="ts">
  import { aiMatchSetup, turnOffAiMatch, turnOnAiMatch } from "./ai-match-setup.svelte";
  import { Button } from "m3-svelte";

  interface Props {
    isAiEnabled: boolean;
  }

  const { isAiEnabled }: Props = $props();

  const PERCENT = 100;

  const download = $derived(aiMatchSetup.download);
</script>

<!-- The editor's inline way to the same opt-in as the settings card: one store, so one download -->
{#if download}
  <output class="progress">
    Downloading
    {#if download.fraction !== null}
      {Math.round(download.fraction * PERCENT)}%
    {/if}
  </output>
  <Button onclick={() => turnOffAiMatch()} size="s" variant="text">Cancel</Button>
{:else}
  <Button onclick={() => turnOnAiMatch()} size="s" variant="tonal">
    {#if isAiEnabled}
      Download the model
    {:else}
      Turn on AI match
    {/if}
  </Button>
{/if}

<style>
  .progress {
    color: var(--m3c-on-surface-variant);
    font-weight: 500;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
</style>
