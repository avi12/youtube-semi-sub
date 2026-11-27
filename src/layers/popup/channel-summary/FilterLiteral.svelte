<script lang="ts">
  import { AI_LITERAL_PREFIX, describeFilterLiteral, FilterLiteralKind } from "@/lib/filter/filter-literal";
  import type { SemiSubscription } from "@/lib/schemas/semi-subscription";

  interface Props {
    subscription: SemiSubscription;
    isAiEnabled: boolean;
  }

  const { subscription, isAiEnabled }: Props = $props();

  const literal = $derived(
    describeFilterLiteral({
      subscription,
      isAiEnabled
    })
  );
</script>

<ul class="literal">
  {#each literal.parts as part, i (i)}
    <li class="literal__part">
      {#if i > 0}
        <span class="literal__connector">{literal.connector}</span>
      {/if}
      {#if part.kind === FilterLiteralKind.AI_MATCH}
        <p class={["ai-literal", part.isPaused && "ai-literal--paused"]}>
          <span class="ai-literal__badge">{AI_LITERAL_PREFIX}</span>
          <bdi class="ai-literal__description">{part.text}</bdi>
        </p>
      {:else if part.kind === FilterLiteralKind.REGEX}
        <code class="filter-literal" dir="ltr">
          <span class="filter-literal__pattern">{part.text}</span><span class="filter-literal__flags"
          >{part.flags}</span>
        </code>
      {:else}
        <code class="filter-literal"><span class="filter-literal__any">{part.text}</span></code>
      {/if}
    </li>
  {/each}
</ul>

<style>
  .literal {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .literal__part {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .literal__connector {
    color: var(--m3c-on-surface-variant);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .filter-literal {
    display: -webkit-box;
    overflow: hidden;
    color: var(--m3c-on-surface);
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.4;
    overflow-wrap: anywhere;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .filter-literal__pattern {
    &::before,
    &::after {
      content: "/";
      color: var(--m3c-on-surface-variant);
    }
  }

  .filter-literal__flags {
    color: var(--m3c-primary);
    font-weight: 700;
  }

  .filter-literal__any {
    color: var(--m3c-on-surface-variant);
    font-family: var(--m3-font);
    font-style: italic;
  }

  .ai-literal {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    margin: 0;
    color: var(--m3c-on-surface);
    font-size: 13px;
    line-height: 1.4;
  }

  .ai-literal__badge {
    flex: none;
    padding-inline: 6px;
    border-radius: var(--m3-shape-full);
    background: var(--m3c-primary-container);
    color: var(--m3c-on-primary-container);
    font-weight: 700;
    font-size: 11px;
    line-height: 18px;
  }

  .ai-literal__description {
    display: -webkit-box;
    overflow: hidden;
    overflow-wrap: anywhere;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .ai-literal--paused {
    color: var(--m3c-on-surface-variant);

    & .ai-literal__badge {
      background: var(--m3c-surface-container-highest);
      color: var(--m3c-on-surface-variant);
    }
  }
</style>
