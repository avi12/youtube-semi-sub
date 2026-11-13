<script lang="ts">
  import YtButton from "./YtButton.svelte";
  import { ButtonViewModelIcon, ButtonViewModelType } from "@/lib/youtube/page/button-view-model";
  import { getYouTubeSite, YouTubeSite } from "@/lib/youtube/site";

  // www's dialogs close with YouTube's own icon button; m.youtube.com has no Polymer, so it keeps a plain one

  interface Props {
    onclick: () => void;
  }

  const { onclick }: Props = $props();

  const LABEL = "Close";
  const CLOSE_ICON_PATH = "m12.71 12 8.15 8.15-.71.71L12 12.71l-8.15 8.15-.71-.71L11.29 12 3.15 3.85l.71-.71L12 11.29l8.15-8.15.71.71L12.71 12z";

  const isDesktop = getYouTubeSite() === YouTubeSite.DESKTOP;
</script>

{#if isDesktop}
  <YtButton icon={ButtonViewModelIcon.CLOSE} isIconOnly label={LABEL} {onclick} type={ButtonViewModelType.TEXT} />
{:else}
  <button class="icon-button" aria-label={LABEL} {onclick} type="button">
    <svg class="icon-button__icon" aria-hidden="true" viewBox="0 0 24 24">
      <path d={CLOSE_ICON_PATH} />
    </svg>
  </button>
{/if}

<style>
  .icon-button {
    display: grid;
    place-items: center;
    block-size: 40px;
    inline-size: 40px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--text);
    font: inherit;
    cursor: pointer;

    @media (prefers-reduced-motion: no-preference) {
      transition: background-color 120ms var(--ease);
    }

    &:hover {
      background: var(--additive);
    }

    &:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
  }

  .icon-button__icon {
    block-size: 24px;
    inline-size: 24px;
    fill: currentColor;
  }
</style>
