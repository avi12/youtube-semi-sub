<script lang="ts">
  import { AI_DESCRIPTION_MAX_LENGTH, type AiFilter } from "@/lib/filter/title-filter";

  interface Props {
    filter: AiFilter;
    /** The description's id, so the editor's label and preview summary can point at it */
    inputId: string;
  }

  let { filter = $bindable(), inputId }: Props = $props();

  const hintId = $derived(`${inputId}-hint`);
</script>

<div class="ai-fields">
  <textarea
    id={inputId}
    class="ai-fields__input"
    aria-describedby={hintId}
    data-filter-input
    dir="auto"
    maxlength={AI_DESCRIPTION_MAX_LENGTH}
    placeholder="Only phone reviews, not unboxings"
    rows="2"
    bind:value={() => filter.description, description => {
      filter = {
        ...filter,
        description
      };
    }}></textarea>
  <p id={hintId} class="ai-fields__hint">
    <span>A model reads each video's title and description, and lets in the ones that fit</span>
    <output class="ai-fields__count" for={inputId}>{filter.description.length}/{AI_DESCRIPTION_MAX_LENGTH}</output>
  </p>
</div>

<style>
  .ai-fields {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .ai-fields__input {
    min-block-size: 64px;
    max-block-size: 148px;
    padding-block: 10px;
    padding-inline: 12px;
    border: 1px solid var(--editor-border);
    border-radius: 10px;
    background: var(--editor-surface);
    color: var(--editor-fg);
    font: inherit;
    font-size: 15px;
    line-height: 1.4;
    resize: none;
    field-sizing: content;

    @media (prefers-reduced-motion: no-preference) {
      transition:
        border-color 120ms var(--editor-ease),
        box-shadow 120ms var(--editor-ease);
    }

    &::placeholder {
      color: var(--editor-muted);
      opacity: 60%;
    }

    &:focus-visible {
      border-color: var(--editor-accent);
      outline: none;
      box-shadow: 0 0 0 1px var(--editor-accent);
    }
  }

  .ai-fields__hint {
    display: flex;
    gap: 12px;
    justify-content: space-between;
    margin: 0;
    color: var(--editor-muted);
    font-size: 12px;
  }

  .ai-fields__count {
    flex: none;
    font-variant-numeric: tabular-nums;
  }
</style>
