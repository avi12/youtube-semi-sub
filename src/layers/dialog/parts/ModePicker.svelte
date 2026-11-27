<script lang="ts">
  import { SubscriptionMode } from "@/lib/schemas/subscription-mode";
  import type { EditorControls } from "#filter-editor";

  interface Props {
    mode: SubscriptionMode;
    controls: EditorControls;
    onPick: (mode: SubscriptionMode) => void;
  }

  const { mode, controls, onPick }: Props = $props();

  const MODE_LIST_NAME = {
    [SubscriptionMode.FOLLOW]: "Allow list",
    [SubscriptionMode.HIDE]: "Block list"
  } as const satisfies Record<SubscriptionMode, string>;
  /** What each list does to a video its filter matches - the one thing that tells them apart */
  const MODE_LIST_EFFECT = {
    [SubscriptionMode.FOLLOW]: "Only matching videos show",
    [SubscriptionMode.HIDE]: "Matching videos are hidden"
  } as const satisfies Record<SubscriptionMode, string>;
</script>

<fieldset class="modes">
  <legend class="modes__legend">List type</legend>
  <span class="modes__chips">
    {#each Object.values(SubscriptionMode) as option (option)}
      <controls.Chip isSelected={mode === option} label={MODE_LIST_NAME[option]} onToggle={() => onPick(option)} />
    {/each}
  </span>
  <span class="modes__effect">{MODE_LIST_EFFECT[mode]}</span>
</fieldset>

<style>
  .modes {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    border: 0;
  }

  .modes__legend {
    margin-block-end: 8px;
    padding: 0;
    color: var(--text-secondary);
    font-size: 12px;
  }

  .modes__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .modes__effect {
    color: var(--text-secondary);
    font-size: 12px;
  }
</style>
