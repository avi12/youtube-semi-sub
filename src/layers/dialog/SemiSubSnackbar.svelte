<script lang="ts">
  import { MobileToastDirection, type ToastMessage } from "./toast-message";
  import { getYouTubeSite, YouTubeSite } from "@/lib/youtube/site";
  import { onMount } from "svelte";

  // YouTube's own toast, built from its markup so YouTube's CSS lays it out, themes it and slides it in and out: www's
  // snackbar inside its `snackbar-container`, m's `c3-toast`, which slides by its `dir` attribute

  interface Props {
    message: ToastMessage;
    onDone: () => void;
  }

  const { message, onDone }: Props = $props();

  const SNACKBAR_DURATION_MS = 4000;
  const SNACKBAR_CONTAINER_SELECTOR = "snackbar-container";

  const isMobile = getYouTubeSite() === YouTubeSite.mobile;

  let isEntered = $state(false);
  let isClosing = $state(false);
  let dismissTimer: ReturnType<typeof setTimeout> | undefined;

  function scheduleDismiss() {
    clearTimeout(dismissTimer);
    dismissTimer = setTimeout(() => {
      isClosing = true;
    }, SNACKBAR_DURATION_MS);
  }

  function attachToSnackbarContainer(elSnackbar: HTMLElement) {
    const elContainer = document.querySelector(SNACKBAR_CONTAINER_SELECTOR);
    if (!elContainer) {
      onDone();
      return;
    }

    elContainer.append(elSnackbar);
    return () => elSnackbar.remove();
  }

  function attachToBody(elToast: HTMLElement) {
    document.body.append(elToast);
    return () => elToast.remove();
  }

  /** Starts `out`, so m's transition slides it in on the next frame, and back out when it closes */
  function attachMobileToastDirection(elToast: HTMLElement) {
    const isShown = isEntered && !isClosing;
    elToast.setAttribute("dir", isShown ? MobileToastDirection.entering : MobileToastDirection.leaving);
  }

  onMount(() => {
    requestAnimationFrame(() => {
      isEntered = true;
    });
    scheduleDismiss();
    return () => clearTimeout(dismissTimer);
  });
</script>

{#if isMobile}
  <c3-toast
    {@attach attachToBody}
    {@attach attachMobileToastDirection}
    ontransitionend={(e: TransitionEvent) => {
      if (isClosing && e.target === e.currentTarget) {
        onDone();
      }
    }}
    role="status">
    {message}
  </c3-toast>
{:else}
  <output
    class="ytSnackbarContainerSnackbarContainer"
    class:ytSnackbarContainerClosed={isClosing}
    class:ytSnackbarContainerOpened={!isClosing}
    {@attach attachToSnackbarContainer}
    onanimationend={e => {
      if (isClosing && e.target === e.currentTarget) {
        onDone();
      }
    }}
    onmouseenter={() => clearTimeout(dismissTimer)}
    onmouseleave={scheduleDismiss}>
    <snackbar-view-model class="snackbarViewModelHost">
      <div class="snackbarViewModelEngagementBarWrapper">
        <div class="snackbarViewModelTitleSubtextWrapper">
          <div class="snackbarViewModelTitle">
            <span class="ytAttributedStringHost ytAttributedStringWhiteSpacePreWrap">{message}</span>
          </div>
        </div>
      </div>
    </snackbar-view-model>
  </output>
{/if}
