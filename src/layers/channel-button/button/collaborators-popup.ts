import { PageMessage, pageMessenger } from "@/lib/messaging/page-messaging";
import { focusPlayer } from "@/lib/page/focus-player";
import { channelInfoSchema } from "@/lib/schemas/channel";
import { functionSchema } from "@/lib/schemas/function";
import {
  type ButtonViewModelData,
  ButtonViewModelIcon,
  ButtonViewModelSize,
  ButtonViewModelState,
  ButtonViewModelStyle,
  ButtonViewModelType
} from "@/lib/youtube/page/button-view-model";
import { z } from "@/lib/zod";
import { on } from "svelte/events";

// MAIN world: a collaboration's picker. YouTube's own Subscribe opens a "Collaborators" dialog with one Subscribe
// button per channel; this opens that same dialog with our button in every row

const collaboratorChoiceSchema = channelInfoSchema.extend({
  isSubscribed: z.boolean().optional(),
  label: z.string(),
  accessibilityText: z.string(),
  isActive: z.boolean()
});
export type CollaboratorChoice = z.infer<typeof collaboratorChoiceSchema>;

const APP_SELECTOR = "ytd-app";
const DIALOG_SELECTOR = "tp-yt-paper-dialog";
const ROW_SELECTOR = "yt-list-item-view-model";
const ROW_BUTTON_SELECTOR = "button";
const OPEN_POPUP_ACTION = "yt-open-popup-action";
const OVERLAY_CLOSED_EVENT = "iron-overlay-closed";
const YT_ACTION_EVENT = "yt-action";
const POPUP_TYPE_DIALOG = "DIALOG";
const DIALOG_TITLE = "Collaborators";
const AVATAR_SIZE_MEDIUM = "AVATAR_SIZE_M";

const closeableSchema = z.object({
  close: functionSchema
});

let stopListeningForPick: (() => void) | null = null;

function buildButton({ label, accessibilityText, isActive }: CollaboratorChoice) {
  const data: ButtonViewModelData = {
    title: label,
    iconName: isActive ? ButtonViewModelIcon.filter : ButtonViewModelIcon.none,
    accessibilityText,
    style: ButtonViewModelStyle.mono,
    type: isActive ? ButtonViewModelType.tonal : ButtonViewModelType.filled,
    buttonSize: ButtonViewModelSize.default,
    state: ButtonViewModelState.active,
    isFullWidth: false
  };
  return { buttonViewModel: data };
}

function buildRow(choice: CollaboratorChoice) {
  return {
    listItemViewModel: {
      title: {
        content: choice.title
      },
      subtitle: {
        content: choice.handle ?? ""
      },
      leadingAccessory: {
        avatarViewModel: {
          image: {
            sources: choice.avatarUrl ? [{ url: choice.avatarUrl }] : [],
            processor: {
              borderImageProcessor: {
                circular: true
              }
            }
          },
          avatarImageSize: AVATAR_SIZE_MEDIUM
        }
      },
      trailingButtons: {
        buttons: [buildButton(choice)]
      }
    }
  };
}

function closeDialog(elDialog: Element) {
  const parsed = closeableSchema.safeParse(elDialog);
  if (parsed.success) {
    parsed.data.close.call(elDialog);
  }
}

/** Our buttons carry no command of their own: a press is told apart by its row and its accessible name */
function listenForPick(choices: CollaboratorChoice[]) {
  stopListeningForPick?.();
  const stopListeningForClose = on(document, OVERLAY_CLOSED_EVENT, e => {
    const isCollaboratorsDialog = e.target instanceof Element && e.target.matches(DIALOG_SELECTOR);
    if (!isCollaboratorsDialog) {
      return;
    }

    stopListening();
    stopListeningForPick = null;
    focusPlayer();
  }, { capture: true });
  function stopListening() {
    stopListeningForClick();
    stopListeningForClose();
  }
  const stopListeningForClick = on(document, "click", e => {
    const elTarget = e.target instanceof Element ? e.target : null;
    const elRow = elTarget?.closest(ROW_SELECTOR);
    const elDialog = elRow?.closest(DIALOG_SELECTOR);
    const elButton = elTarget?.closest(ROW_BUTTON_SELECTOR);
    const iRow = elRow?.parentElement ? Array.from(elRow.parentElement.children).indexOf(elRow) : -1;
    const choice = choices.at(iRow);
    const isOurButton = !!elDialog && !!choice && elButton?.getAttribute("aria-label") === choice.accessibilityText;
    if (!isOurButton) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    stopListening();
    stopListeningForPick = null;
    closeDialog(elDialog);
    pageMessenger.sendMessage(PageMessage.openSemiSubDialog, {
      channelId: choice.channelId,
      title: choice.title,
      handle: choice.handle,
      avatarUrl: choice.avatarUrl,
      isSubscribed: choice.isSubscribed
    }).catch(() => {});
  }, { capture: true });
  stopListeningForPick = stopListening;
}

/** False where YouTube has no popup container to open it in (m.youtube.com) */
export function openCollaboratorsPopup(choices: CollaboratorChoice[]) {
  const elApp = document.querySelector(APP_SELECTOR);
  if (!elApp) {
    return false;
  }

  listenForPick(choices);
  const dialogViewModel = {
    header: {
      dialogHeaderViewModel: {
        headline: {
          content: DIALOG_TITLE
        }
      }
    },
    customContent: {
      listViewModel: {
        listItems: choices.map(buildRow)
      }
    }
  };
  elApp.dispatchEvent(
    new CustomEvent(YT_ACTION_EVENT, {
      bubbles: true,
      composed: true,
      detail: {
        actionName: OPEN_POPUP_ACTION,
        args: [{
          openPopupAction: {
            popup: {
              dialogViewModel
            },
            popupType: POPUP_TYPE_DIALOG
          }
        }, elApp],
        optionalAction: false,
        returnValue: []
      }
    })
  );
  return true;
}
