<script lang="ts">
  import {
    type ButtonViewModelData,
    ButtonViewModelIcon,
    ButtonViewModelSize,
    ButtonViewModelState,
    ButtonViewModelStyle,
    ButtonViewModelType
  } from "@/lib/youtube/page/button-view-model";
  import { polymerHostAttributes } from "@/lib/youtube/page/polymer-host";

  // www's own `<yt-button-view-model>`, its look handed over through `.data`. The real <button> it renders is a submit
  // button inside the dialog's form, so a plain action stops that default and only `isSubmit` lets it through

  interface Props {
    label: string;
    type: ButtonViewModelType;
    icon?: ButtonViewModelIcon;
    /** Shows only the icon, the label read out by screen readers */
    isIconOnly?: boolean;
    isDisabled?: boolean;
    /** The form's own submit button - its press submits the dialog's form */
    isSubmit?: boolean;
    onclick?: () => void;
  }

  const { label, type, icon, isIconOnly = false, isDisabled = false, isSubmit = false, onclick }: Props = $props();

  const BUTTON_TAG = "yt-button-view-model";

  const data = $derived.by(() => {
    const buttonData: ButtonViewModelData = {
      title: isIconOnly ? undefined : label,
      iconName: icon ?? ButtonViewModelIcon.none,
      accessibilityText: label,
      style: ButtonViewModelStyle.mono,
      type,
      buttonSize: ButtonViewModelSize.default,
      state: isDisabled ? ButtonViewModelState.disabled : ButtonViewModelState.active,
      isFullWidth: false
    };
    return buttonData;
  });
</script>

<span
  {...polymerHostAttributes({
    tag: BUTTON_TAG,
    data
  })}
  class="button"
  onclick={e => {
    if (!isSubmit) {
      e.preventDefault();
    }

    if (!isDisabled) {
      onclick?.();
    }
  }}
  role="none"></span>

<style>
  .button {
    display: contents;
  }
</style>
