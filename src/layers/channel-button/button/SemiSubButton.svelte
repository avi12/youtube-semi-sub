<script lang="ts">
  import { describeChannelButton } from "./button-label";
  import { type CollaboratorChoice, openCollaboratorsPopup } from "./collaborators-popup";
  import type { NativeButtonClasses } from "./native-button-classes";
  import { PageMessage, pageMessenger } from "@/lib/messaging/page-messaging";
  import { getPageState, onPageState } from "@/lib/page/page-state";
  import type { ChannelInfo } from "@/lib/schemas/channel";
  import { getSubscriptionMode } from "@/lib/schemas/semi-subscription";
  import {
    ButtonViewModelIcon,
    ButtonViewModelSize,
    ButtonViewModelState,
    ButtonViewModelStyle,
    ButtonViewModelType
  } from "@/lib/youtube/page/button-view-model";
  import { YouTubeSite } from "@/lib/youtube/site";
  import { getObservedOfficialSubscription } from "#channel-button/official-subscription";
  import { BUTTON_ROOT_ATTRIBUTE, type ButtonPlacement } from "#channel-button/page/page-anchor";

  interface Props {
    channel: ChannelInfo;
    /** The channels of a collaboration: the button then opens their picker instead of one channel's dialog */
    collaborators: (ChannelInfo & { isSubscribed?: boolean })[];
    site: YouTubeSite;
    placement: ButtonPlacement;
    /** Copied from the native action this button sits next to, so YouTube's own spacing applies */
    wrapperClass: string;
    /** www Polymer scoping classes of the native Subscribe button */
    scopingClass: string;
    /** m.youtube.com: the native Subscribe button's classes, restyled as tonal */
    nativeButtonClasses: NativeButtonClasses;
    isOfficiallySubscribed: boolean;
  }

  const {
    channel,
    collaborators,
    site,
    placement,
    wrapperClass,
    scopingClass,
    nativeButtonClasses,
    isOfficiallySubscribed
  }: Props = $props();

  // YouTube's own FILTER icon, so both sites show the same glyph
  const FILTER_ICON_PATH = "M21 5H3a1 1 0 000 2h18a1 1 0 100-2Zm-3 6H6a1 1 0 000 2h12a1 1 0 000-2Zm-3 6H9a1 1 0 000 2h6a1 1 0 000-2Z";
  const ROOT_ATTRIBUTES = { [BUTTON_ROOT_ATTRIBUTE]: "" };

  let pageState = $state(getPageState());
  let elRoot = $state<HTMLElement>();
  let elButtonViewModel = $state<HTMLElementTagNameMap["yt-button-view-model"]>();

  $effect(() => onPageState(state => {
    pageState = state;
  }));

  /** The channel's mode as the page shows it: the Subscribe button outranks the stored state, which follows it */
  const mode = $derived(getSubscriptionMode({ isSubscribed: isOfficiallySubscribed }));
  const isCollaboration = $derived(collaborators.length > 0);
  const description = $derived(
    describeChannelButton({
      channelTitle: channel.title,
      subscription: pageState?.subscriptions[channel.channelId],
      mode
    })
  );
  const isActive = $derived(description.isActive && !isCollaboration);
  const label = $derived(description.label);
  const accessibilityText = $derived.by(() => {
    if (isCollaboration) {
      return "Semi-subscribe to the channels of this video";
    }

    return description.accessibilityText;
  });
  const isVisible = $derived(!!pageState?.isExtensionEnabled);
  const nativeButtonClass = $derived.by(() => {
    if (isActive) {
      return nativeButtonClasses.buttonWithIcon;
    }

    return nativeButtonClasses.button;
  });
  const iconName = $derived.by(() => {
    if (isActive) {
      return ButtonViewModelIcon.filter;
    }

    return ButtonViewModelIcon.none;
  });

  // The Polymer element renders from `.data`, which only exists in the page realm
  $effect(() => {
    if (!elButtonViewModel) {
      return;
    }

    elButtonViewModel.data = {
      title: label,
      iconName,
      accessibilityText,
      style: ButtonViewModelStyle.mono,
      type: ButtonViewModelType.tonal,
      buttonSize: ButtonViewModelSize.default,
      state: ButtonViewModelState.active,
      isFullWidth: false
    };
  });

  export function isConnected() {
    return elRoot?.isConnected ?? false;
  }

  function describeCollaborator(collaborator: (typeof collaborators)[number]): CollaboratorChoice {
    const isSubscribed = getObservedOfficialSubscription(collaborator.channelId) ?? collaborator.isSubscribed;
    const { isActive: isCollaboratorActive, ...words } = describeChannelButton({
      channelTitle: collaborator.title,
      subscription: pageState?.subscriptions[collaborator.channelId],
      mode: getSubscriptionMode({ isSubscribed: isSubscribed ?? false })
    });
    return {
      ...collaborator,
      isSubscribed,
      ...words,
      isActive: isCollaboratorActive
    };
  }

  function openDialog() {
    const isPickerOpen = isCollaboration
      && openCollaboratorsPopup($state.snapshot(collaborators).map(describeCollaborator));
    if (isPickerOpen) {
      return;
    }

    pageMessenger.sendMessage(PageMessage.openSemiSubDialog, {
      ...$state.snapshot(channel),
      isSubscribed: isOfficiallySubscribed
    }).catch(() => {});
  }
</script>

<div
  bind:this={elRoot}
  {...ROOT_ATTRIBUTES}
  class={[wrapperClass, "yss-channel-button"]}
  data-placement={placement}
  hidden={!isVisible}>
  {#if site === YouTubeSite.desktop}
    <!-- The Polymer element renders the real <button> inside; its clicks bubble up here -->
    <yt-button-view-model
      bind:this={elButtonViewModel}
      class={scopingClass}
      onclick={openDialog}
      role="none"></yt-button-view-model>
  {:else}
    <button-view-model class={nativeButtonClasses.host}>
      <button
        class={nativeButtonClass}
        aria-label={accessibilityText}
        onclick={openDialog}
        type="button">
        {#if isActive}
          <div class={[nativeButtonClasses.icon, "yss-channel-button__icon"]} aria-hidden="true">
            <svg focusable="false" viewBox="0 0 24 24">
              <path d={FILTER_ICON_PATH} />
            </svg>
          </div>
        {/if}
        <div class={nativeButtonClasses.text}>{label}</div>
      </button>
    </button-view-model>
  {/if}
</div>
