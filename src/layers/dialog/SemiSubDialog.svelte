<script lang="ts">
  import { isPageDarkTheme } from "./page-theme";
  import SemiSubSnackbar from "./SemiSubSnackbar.svelte";
  import { ToastMessage } from "./toast-message";
  import { isAiModelReady } from "@/lib/ai/ai-status";
  import { DEFAULT_TITLE_FILTER, isVideoFilterValid, type VideoFilter } from "@/lib/filter/title-filter";
  import { MessageType, sendMessage } from "@/lib/messaging/extension-messaging";
  import { focusPlayer } from "@/lib/page/focus-player";
  import { type ChannelInfo, getChannelInitial } from "@/lib/schemas/channel";
  import type { FeedVideo } from "@/lib/schemas/feed-video";
  import { getModeFilter, getSubscriptionMode, type SemiSubscription } from "@/lib/schemas/semi-subscription";
  import { SUBSCRIPTION_MODE_NAME, SubscriptionMode } from "@/lib/schemas/subscription-mode";
  import { readSemiSubscription, removeSemiSubscription, saveSemiSubscription } from "@/lib/semi-subscription-storage";
  import { isAiEnabledItem } from "@/lib/storage";
  import { FilterEditor } from "#filter-editor";
  import { onMount } from "svelte";

  interface Props {
    channel: ChannelInfo;
    /** Whether the user is subscribed, as the page that opened the dialog shows it - else the stored mode decides */
    isSubscribed: boolean | undefined;
    /** Called once the dialog and its confirmation are gone */
    onDone: () => void;
  }

  const { channel, isSubscribed, onDone }: Props = $props();

  const MODE_TEXT = {
    [SubscriptionMode.follow]: {
      description: "You're not subscribed, so only the videos your filter lets through are added to your feed",
      createLabel: "Semi-subscribe",
      createdMessage: ToastMessage.semiSubscribed,
      savedMessage: ToastMessage.filterSaved,
      removedMessage: ToastMessage.removed
    },
    [SubscriptionMode.hide]: {
      description: "You're subscribed, so the videos your filter matches are hidden from your feed",
      createLabel: "Save",
      createdMessage: ToastMessage.hideFilterSaved,
      savedMessage: ToastMessage.hideFilterSaved,
      removedMessage: ToastMessage.hideFilterRemoved
    }
  } as const;

  const MODE_LIST_NAME = {
    [SubscriptionMode.follow]: "Allow list",
    [SubscriptionMode.hide]: "Block list"
  } as const satisfies Record<SubscriptionMode, string>;
  /** What each list does to a video its filter matches - the one thing that tells them apart */
  const MODE_LIST_EFFECT = {
    [SubscriptionMode.follow]: "Only matching videos show",
    [SubscriptionMode.hide]: "Matching videos are hidden"
  } as const satisfies Record<SubscriptionMode, string>;

  const CLOSE_ICON_PATH = "m12.71 12 8.15 8.15-.71.71L12 12.71l-8.15 8.15-.71-.71L11.29 12 3.15 3.85l.71-.71L12 11.29l8.15-8.15.71.71L12.71 12z";

  const id = $props.id();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  const isDarkTheme = isPageDarkTheme();

  let elDialog = $state<HTMLDialogElement>();
  let filter = $state<VideoFilter>({ ...DEFAULT_TITLE_FILTER });
  let isMember = $state(false);
  /** Once the user has typed, the stored filter arriving late must not overwrite what they wrote */
  let isFilterEdited = false;
  let storedSubscription = $state<SemiSubscription | null>(null);
  let isStoredSubscriptionRead = $state(false);
  let videos = $state<FeedVideo[]>([]);
  let isLoadingVideos = $state(true);
  let isLoadFailed = $state(false);
  let isSaving = $state(false);
  let isSaveFailed = $state(false);
  let toastMessage = $state<ToastMessage | null>(null);

  const isFilterValid = $derived(isVideoFilterValid(filter));
  const isEditing = $derived(storedSubscription !== null);
  const canSave = $derived(isStoredSubscriptionRead && isFilterValid && !isSaving);
  /** What the page shows outranks what is stored, which follows it a moment later */
  const activeMode = $derived(
    getSubscriptionMode({
      isSubscribed: isSubscribed ?? storedSubscription?.isSubscribed ?? false
    })
  );
  let pickedMode = $state<SubscriptionMode | null>(null);
  const mode = $derived(pickedMode ?? activeMode);
  const isModeActive = $derived(mode === activeMode);
  const modeText = $derived(MODE_TEXT[mode]);
  const INACTIVE_NOTE = {
    [SubscriptionMode.follow]: "while you're subscribed it hides the videos it doesn't let through, and it adds the ones it does once you unsubscribe",
    [SubscriptionMode.hide]: "this filter applies once you subscribe"
  } as const satisfies Record<SubscriptionMode, string>;
  const submitLabel = $derived.by(() => {
    if (isEditing) {
      return "Save";
    }

    return modeText.createLabel;
  });
  const savedMessage = $derived.by(() => {
    if (isEditing) {
      return modeText.savedMessage;
    }

    return modeText.createdMessage;
  });
  const channelInitial = $derived(getChannelInitial(channel.title));

  async function loadVideos() {
    isLoadingVideos = true;
    isLoadFailed = false;
    try {
      videos = await sendMessage(MessageType.refreshChannel, { channelId: channel.channelId });
    } catch {
      isLoadFailed = true;
    } finally {
      isLoadingVideos = false;
    }
  }

  function pickMode(picked: SubscriptionMode) {
    pickedMode = picked;
    isFilterEdited = false;
    const storedFilter = storedSubscription && getModeFilter({
      subscription: storedSubscription,
      mode: picked
    });
    filter = { ...(storedFilter ?? DEFAULT_TITLE_FILTER) };
  }

  function closeWithToast(message: ToastMessage) {
    toastMessage = message;
    elDialog?.close();
  }

  onMount(() => {
    elDialog?.showModal();
    elDialog?.querySelector<HTMLElement>("[data-filter-input]")?.focus();
    loadVideos().catch(() => {});
    readSemiSubscription(channel.channelId).then(stored => {
      storedSubscription = stored;
      isMember = stored?.isMember ?? false;

      const storedFilter = stored && getModeFilter({
        subscription: stored,
        mode
      });
      if (storedFilter && !isFilterEdited) {
        filter = { ...storedFilter };
      }
    }).catch(() => {}).finally(() => {
      isStoredSubscriptionRead = true;
    });
  });
</script>

<dialog
  bind:this={elDialog}
  class="dialog"
  aria-describedby={descriptionId}
  aria-labelledby={titleId}
  closedby="any"
  data-theme={isDarkTheme ? "dark" : "light"}
  onclose={() => {
    focusPlayer();

    if (!toastMessage) {
      onDone();
    }
  }}>
  <form
    class="dialog__form"
    onsubmit={async e => {
      e.preventDefault();

      if (!canSave) {
        return;
      }

      isSaving = true;
      isSaveFailed = false;
      try {
        await saveSemiSubscription({
          channel: $state.snapshot(channel),
          mode,
          filter: $state.snapshot(filter),
          isMember
        });
        closeWithToast(savedMessage);
      } catch {
        isSaveFailed = true;
      } finally {
        isSaving = false;
      }
    }}>
    <header class="dialog__header">
      <h2 id={titleId} class="dialog__title">{SUBSCRIPTION_MODE_NAME[mode]}</h2>
      <button
        class="icon-button"
        aria-label="Close"
        onclick={() => elDialog?.close()}
        type="button">
        <svg class="icon-button__icon" aria-hidden="true" viewBox="0 0 24 24">
          <path d={CLOSE_ICON_PATH} />
        </svg>
      </button>
    </header>

    <div class="dialog__body">
      <section class="channel" aria-label="Channel">
        {#if channel.avatarUrl}
          <img class="channel__avatar" alt="" src={channel.avatarUrl} />
        {:else}
          <span class="channel__avatar channel__avatar--initial" aria-hidden="true">{channelInitial}</span>
        {/if}
        <span class="channel__text">
          <span class="channel__title" dir="auto">{channel.title}</span>
          {#if channel.handle}
            <span class="channel__handle" dir="auto">{channel.handle}</span>
          {/if}
        </span>
      </section>

      <fieldset class="modes">
        <legend class="modes__legend">List type</legend>
        {#each Object.values(SubscriptionMode) as option (option)}
          <label class="modes__option">
            <input
              name="{id}-mode"
              class="modes__input"
              checked={mode === option}
              onchange={() => pickMode(option)}
              type="radio"
              value={option} />
            <span class="modes__text">
              <span class="modes__label">{MODE_LIST_NAME[option]}</span>
              <span class="modes__effect">{MODE_LIST_EFFECT[option]}</span>
            </span>
          </label>
        {/each}
      </fieldset>

      <p id={descriptionId} class="dialog__description">
        {modeText.description}
        {#if !isModeActive}
          <span class="dialog__inactive">- {INACTIVE_NOTE[mode]}</span>
        {/if}
      </p>

      {#if isLoadFailed}
        <p class="notice" role="alert">
          <span>Couldn't load this channel's recent videos, so there's nothing to preview yet</span>
          <button class="button button--text" onclick={() => loadVideos()} type="button">Try again</button>
        </p>
      {/if}

      {#if isSaveFailed}
        <p class="notice" role="alert">Couldn't save your change - try again</p>
      {/if}

      <FilterEditor
        isLoading={isLoadingVideos}
        {mode}
        {videos}
        bind:isMember
        bind:filter={() => filter, editedFilter => {
          filter = editedFilter;
          isFilterEdited = true;
        }}>
        {#snippet aiSetup({ isAiEnabled, aiStatus })}
          <!-- With the model on disk, one click here; a download goes through the popup, which explains its size -->
          {#if isAiModelReady(aiStatus) && !isAiEnabled}
            <button class="button button--tonal" onclick={() => isAiEnabledItem.setValue(true)} type="button">
              Turn on AI match
            </button>
          {:else}
            <button
              class="button button--tonal"
              onclick={() => sendMessage(MessageType.openAiSettings).catch(() => {})}
              type="button">
              Set up AI match
            </button>
          {/if}
        {/snippet}
      </FilterEditor>
    </div>

    <footer class="dialog__footer">
      {#if isEditing}
        <button
          class="button button--danger"
          disabled={isSaving}
          onclick={async () => {
            if (isSaving) {
              return;
            }

            isSaving = true;
            isSaveFailed = false;
            try {
              await removeSemiSubscription(channel.channelId);
              closeWithToast(modeText.removedMessage);
            } catch {
              isSaveFailed = true;
            } finally {
              isSaving = false;
            }
          }}
          type="button">
          Remove
        </button>
      {/if}
      <span class="dialog__footer-spacer"></span>
      <button class="button button--text" onclick={() => elDialog?.close()} type="button">Cancel</button>
      <button class="button button--filled" disabled={!canSave} type="submit">{submitLabel}</button>
    </footer>
  </form>
</dialog>

{#if toastMessage}
  <SemiSubSnackbar message={toastMessage} {onDone} />
{/if}

<style>
  .dialog {
    --fallback-surface: #ffffff;
    --fallback-text: #0f0f0f;
    --fallback-text-secondary: #606060;
    --fallback-accent: #065fd4;
    --fallback-error: #c30027;
    --fallback-outline: rgb(0 0 0 / 10%);
    --fallback-additive: rgb(0 0 0 / 5%);
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
    box-shadow: 0 4px 32px rgb(0 0 0 / 10%);

    @media (prefers-reduced-motion: no-preference) {
      @starting-style {
        opacity: 0%;
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
        opacity: 100%;
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
      --fallback-outline: rgb(255 255 255 / 20%);
      --fallback-additive: rgb(255 255 255 / 10%);

      color-scheme: dark;
    }

    &::backdrop {
      background: var(--yt-sys-color-baseline--overlay-background-medium, rgb(0 0 0 / 60%));
    }
  }

  .dialog__form {
    display: flex;
    flex-direction: column;
    max-block-size: inherit;
  }

  .dialog__header {
    display: flex;
    gap: 8px;
    justify-content: space-between;
    align-items: center;
    padding-block: 16px 4px;
    padding-inline: 24px 12px;
  }

  .dialog__title {
    margin: 0;
    font-weight: 700;
    font-size: 20px;
    line-height: 28px;
  }

  .dialog__body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
    overscroll-behavior: contain;
    min-block-size: 0;
    padding-block: 8px 16px;
    padding-inline: 24px;
  }

  .dialog__description {
    margin: 0;
    color: var(--text-secondary);
  }

  .dialog__inactive {
    color: var(--text);
  }

  .modes {
    display: flex;
    gap: 8px;
    margin: 0;
    padding: 0;
    border: 0;
  }

  .modes__legend {
    margin-block-end: 8px;
    padding: 0;
    color: var(--text-secondary);
    font-size: 12px;
  }

  .modes__option {
    display: flex;
    flex: 1;
    gap: 8px;
    align-items: center;
    padding-block: 8px;
    padding-inline: 12px;
    border: 1px solid var(--outline);
    border-radius: 12px;
    cursor: pointer;

    &:has(:checked) {
      border-color: var(--accent);
      background: var(--additive);
    }

    &:has(:focus-visible) {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
  }

  .modes__input {
    accent-color: var(--accent);
  }

  .modes__text {
    display: flex;
    flex-direction: column;
  }

  .modes__label {
    font-weight: 500;
  }

  .modes__effect {
    color: var(--text-secondary);
    font-size: 12px;
  }

  .dialog__footer {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    padding-block: 12px 16px;
    padding-inline: 24px;
    border-block-start: 1px solid var(--outline);
  }

  .dialog__footer-spacer {
    flex: 1;
  }

  .channel {
    display: flex;
    gap: 12px;
    align-items: center;
    min-inline-size: 0;
  }

  .channel__avatar {
    flex: none;
    object-fit: cover;
    block-size: 48px;
    inline-size: 48px;
    border-radius: 50%;
    background: var(--additive);
  }

  .channel__avatar--initial {
    display: grid;
    place-items: center;
    color: var(--text-secondary);
    font-weight: 500;
    font-size: 20px;
  }

  .channel__text {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
  }

  .channel__title,
  .channel__handle {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .channel__title {
    font-weight: 500;
    font-size: 16px;
  }

  .channel__handle {
    color: var(--text-secondary);
    font-size: 12px;
  }

  .notice {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: space-between;
    align-items: center;
    margin: 0;
    padding-block: 8px;
    padding-inline: 16px 8px;
    border-radius: 12px;
    background: var(--additive);
  }

  .button,
  .icon-button {
    border: 0;
    color: var(--text);
    font: inherit;
    cursor: pointer;

    @media (prefers-reduced-motion: no-preference) {
      transition: background-color 120ms var(--ease);
    }

    &:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    &:disabled {
      opacity: 40%;
      cursor: default;
    }
  }

  .button {
    min-block-size: 36px;
    padding-inline: 16px;
    border-radius: 18px;
    font-weight: 500;
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

  .icon-button {
    display: grid;
    place-items: center;
    block-size: 40px;
    inline-size: 40px;
    padding: 0;
    border-radius: 50%;
    background: transparent;

    &:hover {
      background: var(--additive);
    }
  }

  .icon-button__icon {
    block-size: 24px;
    inline-size: 24px;
    fill: currentColor;
  }
</style>
