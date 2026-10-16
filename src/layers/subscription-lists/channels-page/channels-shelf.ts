import type { PageState } from "@/lib/messaging/page-messaging";
import { channelIdSchema } from "@/lib/schemas/channel";
import type { SemiSubscription } from "@/lib/schemas/semi-subscription";
import { formatHandle } from "@/lib/youtube/channel-link";
import { z } from "@/lib/zod";
import { describeFilterLiteral, formatFilterLiteral } from "#subscription-lists/components/filter-literal";
import { describeManageButton } from "#subscription-lists/components/open-dialog";
import { buildListedChannelEndpoint, SEMI_LIST_TITLE } from "#subscription-lists/semi-channels";

// www.youtube.com/feed/channels renders a section list of item sections, each a shelf of `channelRenderer` items.
// Semi-subscriptions are one more such section at the top, written into that data, so YouTube lays them out, themes
// them and links them like its own channels. Both the section and each channel are tagged, so a pass can find,
// replace or remove them, and a click on a channel's button can be told apart from YouTube's subscribe button

const SEMI_SECTION_KEY = "yssSemiSubscriptions";
/** What a section was built from, so a pass compares that rather than data YouTube may have added to while rendering */
const SEMI_SECTION_SIGNATURE_KEY = "yssSignature";
const SEMI_CHANNEL_KEY = "yssSemiSubscribed";
/** The thumbnail spacing YouTube's own rows on this page use */
const CHANNEL_RENDERER_STYLE = "CHANNEL_RENDERER_STYLE__NARROW_THUMBNAIL_SPACING";
const AVATAR_SIZE_PX = 176;

enum ButtonStyle {
  standard = "STYLE_DEFAULT"
}

enum ButtonSize {
  standard = "SIZE_DEFAULT"
}

const FILTER_ICON = "FILTER";

const sectionListDataSchema = z.looseObject({
  contents: z.array(z.unknown())
});

const semiSectionItemSchema = z.looseObject({
  itemSectionRenderer: z.looseObject({
    [SEMI_SECTION_KEY]: z.literal(true),
    [SEMI_SECTION_SIGNATURE_KEY]: z.string()
  })
});

/** A rendered `ytd-channel-renderer`'s own `data` for one of ours */
const semiChannelDataSchema = z.looseObject({
  [SEMI_CHANNEL_KEY]: z.literal(true),
  channelId: channelIdSchema
});

function isSemiSection(item: unknown) {
  return semiSectionItemSchema.safeParse(item).success;
}

function buildManageButton(subscription: SemiSubscription) {
  const { isActive, label, accessibilityText } = describeManageButton(subscription);
  return {
    buttonRenderer: {
      style: ButtonStyle.standard,
      size: ButtonSize.standard,
      isDisabled: false,
      ...isActive && {
        icon: {
          iconType: FILTER_ICON
        }
      },
      text: {
        runs: [{ text: label }]
      },
      accessibility: {
        label: accessibilityText
      }
    }
  };
}

function buildChannelItem({ subscription, isAiEnabled }: Pick<PageState, "isAiEnabled"> & {
  subscription: SemiSubscription;
}) {
  const { channelId, title, handle, avatarUrl } = subscription;
  const literal = describeFilterLiteral({
    subscription,
    isAiEnabled
  });
  return {
    channelRenderer: {
      [SEMI_CHANNEL_KEY]: true,
      channelId,
      title: {
        simpleText: title
      },
      navigationEndpoint: buildListedChannelEndpoint(subscription),
      ...avatarUrl && {
        thumbnail: {
          thumbnails: [{
            url: avatarUrl,
            width: AVATAR_SIZE_PX,
            height: AVATAR_SIZE_PX
          }]
        }
      },
      // YouTube's own rows put the handle in this field, and the line after it in `videoCountText`
      ...handle && {
        subscriberCountText: {
          simpleText: formatHandle(handle)
        }
      },
      videoCountText: {
        simpleText: literal.modeName
      },
      descriptionSnippet: {
        runs: [{ text: formatFilterLiteral(literal) }]
      },
      subscribeButton: buildManageButton(subscription),
      channelRendererStyle: CHANNEL_RENDERER_STYLE
    }
  };
}

function buildSemiSection({ subscriptions, isAiEnabled, signature }: Pick<PageState, "isAiEnabled"> & {
  subscriptions: readonly SemiSubscription[];
  signature: string;
}) {
  return {
    itemSectionRenderer: {
      [SEMI_SECTION_KEY]: true,
      [SEMI_SECTION_SIGNATURE_KEY]: signature,
      contents: [{
        shelfRenderer: {
          title: {
            runs: [{ text: SEMI_LIST_TITLE }]
          },
          content: {
            expandedShelfContentsRenderer: {
              items: subscriptions.map(subscription => buildChannelItem({
                subscription,
                isAiEnabled
              }))
            }
          }
        }
      }]
    }
  };
}

/**
 * The section list's data with the semi-subscriptions section first - or without one when there is nothing to list -
 * or null when it already reads that way
 */
export function withSemiChannelsSection({ data, subscriptions, isAiEnabled }: Pick<PageState, "isAiEnabled"> & {
  data: unknown;
  subscriptions: readonly SemiSubscription[];
}) {
  const parsed = sectionListDataSchema.safeParse(data);
  if (!parsed.success) {
    return null;
  }

  const listData = parsed.data;
  const { contents } = listData;
  const isListed = subscriptions.length > 0;
  const signature = JSON.stringify([subscriptions, isAiEnabled]);
  const semiSectionCount = contents.filter(isSemiSection).length;
  const first = semiSectionItemSchema.safeParse(contents[0]);
  const isCurrentFirst = first.success && first.data.itemSectionRenderer[SEMI_SECTION_SIGNATURE_KEY] === signature;
  const isInPlace = isListed ? semiSectionCount === 1 && isCurrentFirst : semiSectionCount === 0;
  if (isInPlace) {
    return null;
  }

  const ownContents = contents.filter(item => !isSemiSection(item));
  const section = isListed ? [buildSemiSection({
    subscriptions,
    isAiEnabled,
    signature
  })] : [];
  return {
    ...listData,
    contents: [...section, ...ownContents]
  };
}

/** The channel a rendered row of ours stands for, or null for one of YouTube's own */
export function readSemiChannelId(data: unknown) {
  const parsed = semiChannelDataSchema.safeParse(data);
  return parsed.success ? parsed.data.channelId : null;
}
