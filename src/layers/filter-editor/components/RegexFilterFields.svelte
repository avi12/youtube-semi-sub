<script lang="ts">
  import Disclosure from "./Disclosure.svelte";
  import type { TitleFilter } from "@/lib/filter/title-filter";
  import {
    ADVANCED_FILTER_FLAGS,
    FILTER_FLAG_DETAILS,
    type FilterFlag,
    IGNORE_CASE_FLAG,
    setFilterFlag
  } from "#filter-editor/filter-flags";
  import { getReadableFilterError } from "#filter-editor/title-matches";

  interface Props {
    filter: TitleFilter;
    /** The pattern input's id, so the editor's label and preview summary can point at it */
    inputId: string;
  }

  let { filter = $bindable(), inputId }: Props = $props();

  const hintId = $derived(`${inputId}-hint`);
  const errorId = $derived(`${inputId}-error`);
  const error = $derived(getReadableFilterError(filter));
  const enabledAdvancedFlags = $derived(ADVANCED_FILTER_FLAGS.filter(flag => filter.flags.includes(flag)).join(""));

  function setFlag({ flag, isEnabled }: Omit<Parameters<typeof setFilterFlag>[0], "flags">) {
    filter = {
      ...filter,
      flags: setFilterFlag({
        flags: filter.flags,
        flag,
        isEnabled
      })
    };
  }
</script>

{#snippet flagToggle(flag: FilterFlag)}
  <label class="flag">
    <input
      class="flag__checkbox"
      type="checkbox"
      bind:checked={() => filter.flags.includes(flag), isEnabled => setFlag({
        flag,
        isEnabled
      })} />
    <span class="flag__text">
      <span class="flag__label">
        {FILTER_FLAG_DETAILS[flag].label}
        <code class="flag__letter">{flag}</code>
      </span>
      <span class="flag__description">{FILTER_FLAG_DETAILS[flag].description}</span>
    </span>
  </label>
{/snippet}

<div class="regex">
  <div class="regex__field">
    <span class="regex__slash" aria-hidden="true">/</span>
    <input
      id={inputId}
      class="regex__input"
      aria-describedby="{hintId} {errorId}"
      aria-invalid={error !== null}
      autocapitalize="off"
      autocomplete="off"
      dir="auto"
      placeholder="tutorial|review"
      spellcheck="false"
      type="text"
      bind:value={() => filter.pattern, pattern => {
        filter = {
          ...filter,
          pattern
        };
      }} />
    <span class="regex__slash" aria-hidden="true">/<span class="regex__flags">{filter.flags}</span></span>
  </div>
  <p id={hintId} class="regex__hint">Leave it empty to let every video through</p>
  <p id={errorId} class="regex__error" aria-live="polite">{error ?? ""}</p>

  <div class="flags">
    {@render flagToggle(IGNORE_CASE_FLAG)}
    <Disclosure>
      {#snippet summary()}
        More flags
        {#if enabledAdvancedFlags}
          <code class="flag__letter">{enabledAdvancedFlags}</code>
        {/if}
      {/snippet}
      <ul class="flags__advanced">
        {#each ADVANCED_FILTER_FLAGS as flag (flag)}
          <li>{@render flagToggle(flag)}</li>
        {/each}
      </ul>
    </Disclosure>
  </div>
</div>

<style>
  .regex {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .regex__field {
    display: flex;
    align-items: center;
    padding-inline: 12px;
    border: 1px solid var(--editor-border);
    border-radius: 10px;
    background: var(--editor-surface);
    font-family: var(--editor-mono);
    font-size: 15px;

    @media (prefers-reduced-motion: no-preference) {
      transition:
        border-color 120ms var(--editor-ease),
        box-shadow 120ms var(--editor-ease);
    }

    &:focus-within {
      border-color: var(--editor-accent);
      box-shadow: 0 0 0 1px var(--editor-accent);
    }

    &:has([aria-invalid="true"]) {
      border-color: var(--editor-error);
      box-shadow: 0 0 0 1px var(--editor-error);
    }
  }

  .regex__slash {
    flex: none;
    color: var(--editor-muted);
    user-select: none;
  }

  .regex__flags {
    color: var(--editor-accent);
    font-weight: 600;
  }

  .regex__input {
    flex: 1;
    min-inline-size: 0;
    padding-block: 10px;
    padding-inline: 6px;
    border: 0;
    background: transparent;
    color: var(--editor-fg);
    font: inherit;

    &::placeholder {
      color: var(--editor-muted);
      opacity: 60%;
    }

    &:focus-visible {
      outline: none;
    }
  }

  .regex__hint,
  .regex__error {
    margin: 0;
    font-size: 12px;
  }

  .regex__hint {
    color: var(--editor-muted);
  }

  .regex__error {
    color: var(--editor-error);
    font-weight: 500;

    &:empty {
      display: none;
    }
  }

  .flags {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-block-start: 8px;
  }

  .flag {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding-block: 6px;
    padding-inline: 8px;
    border-radius: 8px;
    cursor: pointer;

    &:hover {
      background: color-mix(in sRGB, var(--editor-fg) 6%, transparent);
    }
  }

  .flag__checkbox {
    flex: none;
    block-size: 16px;
    inline-size: 16px;
    margin: 0;
    margin-block-start: 2px;
    accent-color: var(--editor-accent);
    cursor: inherit;
  }

  .flag__text {
    display: flex;
    flex-direction: column;
  }

  .flag__label {
    display: flex;
    gap: 6px;
    align-items: baseline;
    font-weight: 500;
  }

  .flag__letter {
    padding-inline: 5px;
    border-radius: 4px;
    background: color-mix(in sRGB, var(--editor-fg) 8%, transparent);
    color: var(--editor-muted);
    font-family: var(--editor-mono);
    font-size: 12px;
  }

  .flag__description {
    color: var(--editor-muted);
    font-size: 12px;
  }

  .flags__advanced {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    padding-inline-start: 12px;
    list-style: none;
  }
</style>
