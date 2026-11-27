<script lang="ts">
  import ListCard from "#popup/ui/list/ListCard.svelte";
  import type { Snippet } from "svelte";

  interface Props {
    headline: string;
    supporting: string;
    /** Makes the whole row the label of the control in `trailing` */
    isLabel?: boolean;
    leading?: Snippet;
    trailing?: Snippet;
  }

  const { headline, supporting, isLabel = false, leading, trailing }: Props = $props();
</script>

<ListCard>
  <svelte:element this={isLabel ? "label" : "div"} class={["row", isLabel && "row--label"]}>
    {#if leading}
      <span class="leading">{@render leading()}</span>
    {/if}
    <span class="text">
      <span class="headline">{headline}</span>
      <span class="supporting">{supporting}</span>
    </span>
    {#if trailing}
      {@render trailing()}
    {/if}
  </svelte:element>
</ListCard>

<style>
  .row {
    display: flex;
    gap: 16px;
    align-items: center;
    min-block-size: 72px;
    padding-block: 12px;
    padding-inline: 16px;
    border-radius: inherit;
  }

  .row--label {
    cursor: pointer;

    &:hover {
      background: color-mix(in sRGB, var(--m3c-on-surface) 8%, transparent);
    }
  }

  .leading {
    display: flex;
    color: var(--m3c-primary);
  }

  .text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-inline-size: 0;
  }

  .headline {
    color: var(--m3c-on-surface);
    font-size: 16px;
    line-height: 1.5;
  }

  .supporting {
    color: var(--m3c-on-surface-variant);
    font-size: 14px;
    line-height: 1.43;
    text-wrap: pretty;
  }
</style>
