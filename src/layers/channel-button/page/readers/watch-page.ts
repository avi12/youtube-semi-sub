import { type PageChannel, type PageData, PageKind } from "#channel-button/page/page-channel-schema";
import { pickAvatarUrl, toChannelHandle, toChannelInfo } from "#channel-button/page/readers/channel-info";
import { findValueByKey, isRecord } from "#channel-button/page/readers/renderer-search";
import {
  readPageOfficialSubscription,
  readSubscriptionEntities
} from "#channel-button/page/readers/subscription-state";
import { browseEndpointSchema } from "@/lib/youtube/schemas/browse";
import { textRunSchema } from "@/lib/youtube/schemas/text";
import { thumbnailListSchema, thumbnailSchema } from "@/lib/youtube/schemas/thumbnail";
import { z } from "@/lib/zod";

const HANDLE_IN_TEXT_PATTERN = /@[\w.-]+/;
const COLLABORATOR_LIST_KEY = "listItems";
const OWNER_RENDERER_KEYS = ["videoOwnerRenderer", "slimOwnerRenderer"];

const videoDetailsSchema = z.looseObject({
  videoDetails: z.looseObject({
    videoId: z.string(),
    channelId: z.string(),
    author: z.string().optional(),
    isOwnerViewing: z.boolean().optional()
  })
});

const watchContentsSchema = z.looseObject({
  contents: z.unknown()
});

/** www `videoOwnerRenderer` and m `slimOwnerRenderer` share these fields */
const ownerRendererSchema = z.looseObject({
  title: z.looseObject({
    runs: z.tuple([textRunSchema], z.unknown())
  }),
  thumbnail: thumbnailListSchema.optional(),
  navigationEndpoint: z.looseObject({
    browseEndpoint: browseEndpointSchema
  })
});

/** One row of the "Collaborators" list a collaboration's Subscribe button opens */
const collaboratorItemSchema = z.looseObject({
  listItemViewModel: z.looseObject({
    title: z.looseObject({
      content: z.string(),
      commandRuns: z.tuple(
        [
          z.looseObject({
            onTap: z.looseObject({
              innertubeCommand: z.looseObject({
                browseEndpoint: browseEndpointSchema
              })
            })
          })
        ],
        z.unknown()
      )
    }),
    subtitle: z
      .looseObject({
        content: z.string()
      })
      .optional(),
    leadingAccessory: z
      .looseObject({
        avatarViewModel: z.looseObject({
          image: z.looseObject({
            sources: z.array(thumbnailSchema)
          })
        })
      })
      .optional()
  })
});

const collaboratorListSchema = z.array(collaboratorItemSchema).min(1);

function readCollaborators({ response, searchRoot }: { response: unknown; searchRoot: unknown }) {
  const parsedList = collaboratorListSchema.safeParse(
    findValueByKey({
      root: searchRoot,
      keys: [COLLABORATOR_LIST_KEY],
      isMatch: candidate => collaboratorListSchema.safeParse(candidate).success
    })
  );
  if (!parsedList.success) {
    return [];
  }

  const subscribedByChannel = readSubscriptionEntities(response);
  const collaborators: PageChannel["collaborators"] = [];
  for (const { listItemViewModel: item } of parsedList.data) {
    const [{ onTap }] = item.title.commandRuns;
    const channelId = onTap.innertubeCommand.browseEndpoint.browseId;
    const channel = toChannelInfo({
      channelId,
      title: item.title.content,
      handle: item.subtitle?.content.match(HANDLE_IN_TEXT_PATTERN)?.[0],
      avatarUrl: pickAvatarUrl(item.leadingAccessory?.avatarViewModel.image.sources)
    });
    if (channel) {
      collaborators.push({
        ...channel,
        isSubscribed: subscribedByChannel.get(channelId)
      });
    }
  }
  return collaborators;
}

export function readWatchChannel({ response, playerResponse }: PageData) {
  const parsedDetails = videoDetailsSchema.safeParse(playerResponse);
  const videoDetails = parsedDetails.success ? parsedDetails.data.videoDetails : null;
  const parsedContents = watchContentsSchema.safeParse(response);
  const contents = parsedContents.success ? parsedContents.data.contents : undefined;
  const parsedOwner = ownerRendererSchema.safeParse(
    findValueByKey({
      root: contents,
      keys: OWNER_RENDERER_KEYS,
      isMatch: candidate => ownerRendererSchema.safeParse(candidate).success
    })
  );
  const owner = parsedOwner.success ? parsedOwner.data : null;
  const ownerChannelId = owner?.navigationEndpoint.browseEndpoint.browseId;
  const channelId = videoDetails?.channelId ?? ownerChannelId;
  if (!channelId) {
    return null;
  }

  // A collaboration's owner row can name another channel than the uploader - then only the uploader's id is trusted
  const isOwnerTheUploader = ownerChannelId === channelId;
  const uploader = isOwnerTheUploader ? owner : null;
  const channel = toChannelInfo({
    channelId,
    title: uploader?.title.runs[0].text ?? videoDetails?.author ?? "",
    handle: toChannelHandle(uploader?.navigationEndpoint.browseEndpoint.canonicalBaseUrl),
    avatarUrl: pickAvatarUrl(uploader?.thumbnail?.thumbnails)
  });
  if (!channel) {
    return null;
  }

  const pageChannel: PageChannel = {
    kind: PageKind.WATCH,
    channel,
    videoId: videoDetails?.videoId,
    isOwnedByViewer: videoDetails?.isOwnerViewing ?? false,
    hasSubscribeControl: true,
    officialSubscription: readPageOfficialSubscription({
      response,
      searchRoot: contents,
      channelId
    }),
    collaborators: readCollaborators({
      response,
      searchRoot: findValueByKey({
        root: contents,
        keys: OWNER_RENDERER_KEYS,
        isMatch: isRecord
      })
    })
  };
  return pageChannel;
}
