import { type PageChannel, PageKind } from "#channel-button/page/page-channel-schema";
import { pickAvatarUrl, toChannelHandle, toChannelInfo } from "#channel-button/page/readers/channel-info";
import { findValueByKey, isRecord } from "#channel-button/page/readers/renderer-search";
import { readOfficialSubscription } from "#channel-button/page/readers/subscription-state";
import { channelMetadataRendererSchema } from "@/lib/youtube/schemas/browse";
import { thumbnailSchema } from "@/lib/youtube/schemas/thumbnail";
import { z } from "@/lib/zod";

const SUBSCRIBE_CONTROL_KEYS = ["subscribeButtonViewModel", "subscribeButtonRenderer"];

const channelMetadataSchema = z.looseObject({
  metadata: z.looseObject({
    channelMetadataRenderer: channelMetadataRendererSchema
  })
});

const channelHeaderSchema = z.looseObject({
  header: z.unknown()
});

const pageHeaderAvatarSchema = z.looseObject({
  pageHeaderRenderer: z.looseObject({
    content: z.looseObject({
      pageHeaderViewModel: z.looseObject({
        image: z.looseObject({
          decoratedAvatarViewModel: z.looseObject({
            avatar: z.looseObject({
              avatarViewModel: z.looseObject({
                image: z.looseObject({
                  sources: z.array(thumbnailSchema)
                })
              })
            })
          })
        })
      })
    })
  })
});

export function readChannelPageChannel(response: unknown) {
  const parsedMetadata = channelMetadataSchema.safeParse(response);
  if (!parsedMetadata.success) {
    return null;
  }

  const metadata = parsedMetadata.data.metadata.channelMetadataRenderer;
  const parsedHeader = channelHeaderSchema.safeParse(response);
  const header = parsedHeader.success ? parsedHeader.data.header : undefined;
  const parsedAvatar = pageHeaderAvatarSchema.safeParse(header);
  const headerAvatars = parsedAvatar.success
    ? parsedAvatar.data.pageHeaderRenderer.content.pageHeaderViewModel.image.decoratedAvatarViewModel.avatar
        .avatarViewModel.image.sources
    : undefined;
  const channel = toChannelInfo({
    channelId: metadata.externalId,
    title: metadata.title,
    handle: toChannelHandle(metadata.vanityChannelUrl),
    avatarUrl: pickAvatarUrl(headerAvatars ?? metadata.avatar?.thumbnails)
  });
  if (!channel) {
    return null;
  }

  const subscribeControl = findValueByKey({
    root: header,
    keys: SUBSCRIBE_CONTROL_KEYS,
    isMatch: isRecord
  });
  const pageChannel: PageChannel = {
    kind: PageKind.CHANNEL,
    channel,
    videoId: undefined,
    isOwnedByViewer: false,
    hasSubscribeControl: subscribeControl !== undefined,
    officialSubscription: readOfficialSubscription({
      response,
      searchRoot: header,
      channelId: channel.channelId
    }),
    collaborators: []
  };
  return pageChannel;
}
