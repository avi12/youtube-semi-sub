<script lang="ts">
  import { polymerHostAttributes } from "@/lib/youtube/page/elements/polymer-host";
  import type { EditorCheckboxProps } from "#filter-editor";

  // www's own Polymer checkbox, `tp-yt-paper-checkbox`, driven by its `checked` attribute. A press anywhere on the row
  // flips the state this component holds - the box flips itself to the same value, so the two never disagree

  const { label, hint, isChecked, onCheckedChange }: EditorCheckboxProps = $props();

  const CHECKBOX_TAG = "tp-yt-paper-checkbox";
</script>

<span class="checkbox" onclick={() => onCheckedChange(!isChecked)} role="none">
  <span
    {...polymerHostAttributes({
      tag: CHECKBOX_TAG,
      attributes: {
        checked: isChecked,
        "aria-label": label
      }
    })}
    class="checkbox__box"></span>
  <span class="checkbox__text">
    <span class="checkbox__label">{label}</span>
    <span class="checkbox__hint">{hint}</span>
  </span>
</span>

<style>
  .checkbox {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    cursor: pointer;
  }

  .checkbox__box {
    display: contents;
  }

  .checkbox__text {
    display: flex;
    flex-direction: column;
  }

  .checkbox__label {
    font-weight: 500;
  }

  .checkbox__hint {
    color: var(--yt-sys-color-baseline--text-secondary, var(--yt-spec-text-secondary, #606060));
    font-size: 12px;
  }
</style>
