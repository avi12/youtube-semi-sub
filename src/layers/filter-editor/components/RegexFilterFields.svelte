<script lang="ts">
  import Disclosure from "./Disclosure.svelte";
  import type { RegexFilter } from "@/lib/filter/title-filter";
  import { getEditorControls } from "#filter-editor/controls";
  import {
    ADVANCED_FILTER_FLAGS,
    FILTER_FLAG_DETAILS,
    type FilterFlag,
    IGNORE_CASE_FLAG,
    setFilterFlag
  } from "#filter-editor/filter-flags";
  import { getReadableFilterError } from "#filter-editor/preview/title-matches";

  interface Props {
    filter: RegexFilter;
    /** The pattern input's id, so the editor's label and preview summary can point at it */
    inputId: string;
    placeholder: string;
    /** What an empty pattern does in this mode */
    emptyPatternHint: string;
  }

  let { filter = $bindable(), inputId, placeholder, emptyPatternHint }: Props = $props();

  const { Checkbox } = getEditorControls();
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
  <Checkbox
    hint={FILTER_FLAG_DETAILS[flag].description}
    isChecked={filter.flags.includes(flag)}
    label="{FILTER_FLAG_DETAILS[flag].label} ({flag})"
    onCheckedChange={isEnabled => setFlag({
      flag,
      isEnabled
    })} />
{/snippet}

<div class="regex">
  <div class="regex__field filter-editor-field">
    <span class="regex__slash" aria-hidden="true">/</span>
    <input
      id={inputId}
      class="regex__input"
      aria-describedby="{hintId} {errorId}"
      aria-invalid={error !== null}
      autocapitalize="off"
      autocomplete="off"
      data-filter-input
      dir="auto"
      {placeholder}
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
  <p id={hintId} class="regex__hint">{emptyPatternHint}</p>
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
    font-family: var(--editor-mono);
    font-size: 15px;
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

  .flag__letter {
    padding-inline: 5px;
    border-radius: 4px;
    background: color-mix(in sRGB, var(--editor-fg) 8%, transparent);
    color: var(--editor-muted);
    font-family: var(--editor-mono);
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
