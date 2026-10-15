import { isHidingNothing } from "@/lib/filter/title-filter";
import { getModeFilter, type SemiSubscription } from "@/lib/schemas/semi-subscription";
import { SubscriptionMode } from "@/lib/schemas/subscription-mode";

// Short and native-looking beside YouTube's own Subscribe/Subscribed: a follow button for a channel the user isn't
// subscribed to, and a plain "Filter" for one they are - "Semi-subscribe" would contradict the "Subscribed" beside it

enum ButtonLabel {
  semiSubscribe = "Semi-subscribe",
  semiSubscribed = "Semi-subscribed",
  filter = "Filter",
  filtered = "Filtered"
}

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

/**
 * The words on a channel's button, wherever one opens its dialog: active - semi-subscribed while following, hiding
 * something while subscribed - it gets the filter glyph and the past tense
 */
export function describeChannelButton({ channelTitle, subscription, mode }: {
  channelTitle: string;
  /** Undefined while the channel isn't semi-subscribed */
  subscription: SemiSubscription | undefined;
  mode: SubscriptionMode;
}) {
  const text = BUTTON_TEXT[mode];
  const isActive = !!subscription && !isHidingNothing({
    filter: getModeFilter({
      subscription,
      mode
    }),
    mode
  });
  if (!isActive) {
    return {
      isActive,
      label: text.label,
      accessibilityText: text.accessibilityText(channelTitle)
    };
  }

  return {
    isActive,
    label: text.activeLabel,
    accessibilityText: text.activeAccessibilityText(channelTitle)
  };
}
