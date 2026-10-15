import SemiSubDialog from "./SemiSubDialog.svelte";
import { openDialogRequestSchema, PageMessage, pageMessenger } from "@/lib/messaging/page-messaging";
import type { ChannelInfo } from "@/lib/schemas/channel";
import { type ContentScriptContext, createShadowRootUi, type ShadowRootContentScriptUi } from "#imports";
import { mount, unmount } from "svelte";

const DIALOG_HOST_NAME = "yss-semi-sub-dialog";

/** ISOLATED world: open the semi-subscribe dialog when the MAIN-world button asks for it */
export function registerSemiSubDialog(context: ContentScriptContext) {
  let currentUi: ShadowRootContentScriptUi<ReturnType<typeof mount>> | null = null;

  async function openDialog({ channel, isSubscribed }: {
    channel: ChannelInfo;
    isSubscribed: boolean | undefined;
  }) {
    const ui = await createShadowRootUi(context, {
      name: DIALOG_HOST_NAME,
      position: "inline",
      anchor: "body",
      // Keys typed into the filter must not reach YouTube's player shortcuts
      isolateEvents: true,
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

  pageMessenger.onMessage(PageMessage.openSemiSubDialog, ({ data }) => {
    const parsed = openDialogRequestSchema.safeParse(data);
    if (!parsed.success) {
      return;
    }

    const { isSubscribed, ...channel } = parsed.data;
    openDialog({
      channel,
      isSubscribed
    }).catch(console.error);
  });
}
