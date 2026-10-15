<script lang="ts">
  import { ButtonLabel } from "./button-label";
  import type { NativeButtonClasses } from "./native-button-classes";
  import { isHidingNothing } from "@/lib/filter/title-filter";
  import { PageMessage, pageMessenger } from "@/lib/messaging/page-messaging";
  import { getPageState, onPageState } from "@/lib/page/page-state";
  import type { ChannelInfo } from "@/lib/schemas/channel";
  import { getModeFilter } from "@/lib/schemas/semi-subscription";
  import { SubscriptionMode } from "@/lib/schemas/subscription-mode";
  import {
    ButtonViewModelIcon,
    ButtonViewModelSize,
    ButtonViewModelState,
    ButtonViewModelStyle,
    ButtonViewModelType
  } from "@/lib/youtube/page/button-view-model";
  import { YouTubeSite } from "@/lib/youtube/site";
  import { BUTTON_ROOT_ATTRIBUTE, type ButtonPlacement } from "#channel-button/page/page-anchor";

  interface Props {
    channel: ChannelInfo;
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

  const BUTTON_TEXT = {
    [SubscriptionMode.follow]: {
      label: ButtonLabel.semiSubscribe,
      activeLabel: ButtonLabel.semiSubscribed,
      accessibilityText: (title: string) => `Semi-subscribe to ${title}`,
      activeAccessibilityText: (title: string) => `Edit your semi-subscription to ${title}`
    },
    [SubscriptionMode.hide]: {
      label: ButtonLabel.filter,
      activeLabel: ButtonLabel.filtered,
      accessibilityText: (title: string) => `Hide some of ${title}'s videos from your subscriptions feed`,
      activeAccessibilityText: (title: string) => `Edit what's hidden from ${title} in your subscriptions feed`
    }
  } as const;

  const subscription = $derived(pageState?.subscriptions[channel.channelId]);
  /** The channel's mode as the page shows it: the Subscribe button outranks the stored state, which follows it */
  const mode = $derived.by(() => {
    if (isOfficiallySubscribed) {
      return SubscriptionMode.hide;
    }

    return SubscriptionMode.follow;
  });
  /** Semi-subscribed while following; while subscribed, hiding something */
  const isActive = $derived.by(() => {
    if (!subscription) {
      return false;
    }

    return !isHidingNothing({
      filter: getModeFilter({
        subscription,
        mode
      }),
      mode
    });
  });
  const buttonText = $derived(BUTTON_TEXT[mode]);
  const isVisible = $derived(!!pageState?.isExtensionEnabled);
  const label = $derived.by(() => {
    if (isActive) {
      return buttonText.activeLabel;
    }

    return buttonText.label;
  });
  const accessibilityText = $derived.by(() => {
    if (isActive) {
      return buttonText.activeAccessibilityText(channel.title);
    }

    return buttonText.accessibilityText(channel.title);
  });
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

  function openDialog() {
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
