<script lang="ts">
  import { DialogButtonVariant } from "./dialog-button-variant";
  import YtButton from "./YtButton.svelte";
  import { ButtonViewModelType } from "@/lib/youtube/page/button-view-model";
  import { getYouTubeSite, YouTubeSite } from "@/lib/youtube/site";

  // www's dialogs use YouTube's own Polymer button; m.youtube.com has no Polymer, so it keeps a plain one styled with
  // m's tokens

  interface Props {
    label: string;
    variant: DialogButtonVariant;
    isDisabled?: boolean;
    isSubmit?: boolean;
    onclick?: () => void;
  }

  const { label, variant, isDisabled = false, isSubmit = false, onclick }: Props = $props();

  /** YouTube has no destructive button - a removal reads as a plain text action, as in its own dialogs */
  const BUTTON_TYPE_BY_VARIANT = {
    [DialogButtonVariant.FILLED]: ButtonViewModelType.FILLED,
    [DialogButtonVariant.TONAL]: ButtonViewModelType.TONAL,
    [DialogButtonVariant.TEXT]: ButtonViewModelType.TEXT,
    [DialogButtonVariant.DANGER]: ButtonViewModelType.TEXT
  } as const satisfies Record<DialogButtonVariant, ButtonViewModelType>;

  const IS_DESKTOP = getYouTubeSite() === YouTubeSite.DESKTOP;
</script>

{#if IS_DESKTOP}
  <YtButton {isDisabled} {isSubmit} {label} {onclick} type={BUTTON_TYPE_BY_VARIANT[variant]} />
{:else}
  <button
    class={["button", `button--${variant}`]}
    disabled={isDisabled}
    onclick={() => {
      if (!isDisabled) {
        onclick?.();
      }
    }}
    type={isSubmit ? "submit" : "button"}>
    {label}
  </button>
{/if}

<style>
  .button {
    min-block-size: 36px;
    padding-inline: 16px;
    border: 0;
    border-radius: 18px;
    color: var(--text);
    font: inherit;
    font-weight: 500;
    cursor: pointer;

    @media (prefers-reduced-motion: no-preference) {
      transition: background-color 120ms var(--ease);
    }

    &:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    &:disabled {
      opacity: 0.4;
      cursor: default;
    }
  }

  .button--text,
  .button--danger {
    background: transparent;

    &:hover:not(:disabled) {
      background: var(--additive);
    }
  }

  .button--danger {
    color: var(--error);
  }

  .button--tonal {
    background: var(--additive);

    &:hover:not(:disabled) {
      background: var(--yt-sys-color-baseline--button-chip-background-hover, var(--outline));
    }
  }

  .button--filled {
    background: var(--text);
    color: var(--surface);

    &:hover:not(:disabled) {
      background: var(--yt-sys-color-baseline--mono-filled-hover, color-mix(in sRGB, var(--text) 85%, var(--surface)));
    }
  }
</style>
