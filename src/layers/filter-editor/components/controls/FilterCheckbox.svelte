<script lang="ts">
  import type { EditorCheckboxProps } from "#filter-editor/controls";

  const { label, hint, isChecked, onCheckedChange }: EditorCheckboxProps = $props();
</script>

<label class="checkbox">
  <input
    class="checkbox__input"
    checked={isChecked}
    onchange={e => onCheckedChange(e.currentTarget.checked)}
    type="checkbox" />
  <span class="checkbox__text">
    <span class="checkbox__label">{label}</span>
    <span class="checkbox__hint">{hint}</span>
  </span>
</label>

<style>
  .checkbox {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    cursor: pointer;
  }

  .checkbox__input {
    flex: none;
    block-size: 16px;
    inline-size: 16px;
    margin: 0;
    margin-block-start: 2px;
    accent-color: var(--editor-accent);
    cursor: inherit;
  }

  .checkbox__text {
    display: flex;
    flex-direction: column;
  }

  .checkbox__label {
    font-weight: 500;
  }

  .checkbox__hint {
    color: var(--editor-muted);
    font-size: 12px;
  }
</style>
