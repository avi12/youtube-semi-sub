<script lang="ts">
  import FilterGlyph from "#subscription-lists/components/FilterGlyph.svelte";
  import { getManageLabel, opensSemiSubDialog } from "#subscription-lists/components/open-dialog";
  import { listsView } from "#subscription-lists/lists-view.svelte";

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
