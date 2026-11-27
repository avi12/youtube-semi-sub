<script lang="ts">
  import { AiEngine, type AiStatus, isAiEngineAvailable } from "@/lib/ai/ai-status";
  import type { Snippet } from "svelte";

  interface Props {
    /** An AI filter is among the conditions - nothing to say without one */
    isAiFilterShown: boolean;
    isAiEnabled: boolean;
    aiStatus: AiStatus | null;
    /** The host's way to turn AI match on or finish setting it up, shown while an AI filter can't run yet */
    aiSetup?: Snippet<[{
      isAiEnabled: boolean;
      aiStatus: AiStatus | null;
    }]>;
  }

  const { isAiFilterShown, isAiEnabled, aiStatus, aiSetup }: Props = $props();

  const notice = $derived.by(() => {
    if (!isAiFilterShown) {
      return null;
    }

    if (!isAiEnabled) {
      return "AI match is off - turn it on to let a model judge each video";
    }

    if (aiStatus?.engine === AiEngine.NONE) {
      return "AI match isn't available in this browser";
    }

    if (aiStatus && !aiStatus.isModelReady) {
      return "The AI model isn't on this device yet - videos get checked once it is";
    }

    return null;
  });
  const isSetupOffered = $derived(notice !== null && isAiEngineAvailable(aiStatus));
</script>

{#if notice}
  <section class="ai-notice" aria-live="polite">
    <p class="ai-notice__text">{notice}</p>
    {#if aiSetup && isSetupOffered}
      <div class="ai-notice__action">
        {@render aiSetup({
          isAiEnabled,
          aiStatus
        })}
      </div>
    {/if}
  </section>
{/if}

<style>
  .ai-notice {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    justify-content: space-between;
    align-items: center;
    margin-block-start: -4px;
    padding-block: 10px;
    padding-inline: 14px;
    border-radius: 10px;
    background: color-mix(in sRGB, var(--editor-accent) 10%, transparent);
  }

  .ai-notice__text {
    flex: 1 1 200px;
    margin: 0;
    color: var(--editor-fg);
    font-size: 13px;
    text-wrap: pretty;
  }

  .ai-notice__action {
    display: flex;
    flex: none;
    gap: 8px;
    align-items: center;
  }
</style>
