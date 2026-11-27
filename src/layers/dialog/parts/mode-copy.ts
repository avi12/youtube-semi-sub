import { ToastMessage } from "#dialog/toast-message";
import { SubscriptionMode } from "@/lib/schemas/subscription-mode";

export const MODE_TEXT = {
  [SubscriptionMode.FOLLOW]: {
    description: "You're not subscribed, so only the videos your filter lets through are added to your feed",
    createLabel: "Semi-subscribe",
    createdMessage: ToastMessage.SEMI_SUBSCRIBED,
    savedMessage: ToastMessage.FILTER_SAVED,
    removedMessage: ToastMessage.REMOVED
  },
  [SubscriptionMode.HIDE]: {
    description: "You're subscribed, so the videos your filter matches are hidden from your feed",
    createLabel: "Save",
    createdMessage: ToastMessage.HIDE_FILTER_SAVED,
    savedMessage: ToastMessage.HIDE_FILTER_SAVED,
    removedMessage: ToastMessage.HIDE_FILTER_REMOVED
  }
} as const;

export const INACTIVE_NOTE = {
  [SubscriptionMode.FOLLOW]:
    "while you're subscribed it hides the videos it doesn't let through, and it adds the ones it does once you unsubscribe",
  [SubscriptionMode.HIDE]: "this filter applies once you subscribe"
} as const satisfies Record<SubscriptionMode, string>;
