<script lang="ts">
  import { AI_DESCRIPTION_MAX_LENGTH, type AiFilter } from "@/lib/filter/title-filter";
  import { getEditorControls } from "#filter-editor/controls";

  interface Props {
    filter: AiFilter;
    /** The description's id, so the editor's label and preview summary can point at it */
    inputId: string;
    placeholder: string;
    /** What the model does with the videos that fit, in this mode */
    hint: string;
  }

  let { filter = $bindable(), inputId, placeholder, hint }: Props = $props();

  const { TextField } = getEditorControls();

  const hintId = $derived(`${inputId}-hint`);
</script>

<div class="ai-fields">
  <TextField
    id={inputId}
    describedBy={hintId}
    isFocusedOnOpen
    isMultiline
    label="Description"
    maxLength={AI_DESCRIPTION_MAX_LENGTH}
    onValueChange={description => {
      filter = {
        ...filter,
        description
      };
    }}
    {placeholder}
    value={filter.description} />
  <p id={hintId} class="ai-fields__hint">{hint}</p>
</div>

<style>
  .ai-fields {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .ai-fields__hint {
    margin: 0;
    color: var(--editor-muted);
    font-size: 12px;
  }
</style>
