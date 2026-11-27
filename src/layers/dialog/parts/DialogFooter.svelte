<script lang="ts">
  import { DialogButtonVariant } from "#dialog/controls/dialog-button-variant";
  import DialogButton from "#dialog/controls/DialogButton.svelte";

  interface Props {
    isEditing: boolean;
    isSaving: boolean;
    canSave: boolean;
    submitLabel: string;
    onRemove: () => void;
    onCancel: () => void;
  }

  const { isEditing, isSaving, canSave, submitLabel, onRemove, onCancel }: Props = $props();
</script>

<footer class="footer">
  {#if isEditing}
    <DialogButton isDisabled={isSaving} label="Remove" onclick={onRemove} variant={DialogButtonVariant.DANGER} />
  {/if}
  <span class="footer__spacer"></span>
  <DialogButton label="Cancel" onclick={onCancel} variant={DialogButtonVariant.TEXT} />
  <DialogButton isDisabled={!canSave} isSubmit label={submitLabel} variant={DialogButtonVariant.FILLED} />
</footer>

<style>
  .footer {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    padding-block: 12px 16px;
    padding-inline: 24px;
    border-block-start: 1px solid var(--outline);
  }

  .footer__spacer {
    flex: 1;
  }
</style>
