<script lang="ts">
  import { isInputElement } from "@/lib/dom-guards";
  import { polymerHostAttributes } from "@/lib/youtube/page/elements/polymer-host";
  import { type EditorTextFieldProps, FOCUSED_ON_OPEN_ATTRIBUTE } from "#filter-editor";

  // www's own Polymer text field, `tp-yt-paper-input`, driven by its attributes: it floats the label, underlines the
  // text and shows the error and the character count itself. Its native <input> sits in the page's light DOM, so its
  // input events bubble to this host. It has one line - www has no Polymer textarea to rely on

  const {
    label,
    value,
    placeholder,
    error = null,
    maxLength,
    isCode = false,
    isFocusedOnOpen = false,
    prefix,
    suffix,
    onValueChange
  }: EditorTextFieldProps = $props();

  const INPUT_TAG = "tp-yt-paper-input";
</script>

<span class={["text-field", isCode && "text-field--code", error !== null && "text-field--invalid"]}>
  {#if prefix}
    <span class="text-field__affix">{@render prefix()}</span>
  {/if}
  <span
    {...polymerHostAttributes({
      tag: INPUT_TAG,
      attributes: {
        label,
        value,
        placeholder,
        autocomplete: "off",
        autocapitalize: isCode ? "none" : false,
        spellcheck: isCode ? "false" : false,
        dir: isCode ? "ltr" : "auto",
        invalid: error !== null,
        "error-message": error ?? false,
        maxlength: maxLength === undefined ? false : String(maxLength),
        "char-counter": maxLength !== undefined,
        [FOCUSED_ON_OPEN_ATTRIBUTE]: isFocusedOnOpen
      }
    })}
    class="text-field__input"
    oninput={e => {
      if (isInputElement(e.target)) {
        onValueChange(e.target.value);
      }
    }}></span>
  {#if suffix}
    <span class="text-field__affix">{@render suffix()}</span>
  {/if}
</span>

<style>
  .text-field {
    --paper-input-container-focus-color: var(--accent);
    --paper-input-container-invalid-color: var(--error);
    --paper-input-container-color: var(--text-secondary);
    --paper-input-container-input-color: var(--text);

    display: flex;
    gap: 4px;
    align-items: flex-start;
    font-size: 15px;
  }

  /* The error hangs below the underline, outside the element's box */
  .text-field--invalid {
    padding-block-end: 16px;
  }

  .text-field__input {
    display: contents;

    & > :global(tp-yt-paper-input) {
      flex: 1;
      min-inline-size: 0;
    }

    & :global(input) {
      color: var(--text);
      caret-color: var(--text);
    }
  }

  /* Sits on the text's line, below the floating label, whether or not an error shows under it */
  .text-field__affix {
    display: flex;
    padding-block-start: 30px;
  }

  .text-field--code {
    font-family: var(--editor-mono);
  }
</style>
