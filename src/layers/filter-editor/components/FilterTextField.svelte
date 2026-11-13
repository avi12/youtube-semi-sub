<script lang="ts">
  import { type EditorTextFieldProps, FOCUSED_ON_OPEN_ATTRIBUTE } from "#filter-editor/controls";
  import type { HTMLInputAttributes, HTMLTextareaAttributes } from "svelte/elements";

  const {
    id,
    value,
    placeholder,
    describedBy,
    error = null,
    maxLength,
    isCode = false,
    isMultiline = false,
    isFocusedOnOpen = false,
    prefix,
    suffix,
    onValueChange
  }: EditorTextFieldProps = $props();

  const errorId = $derived(`${id}-error`);
  /** What the one-line input and the textarea share */
  const attributes = $derived.by(() => {
    const shared: HTMLInputAttributes & HTMLTextareaAttributes = {
      id,
      class: "text-field__input",
      "aria-describedby": `${describedBy} ${errorId}`,
      "aria-invalid": error !== null,
      autocapitalize: isCode ? "off" : undefined,
      autocomplete: "off",
      dir: isCode ? "ltr" : "auto",
      maxlength: maxLength,
      placeholder,
      spellcheck: isCode ? false : undefined,
      value,
      [FOCUSED_ON_OPEN_ATTRIBUTE]: isFocusedOnOpen || undefined,
      oninput(e) {
        onValueChange(e.currentTarget.value);
      }
    };
    return shared;
  });
</script>

<div class={["text-field", isCode && "text-field--code"]}>
  <div class="filter-editor-field">
    {@render prefix?.()}
    {#if isMultiline}
      <textarea {...attributes} class="text-field__input text-field__input--multiline" rows="2"></textarea>
    {:else}
      <input {...attributes} type="text" />
    {/if}
    {@render suffix?.()}
  </div>
  <p id={errorId} class="text-field__error" aria-live="polite">{error ?? ""}</p>
  {#if maxLength !== undefined}
    <output class="text-field__count" for={id}>{value.length}/{maxLength}</output>
  {/if}
</div>

<style>
  .text-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 15px;
  }

  .text-field--code {
    font-family: var(--editor-mono);
  }

  .text-field__input {
    flex: 1;
    min-inline-size: 0;
    padding-block: 10px;
    padding-inline: 6px;
    border: 0;
    background: transparent;
    color: var(--editor-fg);
    font: inherit;
    line-height: 1.4;

    &::placeholder {
      color: var(--editor-muted);
      opacity: 0.6;
    }

    &:focus-visible {
      outline: none;
    }
  }

  .text-field__input--multiline {
    min-block-size: 44px;
    max-block-size: 128px;
    resize: none;
    field-sizing: content;
  }

  .text-field__error {
    margin: 0;
    color: var(--editor-error);
    font-weight: 500;
    font-size: 12px;

    &:empty {
      display: none;
    }
  }

  .text-field__count {
    align-self: flex-end;
    color: var(--editor-muted);
    font-family: var(--editor-font);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
</style>
