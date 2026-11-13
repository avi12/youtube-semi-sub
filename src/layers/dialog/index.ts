import { mount, unmount } from "svelte";

import { type ContentScriptContext, createIntegratedUi, type IntegratedContentScriptUi } from "#imports";
import { PageMessage, pageMessenger } from "@/lib/messaging/page-messaging";
import type { ChannelInfo } from "@/lib/schemas/channel";

import SemiSubDialog from "./SemiSubDialog.svelte";

const DIALOG_HOST_NAME = "yss-semi-sub-dialog";

/** ISOLATED world: open the semi-subscribe dialog when the MAIN-world button asks for it */
export function registerSemiSubDialog(context: ContentScriptContext) {
  let currentUi: IntegratedContentScriptUi<ReturnType<typeof mount>> | null = null;

  async function openDialog({ channel, isSubscribed }: { channel: ChannelInfo; isSubscribed: boolean | undefined }) {
    // In the page's own DOM, not a shadow root: YouTube's Polymer components inside are styled by its document CSS.
    // The dialog itself keeps keys typed into the filter from reaching YouTube's player shortcuts
    const integratedUi = createIntegratedUi(context, {
      tag: DIALOG_HOST_NAME,
      position: "inline",
      anchor: "body",
      onMount(container) {
        return mount(SemiSubDialog, {
          target: container,
          props: {
            channel,
            isSubscribed,
            onDone() {
              integratedUi.remove();

              if (currentUi === integratedUi) {
                currentUi = null;
              }
            }
          }
        });
      },
      onRemove(dialog) {
        if (dialog) {
          unmount(dialog).catch(() => {});
        }
      }
    });
    currentUi?.remove();
    currentUi = integratedUi;
    integratedUi.mount();
  }

  pageMessenger.onMessage(PageMessage.OPEN_SEMI_SUB_DIALOG, ({ isSubscribed, ...channel }) => {
    openDialog({
      channel,
      isSubscribed
    }).catch(console.error);
  });
}
