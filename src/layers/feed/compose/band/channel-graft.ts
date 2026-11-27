import { VERIFIED_ICON_NAME } from "#feed/items/feed-schemas";
import type { ChannelInfo } from "@/lib/schemas/channel";
import { buildChannelPath, formatHandle } from "@/lib/youtube/channel-link";
import { buildChannelEndpoint } from "@/lib/youtube/endpoints";
import type { Lockup, MetadataRow } from "@/lib/youtube/schemas/renderers";

const DEFAULT_AVATAR_SIZE = "AVATAR_SIZE_M";
const AVATAR_PIXELS = 68;

export const VERIFIED_LABEL = "Verified";
const VERIFIED_ICON = {
  name: VERIFIED_ICON_NAME,
  height: 14,
  width: 14,
  accessibilityLabel: VERIFIED_LABEL,
  marginEndToken: {
    spacing: 2
  }
};

export function channelCommand(channel: ChannelInfo) {
  const canonicalBaseUrl = channel.handle ? `/${formatHandle(channel.handle)}` : undefined;
  return buildChannelEndpoint({
    channelId: channel.channelId,
    url: canonicalBaseUrl ?? buildChannelPath(channel.channelId),
    canonicalBaseUrl
  });
}

function avatarImage({
  channel,
  avatarUrl,
  avatarImageSize
}: {
  channel: ChannelInfo;
  avatarUrl: string;
  avatarImageSize: string;
}) {
  return {
    decoratedAvatarViewModel: {
      avatar: {
        avatarViewModel: {
          image: {
            sources: [
              {
                url: avatarUrl,
                width: AVATAR_PIXELS,
                height: AVATAR_PIXELS
              }
            ]
          },
          avatarImageSize
        }
      },
      a11yLabel: channel.title,
      rendererContext: {
        commandContext: {
          onTap: {
            innertubeCommand: channelCommand(channel)
          }
        }
      }
    }
  };
}

/** The channel name in the template's layout: a row of its own (www) or leading the first row (m) */
function withChannelRow({
  rows,
  templateRows,
  channel
}: {
  rows: MetadataRow[] | undefined;
  templateRows: MetadataRow[] | undefined;
  channel: ChannelInfo;
}) {
  const isChannelOnOwnRow = (templateRows?.[0]?.metadataParts?.length ?? 0) <= 1;
  const [firstRow, ...otherRows] = rows ?? [];
  const channelPart = {
    text: {
      content: channel.title,
      commandRuns: [
        {
          startIndex: 0,
          length: channel.title.length,
          onTap: {
            innertubeCommand: channelCommand(channel)
          }
        }
      ]
    },
    ...(channel.isVerified && {
      icon: VERIFIED_ICON
    })
  };
  if (isChannelOnOwnRow) {
    return [{ metadataParts: [channelPart] }, ...(firstRow ? [firstRow] : []), ...otherRows];
  }

  return [
    {
      ...firstRow,
      metadataParts: [channelPart, ...(firstRow?.metadataParts ?? [])]
    },
    ...otherRows
  ];
}

/** The channel's avatar, only where the template shows one */
function templateAvatarImage({ template, channel }: { template: Lockup; channel: ChannelInfo }) {
  const templateAvatar = template.metadata?.lockupMetadataViewModel?.image?.decoratedAvatarViewModel;
  const avatarUrl = templateAvatar ? channel.avatarUrl : undefined;
  if (!avatarUrl) {
    return undefined;
  }

  return avatarImage({
    channel,
    avatarUrl,
    avatarImageSize: templateAvatar?.avatar?.avatarViewModel?.avatarImageSize ?? DEFAULT_AVATAR_SIZE
  });
}

/** Adds the channel name and avatar in the template's layout */
export function graftChannel({
  lockup,
  template,
  channel
}: {
  lockup: Lockup;
  template: Lockup;
  channel: ChannelInfo;
}) {
  const templateContentMetadata = template.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel;
  const lockupMetadata = lockup.metadata?.lockupMetadataViewModel;
  const contentMetadata = lockupMetadata?.metadata?.contentMetadataViewModel;
  const metadataRows = withChannelRow({
    rows: contentMetadata?.metadataRows,
    templateRows: templateContentMetadata?.metadataRows,
    channel
  });
  const image = templateAvatarImage({
    template,
    channel
  });
  const delimiter = templateContentMetadata?.delimiter ?? contentMetadata?.delimiter;
  return {
    ...lockup,
    metadata: {
      ...lockup.metadata,
      lockupMetadataViewModel: {
        ...lockupMetadata,
        ...(image && {
          image
        }),
        metadata: {
          ...lockupMetadata?.metadata,
          contentMetadataViewModel: {
            ...contentMetadata,
            ...(delimiter !== undefined && {
              delimiter
            }),
            metadataRows
          }
        }
      }
    }
  };
}
