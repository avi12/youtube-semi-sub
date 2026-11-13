import { isFilterInert } from "@/lib/filter/title-filter";
import { getModeFilter, isAllowListHiding, type SemiSubscription } from "@/lib/schemas/semi-subscription";
import { SubscriptionMode } from "@/lib/schemas/subscription-mode";

// Short and native-looking beside YouTube's own Subscribe/Subscribed, and named the same in both modes; only its
// accessible description says what the mode does

enum ButtonLabel {
  SEMI_SUBSCRIBE = "Semi-subscribe",
  SEMI_SUBSCRIBED = "Semi-subscribed"
}

const ACCESSIBILITY_TEXT = {
  [SubscriptionMode.FOLLOW]: {
    accessibilityText: (title: string) => `Semi-subscribe to ${title}`,
    activeAccessibilityText: (title: string) => `Edit your semi-subscription to ${title}`
  },
  [SubscriptionMode.HIDE]: {
    accessibilityText: (title: string) => `Hide some of ${title}'s videos from your subscriptions feed`,
    activeAccessibilityText: (title: string) => `Edit what's hidden from ${title} in your subscriptions feed`
  }
} as const;

/**
 * The words on a channel's button, wherever one opens its dialog: active - adding videos while following, hiding
 * something while subscribed - it gets the filter glyph and the past tense
 */
export function describeChannelButton({
  channelTitle,
  subscription,
  mode
}: {
  channelTitle: string;
  /** Undefined while the channel isn't semi-subscribed */
  subscription: SemiSubscription | undefined;
  mode: SubscriptionMode;
}) {
  const text = ACCESSIBILITY_TEXT[mode];
  const isActive =
    !!subscription &&
    (!isFilterInert({
      filter: getModeFilter({
        subscription,
        mode
      }),
      mode
    }) ||
      (mode === SubscriptionMode.HIDE && isAllowListHiding(subscription)));
  if (!isActive) {
    return {
      isActive,
      label: ButtonLabel.SEMI_SUBSCRIBE,
      accessibilityText: text.accessibilityText(channelTitle)
    };
  }

  return {
    isActive,
    label: ButtonLabel.SEMI_SUBSCRIBED,
    accessibilityText: text.activeAccessibilityText(channelTitle)
  };
}
