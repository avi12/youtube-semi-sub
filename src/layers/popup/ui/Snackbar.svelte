<script lang="ts">
  import { CLOSE_ICON } from "#popup/icons";
  import Icon from "#popup/ui/Icon.svelte";
  import { dismissSnackbar, getSnackbar } from "#popup/ui/snackbar-state.svelte";

  const request = $derived(getSnackbar());
</script>

{#if request}
  <output style:--snackbar-timeout="{request.timeoutMs}ms" class="snackbar" onanimationend={dismissSnackbar}>
    <span class="snackbar__message">{request.message}</span>
    <button
      class="snackbar__action"
      onclick={() => {
        request.onAction();
        dismissSnackbar();
      }}
      type="button">
      {request.actionLabel}
    </button>
    <button class="snackbar__close" aria-label="Close" onclick={dismissSnackbar} type="button">
      <Icon path={CLOSE_ICON} />
    </button>
  </output>
{/if}

<style>
  .snackbar {
    position: fixed;
    inset-inline: 12px;
    inset-block-end: 16px;
    z-index: 1;
    display: flex;
    gap: 4px;
    align-items: center;
    min-block-size: 48px;
    max-inline-size: 560px;
    margin-inline: auto;
    padding-inline: 16px 4px;
    border-radius: var(--m3-shape-extra-small);
    background: var(--m3c-inverse-surface);
    color: var(--m3c-inverse-on-surface);
    font-size: 14px;

    /* Moves nothing: it only counts down the timeout, and its end dismisses the snackbar */
    animation: snackbar-timeout var(--snackbar-timeout) linear;

    @media (prefers-reduced-motion: no-preference) {
      @starting-style {
        opacity: 0;
        translate: 0 12px;
      }

      transition:
        opacity var(--m3-easing),
        translate var(--m3-easing-spatial);
    }
  }

  @keyframes snackbar-timeout {
    from,
    to {
      opacity: 1;
    }
  }

  .snackbar__message {
    flex: 1;
    padding-block: 12px;
  }

  .snackbar__action,
  .snackbar__close {
    display: grid;
    place-items: center;
    min-block-size: 40px;
    padding-inline: 12px;
    border: 0;
    border-radius: var(--m3-shape-full);
    background: transparent;
    color: var(--m3c-inverse-primary);
    font: 500 14px / 1 var(--m3-font);
    cursor: pointer;

    &:hover {
      background: color-mix(in sRGB, currentColor 8%, transparent);
    }

    &:focus-visible {
      outline: 2px solid currentColor;
    }
  }

  .snackbar__close {
    color: var(--m3c-inverse-on-surface);
  }
</style>
