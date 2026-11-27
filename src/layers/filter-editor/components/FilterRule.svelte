<script lang="ts">
  import { describeFilterRule } from "@/lib/filter/filter-literal";
  import type { VideoFilter } from "@/lib/filter/schema/video-filter-schema";
  import type { SubscriptionMode } from "@/lib/schemas/subscription-mode";

  interface Props {
    id: string;
    filter: VideoFilter;
    mode: SubscriptionMode;
    /** The fields the sentence is worked out from */
    inputIds: string;
  }

  const { id, filter, mode, inputIds }: Props = $props();

  const rule = $derived(
    describeFilterRule({
      filter,
      mode
    })
  );
</script>

<output {id} class="rule" aria-live="polite" data-mode={mode} for={inputIds}>
  <span class="rule__heading">So this filter</span>
  {#if rule.clauses.length > 0}
    <span class="rule__sentence">
      <strong class="rule__verb">{rule.verb}</strong>
      videos that
      {#each rule.clauses as clause, i (i)}
        {#if i > 0}
          <strong class="rule__connector">{` ${rule.connector}`}</strong>
        {/if}
        <bdi class="rule__clause">{clause}</bdi>
      {/each}
    </span>
  {/if}
  <span class="rule__otherwise">{rule.otherwise}</span>
  {#if rule.pendingNote}
    <span class="rule__pending">{rule.pendingNote}</span>
  {/if}
</output>

<style>
  .rule {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-block: 10px;
    padding-inline: 14px;
    border-inline-start: 3px solid var(--editor-accent);
    border-radius: 4px 10px 10px 4px;
    background: color-mix(in sRGB, var(--editor-accent) 8%, transparent);
    font-size: 13px;
    text-wrap: pretty;

    &[data-mode="hide"] {
      border-inline-start-color: var(--editor-error);
      background: color-mix(in sRGB, var(--editor-error) 6%, transparent);
    }
  }

  .rule__heading {
    color: var(--editor-muted);
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .rule__verb {
    font-weight: 700;
  }

  .rule__connector {
    font-weight: 700;
    text-transform: uppercase;
  }

  .rule__clause {
    overflow-wrap: anywhere;
  }

  .rule__otherwise {
    color: var(--editor-fg);
  }

  .rule__pending {
    color: var(--editor-muted);
    font-size: 12px;
  }
</style>
