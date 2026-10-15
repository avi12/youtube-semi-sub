<script lang="ts">
  import FilterGlyph from "./FilterGlyph.svelte";
  import { listsView } from "./lists-view.svelte";
  import { getManageLabel, opensSemiSubDialog } from "./open-dialog";

  const { channelId }: { channelId: string } = $props();

  const subscription = $derived(listsView.subscriptions.find(candidate => candidate.channelId === channelId));
</script>

{#if subscription}
  <button
    class="yss-guide-action"
    {@attach opensSemiSubDialog(subscription)}
    aria-haspopup="dialog"
    aria-label={getManageLabel(subscription)}
    title="Semi-subscribed - edit the filter"
    type="button">
    <FilterGlyph />
  </button>
{/if}
