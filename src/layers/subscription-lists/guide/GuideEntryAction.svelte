<script lang="ts">
  import FilterGlyph from "#subscription-lists/components/FilterGlyph.svelte";
  import { describeManageButton, opensSemiSubDialog } from "#subscription-lists/components/open-dialog";
  import { listsView } from "#subscription-lists/lists-view.svelte";

  const { channelId }: { channelId: string } = $props();

  const subscription = $derived(listsView.subscriptions.find(candidate => candidate.channelId === channelId));
  const manageButton = $derived(subscription && describeManageButton(subscription));
</script>

{#if subscription && manageButton}
  <button
    class="yss-guide-action"
    {@attach opensSemiSubDialog(subscription)}
    aria-haspopup="dialog"
    aria-label={manageButton.accessibilityText}
    title="{manageButton.label} - edit the filter"
    type="button">
    <FilterGlyph />
  </button>
{/if}
