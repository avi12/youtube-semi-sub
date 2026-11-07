<script lang="ts">
  import YtButton from "./YtButton.svelte";
  import { ButtonViewModelIcon, ButtonViewModelType } from "@/lib/youtube/page/button-view-model";
  import type { EditorDisclosureProps } from "#filter-editor";

  // www's own text button with YouTube's expand chevron, the way its own panels show more

  const { label, children }: EditorDisclosureProps = $props();

  let isOpen = $state(false);
</script>

<div class="disclosure">
  <YtButton
    icon={isOpen ? ButtonViewModelIcon.expandLess : ButtonViewModelIcon.expandMore}
    {label}
    onclick={() => {
      isOpen = !isOpen;
    }}
    type={ButtonViewModelType.text} />
  {#if isOpen}
    {@render children()}
  {/if}
</div>

<style>
  .disclosure {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-start;
  }
</style>
