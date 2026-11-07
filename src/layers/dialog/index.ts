import SemiSubDialog from "./SemiSubDialog.svelte";
import { PageMessage, pageMessenger } from "@/lib/messaging/page-messaging";
import type { ChannelInfo } from "@/lib/schemas/channel";
import { type ContentScriptContext, createIntegratedUi, type IntegratedContentScriptUi } from "#imports";
import { mount, unmount } from "svelte";

const DIALOG_HOST_NAME = "yss-semi-sub-dialog";

/** ISOLATED world: open the semi-subscribe dialog when the MAIN-world button asks for it */
export function registerSemiSubDialog(context: ContentScriptContext) {
  let currentUi: IntegratedContentScriptUi<ReturnType<typeof mount>> | null = null;

  async function openDialog({ channel, isSubscribed }: {
    channel: ChannelInfo;
    isSubscribed: boolean | undefined;
  }) {
    // In the page's own DOM, not a shadow root: YouTube's Polymer components inside are styled by its document CSS.
    // The dialog itself keeps keys typed into the filter from reaching YouTube's player shortcuts
    const ui = createIntegratedUi(context, {
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
              ui.remove();

              if (currentUi === ui) {
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
    currentUi = ui;
    ui.mount();
  }

  pageMessenger.onMessage(PageMessage.openSemiSubDialog, ({ isSubscribed, ...channel }) => {
    openDialog({
      channel,
      isSubscribed
    }).catch(console.error);
  });
}
