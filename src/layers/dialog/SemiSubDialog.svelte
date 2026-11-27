<script lang="ts">
  import { DialogButtonVariant } from "./controls/dialog-button-variant";
  import DialogButton from "./controls/DialogButton.svelte";
  import DialogCloseButton from "./controls/DialogCloseButton.svelte";
  import { YOUTUBE_EDITOR_CONTROLS } from "#dialog/controls/editor/youtube-editor-controls";
  import ChannelIdentity from "#dialog/parts/ChannelIdentity.svelte";
  import DialogFooter from "#dialog/parts/DialogFooter.svelte";
  import DialogFrame from "#dialog/parts/DialogFrame.svelte";
  import DialogNotice from "#dialog/parts/DialogNotice.svelte";
  import { INACTIVE_NOTE, MODE_TEXT } from "#dialog/parts/mode-copy";
  import ModePicker from "#dialog/parts/ModePicker.svelte";
  import SemiSubSnackbar from "./SemiSubSnackbar.svelte";
  import type { ToastMessage } from "./toast-message";
  import { isAiModelReady } from "@/lib/ai/ai-status";
  import { isVideoFilterValid } from "@/lib/filter/schema/filter-validity";
  import { DEFAULT_TITLE_FILTER, type VideoFilter } from "@/lib/filter/schema/video-filter-schema";
  import { MessageType, sendMessage } from "@/lib/messaging/extension-messaging";
  import { focusPlayer } from "@/lib/page/focus-player";
  import type { ChannelInfo } from "@/lib/schemas/channel";
  import type { FeedVideo } from "@/lib/schemas/feed-video";
  import { getModeFilter, getSubscriptionMode, type SemiSubscription } from "@/lib/schemas/semi-subscription";
  import { SUBSCRIPTION_MODE_NAME, SubscriptionMode } from "@/lib/schemas/subscription-mode";
  import { readSemiSubscription, removeSemiSubscription, saveSemiSubscription } from "@/lib/semi-subscription-storage";
  import { isAiEnabledItem } from "@/lib/storage";
  import { getYouTubeSite, YouTubeSite } from "@/lib/youtube/site";
  import { DEFAULT_EDITOR_CONTROLS, FilterEditor } from "#filter-editor";
  import { onMount } from "svelte";

  interface Props {
    channel: ChannelInfo;
    /** Whether the user is subscribed, as the page that opened the dialog shows it - else the stored mode decides */
    isSubscribed: boolean | undefined;
    /** Called once the dialog and its confirmation are gone */
    onDone: () => void;
  }

  const { channel, isSubscribed, onDone }: Props = $props();

  /** www's own Polymer chip and checkbox; m.youtube.com has no Polymer, so it keeps the editor's plain ones */
  const editorControls = getYouTubeSite() === YouTubeSite.DESKTOP ? YOUTUBE_EDITOR_CONTROLS : DEFAULT_EDITOR_CONTROLS;

  const id = $props.id();
  const TITLE_ID = `${id}-title`;
  const DESCRIPTION_ID = `${id}-description`;

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

  async function loadVideos() {
    isLoadingVideos = true;
    isLoadFailed = false;
    try {
      videos = await sendMessage(MessageType.REFRESH_CHANNEL, { channelId: channel.channelId });
    } catch {
      isLoadFailed = true;
    } finally {
      isLoadingVideos = false;
    }
  }

  function closeWithToast(message: ToastMessage) {
    toastMessage = message;
    elDialog?.close();
  }

  onMount(() => {
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

<DialogFrame
  describedBy={DESCRIPTION_ID}
  labelledBy={TITLE_ID}
  onclose={() => {
    focusPlayer();

    if (!toastMessage) {
      onDone();
    }
  }}
  bind:elDialog>
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
      <h2 id={TITLE_ID} class="dialog__title">{SUBSCRIPTION_MODE_NAME[mode]}</h2>
      <DialogCloseButton onclick={() => elDialog?.close()} />
    </header>

    <div class="dialog__body">
      <ChannelIdentity {channel} />

      <ModePicker
        controls={editorControls}
        {mode}
        onPick={picked => {
          pickedMode = picked;
          isFilterEdited = false;
          const storedFilter = storedSubscription && getModeFilter({
            subscription: storedSubscription,
            mode: picked
          });
          filter = { ...(storedFilter ?? DEFAULT_TITLE_FILTER) };
        }} />

      <p id={DESCRIPTION_ID} class="dialog__description">
        {modeText.description}
        {#if !isModeActive}
          <span class="dialog__inactive">- {INACTIVE_NOTE[mode]}</span>
        {/if}
      </p>

      {#if isLoadFailed}
        <DialogNotice>
          <span>Couldn't load this channel's recent videos, so there's nothing to preview yet</span>
          <DialogButton label="Try again" onclick={() => loadVideos()} variant={DialogButtonVariant.TEXT} />
        </DialogNotice>
      {/if}

      {#if isSaveFailed}
        <DialogNotice>Couldn't save your change - try again</DialogNotice>
      {/if}

      <FilterEditor
        controls={editorControls}
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
            <DialogButton
              label="Turn on AI match"
              onclick={() => isAiEnabledItem.setValue(true)}
              variant={DialogButtonVariant.TONAL} />
          {:else}
            <DialogButton
              label="Set up AI match"
              onclick={() => sendMessage(MessageType.OPEN_AI_SETTINGS).catch(() => {})}
              variant={DialogButtonVariant.TONAL} />
          {/if}
        {/snippet}
      </FilterEditor>
    </div>

    <DialogFooter
      {canSave}
      {isEditing}
      {isSaving}
      onCancel={() => elDialog?.close()}
      onRemove={async () => {
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
      {submitLabel} />
  </form>
</DialogFrame>

{#if toastMessage}
  <SemiSubSnackbar message={toastMessage} {onDone} />
{/if}

<style>
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
</style>
