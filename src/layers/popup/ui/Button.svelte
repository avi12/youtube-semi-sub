<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    variant: "filled" | "tonal" | "text";
    size: "xs" | "s";
    /** Renders a label, for a checkbox child that toggles the button */
    isLabel?: boolean;
    disabled?: boolean;
    type?: "button" | "submit";
    onclick?: () => void;
    children: Snippet;
  }

  const { variant, size, isLabel = false, disabled = false, type = "button", onclick, children }: Props = $props();

  const classes = $derived(["button", `button--${variant}`, `button--${size}`, isLabel && "button--toggle"]);
</script>

{#if isLabel}
  <label class={classes}>{@render children()}</label>
{:else}
  <button class={classes} {disabled} {onclick} {type}>{@render children()}</button>
{/if}

<style>
  .button {
    --icon-size: 18px;
    --button-bg: transparent;
    --button-fg: var(--m3c-primary);

    position: relative;
    display: inline-flex;
    gap: 8px;
    justify-content: center;
    align-items: center;
    margin: 0;
    padding-inline: 24px;
    border: 0;
    border-radius: var(--m3-shape-full);
    background: var(--button-bg);
    color: var(--button-fg);
    font: 500 14px / 1 var(--m3-font);
    white-space: nowrap;
    cursor: pointer;
    user-select: none;

    @media (prefers-reduced-motion: no-preference) {
      transition: border-radius var(--m3-easing-spatial);
    }

    &::before {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: currentColor;
      opacity: 0;
      pointer-events: none;
    }

    &:has(> :global(:is(svg, output))) {
      padding-inline-start: 16px;
    }

    &:hover::before {
      opacity: 0.08;
    }

    &:active::before {
      opacity: 0.1;
    }

    &:active {
      border-radius: var(--m3-shape-small);
    }

    & > :global(input) {
      position: absolute;
      inset: 0;
      margin: 0;
      opacity: 0;
      cursor: inherit;
    }
  }

  .button--filled {
    --button-bg: var(--m3c-primary);
    --button-fg: var(--m3c-on-primary);
  }

  .button--tonal {
    --button-bg: var(--m3c-secondary-container);
    --button-fg: var(--m3c-on-secondary-container);
  }

  .button--toggle:has(> :global(input:checked)) {
    --button-bg: var(--m3c-primary);
    --button-fg: var(--m3c-on-primary);
  }

  .button--xs {
    block-size: 32px;
    padding-inline: 12px;

    &:has(> :global(:is(svg, output))) {
      padding-inline-start: 8px;
    }
  }

  .button--s {
    block-size: 40px;
  }

  .button:disabled {
    --button-bg: color-mix(in sRGB, var(--m3c-on-surface) 10%, transparent);
    --button-fg: color-mix(in sRGB, var(--m3c-on-surface) 38%, transparent);

    cursor: default;

    &::before {
      opacity: 0;
    }
  }

  .button:focus-visible,
  .button--toggle:has(> :global(input:focus-visible)) {
    outline: 3px solid var(--m3c-secondary);
    outline-offset: 2px;

    &::before {
      opacity: 0.1;
    }
  }
</style>
