<script lang="ts">
  import type { RegexFilter } from "@/lib/filter/schema/video-filter-schema";
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

  const { Checkbox, TextField, Disclosure } = getEditorControls();
  const hintId = $derived(`${inputId}-hint`);
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

{#snippet slash()}
  <span class="regex__slash" aria-hidden="true">/</span>
{/snippet}

{#snippet slashFlags()}
  <span class="regex__slash" aria-hidden="true">/<span class="regex__flags">{filter.flags}</span></span>
{/snippet}

<div class="regex">
  <TextField
    id={inputId}
    describedBy={hintId}
    {error}
    isCode
    isFocusedOnOpen
    label="Pattern"
    onValueChange={pattern => {
      filter = {
        ...filter,
        pattern
      };
    }}
    {placeholder}
    prefix={slash}
    suffix={slashFlags}
    value={filter.pattern} />
  <p id={hintId} class="regex__hint">{emptyPatternHint}</p>

  <div class="flags">
    {@render flagToggle(IGNORE_CASE_FLAG)}
    <Disclosure label={enabledAdvancedFlags ? `More flags (${enabledAdvancedFlags})` : "More flags"}>
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

  .regex__slash {
    flex: none;
    color: var(--editor-muted);
    font-family: var(--editor-mono);
    font-size: 15px;
    user-select: none;
  }

  .regex__flags {
    color: var(--editor-accent);
    font-weight: 600;
  }

  .regex__hint {
    margin: 0;
    color: var(--editor-muted);
    font-size: 12px;
  }

  .flags {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-block-start: 8px;
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
