<script lang="ts">
  import { aiMatchSetup, turnOffAiMatch, turnOnAiMatch } from "./ai-match-setup.svelte";
  import { AiEngine, AiUnavailableReason, isAiEngineAvailable } from "@/lib/ai/ai-status";
  import { pluralize } from "@/lib/utils/pluralize";
  import { LITERT_MODEL_SIZE_LABEL } from "#ai-match";
  import { AI_MATCH_ICON } from "#popup/icons";
  import {
    Button,
    Icon,
    LinearProgress,
    ListItem,
    LoadingIndicator,
    Switch
  } from "m3-svelte";

  interface Props {
    isAiEnabled: boolean;
    /** Semi-subscriptions with an AI filter - paused while AI match is off */
    aiFilterCount: number;
  }

  const { isAiEnabled, aiFilterCount }: Props = $props();

  const PERCENT = 100;
  const LOADING_INDICATOR_SIZE = 20;

  const UNAVAILABLE_REASONS = {
    [AiUnavailableReason.noWebGpu]: "Not available here - this browser has no built-in AI, and no WebGPU to run a model of its own",
    [AiUnavailableReason.outdatedBrowser]: "Not available here - update your browser to run the on-device model"
  } satisfies Record<AiUnavailableReason, string>;

  const status = $derived(aiMatchSetup.status);
  const download = $derived(aiMatchSetup.download);
  const isAvailable = $derived(isAiEngineAvailable(status));
  const downloadPercent = $derived(Math.round((download?.fraction ?? 0) * PERCENT));
  const supportingText = $derived.by(() => {
    if (!status) {
      return "Checking what this browser can run";
    }

    return "Describe the videos you want in plain words, and a model on your device picks them";
  });
  const engineText = $derived.by(() => {
    if (status?.engine === AiEngine.builtIn) {
      return "Uses your browser's built-in AI, right on your device. If its model isn't there yet, your browser downloads it once";
    }

    if (status?.engine === AiEngine.liteRt) {
      return `Runs Gemma on your device through WebGPU. Turning this on downloads the model once (${LITERT_MODEL_SIZE_LABEL}), turning it off deletes it`;
    }

    if (status?.engine === AiEngine.none) {
      return UNAVAILABLE_REASONS[status.reason];
    }

    return "";
  });
  const pausedText = $derived.by(() => {
    const noun = pluralize({
      count: aiFilterCount,
      one: "AI filter is",
      other: "AI filters are"
    });
    return `${aiFilterCount} ${noun} paused until you turn this on`;
  });
  const isMissingModel = $derived.by(() => {
    if (!isAiEngineAvailable(status)) {
      return false;
    }

    return isAiEnabled && !status.isModelReady && !download;
  });
</script>

<section class="ai" aria-labelledby="ai-heading">
  <h2 id="ai-heading" class="ai__heading">AI match</h2>
  <ul class="ai__card">
    <ListItem headline="Match by description" label supporting={supportingText}>
      {#snippet leading()}
        <Icon icon={AI_MATCH_ICON} />
      {/snippet}
      {#snippet trailing()}
        <Switch
          disabled={!isAvailable}
          bind:checked={() => isAiEnabled, isChecked => {
            if (isChecked) {
              void turnOnAiMatch();
              return;
            }

            void turnOffAiMatch();
          }} />
      {/snippet}
    </ListItem>

    {#if status}
      <li class="ai__details">
        <p class={["ai__engine", status.engine === AiEngine.none && "ai__engine--unavailable"]}>{engineText}</p>

        {#if download}
          <div class="download">
            <p class="download__label">
              {#if download.fraction === null}
                <LoadingIndicator aria-label="Downloading" center={false} size={LOADING_INDICATOR_SIZE} />
                Your browser is downloading the model
              {:else}
                Downloading the model
                <output class="download__percent">{downloadPercent}%</output>
              {/if}
            </p>
            {#if download.fraction !== null}
              <LinearProgress aria-label="Model download" percent={downloadPercent} />
            {/if}
            <Button onclick={() => turnOffAiMatch()} size="s" variant="text">Cancel</Button>
          </div>
        {:else if aiMatchSetup.isFailed}
          <p class="ai__note ai__note--error" role="alert">
            Couldn't download the model - check your connection and try again
          </p>
        {:else if isMissingModel}
          <div class="ai__missing">
            <p class="ai__note">The model isn't on this device yet</p>
            <Button onclick={() => turnOnAiMatch()} size="s" variant="tonal">Download</Button>
          </div>
        {:else if isAiEnabled && status.engine !== AiEngine.none}
          <p class="ai__note">Ready - AI filters are judged on your device</p>
        {:else if aiFilterCount > 0 && isAvailable}
          <p class="ai__note">{pausedText}</p>
        {/if}
      </li>
    {/if}
  </ul>
</section>

<style>
  .ai {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ai__heading {
    margin: 0;
    padding-inline: 16px;
    color: var(--m3c-primary);
    font-weight: 500;
    font-size: 14px;
  }

  .ai__card {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;

    & :global(li > .m3-container) {
      block-size: auto;
      min-block-size: 72px;
      padding-inline-end: 16px;
      border-radius: var(--m3-shape-extra-small);
      border-start-end-radius: var(--m3-shape-large-increased);
      border-start-start-radius: var(--m3-shape-large-increased);
      background: var(--m3c-surface-container);
    }

    & :global(li > .m3-container .leading) {
      color: var(--m3c-primary);
    }
  }

  .ai__details {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-block: 14px 16px;
    padding-inline: 56px 16px;
    border-radius: var(--m3-shape-extra-small);
    border-end-start-radius: var(--m3-shape-large-increased);
    border-end-end-radius: var(--m3-shape-large-increased);
    background: var(--m3c-surface-container);
  }

  .ai__engine,
  .ai__note {
    margin: 0;
    color: var(--m3c-on-surface-variant);
    font-size: 13px;
    text-wrap: pretty;
  }

  .ai__engine--unavailable {
    color: var(--m3c-on-surface);
  }

  .ai__note {
    color: var(--m3c-on-surface);
    font-weight: 500;
  }

  .ai__note--error {
    color: var(--m3c-error);
  }

  .ai__missing {
    display: flex;
    gap: 8px;
    justify-content: space-between;
    align-items: center;
  }

  .download {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px 12px;
    align-items: center;

    & :global(.m3-container[role="progressbar"]) {
      grid-column: 1;
    }
  }

  .download__label {
    display: flex;
    grid-column: 1 / -1;
    gap: 8px;
    align-items: center;
    margin: 0;
    color: var(--m3c-on-surface);
    font-weight: 500;
    font-size: 13px;
  }

  .download__percent {
    margin-inline-start: auto;
    font-variant-numeric: tabular-nums;
  }
</style>
