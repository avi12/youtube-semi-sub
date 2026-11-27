<script lang="ts">
  import { isPageDarkTheme } from "#dialog/page-theme";
  import { FOCUSED_ON_OPEN_SELECTOR } from "#filter-editor";
  import { onMount, type Snippet } from "svelte";

  interface Props {
    labelledBy: string;
    describedBy: string;
    elDialog?: HTMLDialogElement;
    onclose: () => void;
    children: Snippet;
  }

  let { labelledBy, describedBy, elDialog = $bindable(), onclose, children }: Props = $props();

  const isDarkTheme = isPageDarkTheme();

  onMount(() => {
    elDialog?.showModal();
    elDialog?.querySelector<HTMLElement>(FOCUSED_ON_OPEN_SELECTOR)?.focus();
  });
</script>

<dialog
  bind:this={elDialog}
  class="dialog"
  aria-describedby={describedBy}
  aria-labelledby={labelledBy}
  closedby="any"
  data-theme={isDarkTheme ? "dark" : "light"}
  {onclose}
  onkeydown={e => e.stopPropagation()}
  onkeypress={e => e.stopPropagation()}
  onkeyup={e => e.stopPropagation()}>
  {@render children()}
</dialog>

<style>
  .dialog {
    --fallback-surface: #ffffff;
    --fallback-text: #0f0f0f;
    --fallback-text-secondary: #606060;
    --fallback-accent: #065fd4;
    --fallback-error: #c30027;
    --fallback-outline: rgb(0 0 0 / 0.1);
    --fallback-additive: rgb(0 0 0 / 0.05);
    --surface:
      var(
        --yt-sys-color-baseline--raised-background,
        var(--yt-spec-raised-background, var(--fallback-surface))
      );
    --text: var(--yt-sys-color-baseline--text-primary, var(--yt-spec-text-primary, var(--fallback-text)));
    --text-secondary:
      var(
        --yt-sys-color-baseline--text-secondary,
        var(--yt-spec-text-secondary, var(--fallback-text-secondary))
      );
    --accent: var(--yt-sys-color-baseline--call-to-action, var(--yt-spec-call-to-action, var(--fallback-accent)));
    --error: var(--yt-sys-color-baseline--error-indicator, var(--yt-spec-error-indicator, var(--fallback-error)));
    --outline: var(--yt-sys-color-baseline--outline, var(--yt-spec-10-percent-layer, var(--fallback-outline)));
    --additive:
      var(
        --yt-sys-color-baseline--additive-background,
        var(--yt-spec-badge-chip-background, var(--fallback-additive))
      );
    --font: "Roboto", "Arial", sans-serif;
    --ease: cubic-bezier(0.2, 0, 0, 1);
    --filter-editor-fg: var(--text);
    --filter-editor-muted: var(--text-secondary);
    --filter-editor-accent: var(--accent);
    --filter-editor-error: var(--error);
    --filter-editor-surface: var(--surface);
    --filter-editor-border: var(--outline);
    --filter-editor-font: var(--font);

    /* Sized so the preview scrolls on its own while the filter above it stays in view */
    --filter-editor-preview-max-block-size: clamp(180px, 100dvh - 540px, 520px);

    overflow: hidden;
    max-block-size: calc(100dvh - 32px);
    inline-size: min(600px, 100vw - 32px);
    padding: 0;
    border: 0;
    border-radius: 12px;
    background: var(--surface);
    color: var(--text);
    color-scheme: light;
    font-family: var(--font);
    font-size: 14px;
    line-height: 1.4;
    box-shadow: 0 4px 32px rgb(0 0 0 / 0.1);

    @media (prefers-reduced-motion: no-preference) {
      @starting-style {
        opacity: 0;
        scale: 0.96;
      }

      transition:
        opacity 200ms var(--ease),
        scale 200ms var(--ease),
        translate 250ms var(--ease);
    }

    @media (width <= 600px) {
      /* One scroller on phones: the whole sheet, not a box inside it */
      --filter-editor-preview-max-block-size: none;

      max-block-size: calc(100dvh - 48px);
      inline-size: 100vw;
      max-inline-size: 100vw;
      margin-block-end: 0;
      border-end-start-radius: 0;
      border-end-end-radius: 0;
    }

    /* A bottom sheet on phone widths, like m.youtube.com's own */
    @media (width <= 600px) and (prefers-reduced-motion: no-preference) {
      @starting-style {
        opacity: 1;
        scale: 1;
        translate: 0 100%;
      }
    }

    &[data-theme="dark"] {
      --fallback-surface: #212121;
      --fallback-text: #f1f1f1;
      --fallback-text-secondary: #aaaaaa;
      --fallback-accent: #3ea6ff;
      --fallback-error: #ff8b8b;
      --fallback-outline: rgb(255 255 255 / 0.2);
      --fallback-additive: rgb(255 255 255 / 0.1);

      color-scheme: dark;
    }

    &::backdrop {
      background: var(--yt-sys-color-baseline--overlay-background-medium, rgb(0 0 0 / 0.6));
    }
  }
</style>
