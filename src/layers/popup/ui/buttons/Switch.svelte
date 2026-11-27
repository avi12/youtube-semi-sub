<script lang="ts">
  import { CHECK_ICON } from "#popup/icons";
  import Icon from "#popup/ui/Icon.svelte";

  interface Props {
    checked: boolean;
    disabled?: boolean;
  }

  let { checked = $bindable(), disabled = false }: Props = $props();
</script>

<span class="switch">
  <input {disabled} role="switch" type="checkbox" bind:checked />
  <span class="track" aria-hidden="true">
    <span class="thumb"><Icon path={CHECK_ICON} /></span>
  </span>
</span>

<style>
  .switch {
    --icon-size: 16px;

    position: relative;
    display: inline-grid;
    flex: none;

    & > input {
      position: absolute;
      inset: 0;
      z-index: 1;
      margin: 0;
      opacity: 0;
      cursor: pointer;
    }
  }

  .track {
    position: relative;
    display: block;
    block-size: 32px;
    inline-size: 52px;
    border: 2px solid var(--m3c-outline);
    border-radius: var(--m3-shape-full);
    background: var(--m3c-surface-container-highest);
  }

  .thumb {
    position: absolute;
    inset-block-start: 2px;
    inset-inline-start: 2px;
    display: grid;
    place-items: center;
    block-size: 24px;
    inline-size: 24px;
    border-radius: var(--m3-shape-full);
    background: var(--m3c-outline);
    color: var(--m3c-on-primary-container);
    scale: 0.667;

    & > :global(svg) {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .track {
      transition:
        background-color var(--m3-easing),
        border-color var(--m3-easing);
    }

    .thumb {
      transition:
        translate var(--m3-easing-spatial),
        scale var(--m3-easing-spatial),
        background-color var(--m3-easing);

      & > :global(svg) {
        transition: opacity var(--m3-easing);
      }
    }
  }

  input:checked + .track {
    border-color: var(--m3c-primary);
    background: var(--m3c-primary);

    & > .thumb {
      background: var(--m3c-on-primary);
      color: var(--m3c-primary);
      scale: 1;
      translate: 20px 0;

      &:dir(rtl) {
        translate: -20px 0;
      }

      & > :global(svg) {
        opacity: 1;
      }
    }
  }

  input:active:not(:disabled) + .track > .thumb {
    scale: 1.167;
  }

  input:focus-visible + .track {
    outline: 3px solid var(--m3c-secondary);
    outline-offset: 2px;
  }

  input:disabled + .track {
    opacity: 0.38;
  }

  input:disabled {
    cursor: default;
  }
</style>
