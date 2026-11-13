import { CHANNEL_ID_SOURCE, type ChannelInfo, channelInfoSchema } from "@/lib/schemas/channel";
import { browseEndpointSchema, channelMetadataRendererSchema } from "@/lib/youtube/schemas/browse";
import { textRunSchema } from "@/lib/youtube/schemas/text";
import { type Thumbnail, thumbnailListSchema, thumbnailSchema } from "@/lib/youtube/schemas/thumbnail";
import { VIDEO_ID_SOURCE, YOUTUBE_ORIGIN } from "@/lib/youtube/site";
import { z } from "@/lib/zod";

// Pure readers over a page's InnerTube data ({ response, playerResponse }), shared by www and m.youtube.com

export enum PageKind {
  watch = "watch",
  channel = "channel"
}

const WATCH_PATH_PATTERN = new RegExp(`^/(?:watch$|live/${VIDEO_ID_SOURCE}$)`);
const CHANNEL_PATH_PATTERN = new RegExp(`^/(?:@[^/]+|channel/${CHANNEL_ID_SOURCE}|c/[^/]+|user/[^/]+)(?:/|$)`);
const CHANNEL_ID_IN_TEXT_PATTERN = new RegExp(CHANNEL_ID_SOURCE);
const HANDLE_PATH_PATTERN = /^\/(@[^/]+)/;
const HANDLE_IN_TEXT_PATTERN = /@[\w.-]+/;
const COLLABORATOR_LIST_KEY = "listItems";
const PROTOCOL_RELATIVE_PREFIX = "//";
const PREFERRED_AVATAR_SIZE = 88;
const MAX_SEARCH_DEPTH = 40;
const OWNER_RENDERER_KEYS = ["videoOwnerRenderer", "slimOwnerRenderer"];
const SUBSCRIBE_CONTROL_KEYS = ["subscribeButtonViewModel", "subscribeButtonRenderer"];
const SUBSCRIBE_BUTTON_RENDERER_KEYS = ["subscribeButtonRenderer"];

const pageDataSchema = z.looseObject({
  response: z.unknown().optional(),
  playerResponse: z.unknown().optional()
});
type PageData = z.infer<typeof pageDataSchema>;

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

const frameworkMutationsSchema = z.looseObject({
  frameworkUpdates: z.looseObject({
    entityBatchUpdate: z.looseObject({
      mutations: z.array(z.unknown())
    })
  })
});

const subscriptionMutationSchema = z.looseObject({
  payload: z.looseObject({
    subscriptionStateEntity: z.looseObject({
      key: z.string(),
      subscribed: z.boolean()
    })
  })
});

const subscribeButtonRendererSchema = z.looseObject({
  channelId: z.string(),
  subscribed: z.boolean()
});

/** The channel a watch or channel page is about, plus what the page data says about the viewer's relation to it */
export const pageChannelSchema = z.object({
  kind: z.enum(PageKind),
  channel: channelInfoSchema,
  videoId: z.string().optional(),
  isOwnedByViewer: z.boolean(),
  hasSubscribeControl: z.boolean(),
  officialSubscription: z.boolean().optional(),
  /** Every channel of a collaboration, uploader included; empty for a video with one channel */
  collaborators: z.array(channelInfoSchema.extend({ isSubscribed: z.boolean().optional() }))
});
export type PageChannel = z.infer<typeof pageChannelSchema>;

export function getPageKind(pathname: string) {
  if (WATCH_PATH_PATTERN.test(pathname)) {
    return PageKind.watch;
  }

  if (CHANNEL_PATH_PATTERN.test(pathname)) {
    return PageKind.channel;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Searches a renderer tree for the first value stored under one of `keys` that `isMatch` accepts */
function findValueByKey({
  root,
  keys,
  isMatch
}: {
  root: unknown;
  keys: string[];
  isMatch: (candidate: unknown) => boolean;
}) {
  const pending = [
    {
      value: root,
      depth: 0
    }
  ];
  for (let next = pending.pop(); next; next = pending.pop()) {
    const { value, depth } = next;
    const isTooDeep = depth > MAX_SEARCH_DEPTH;
    if (!isRecord(value) || isTooDeep) {
      continue;
    }

    for (const key in value) {
      const child = value[key];
      const isWantedMatch = keys.includes(key) && isMatch(child);
      if (isWantedMatch) {
        return child;
      }

      pending.push({
        value: child,
        depth: depth + 1
      });
    }
  }
  return undefined;
}

function toAbsoluteUrl(url: string) {
  return url.startsWith(PROTOCOL_RELATIVE_PREFIX) ? `https:${url}` : url;
}

/** The smallest avatar that still looks sharp at the dialog's size, else the largest there is */
function pickAvatarUrl(thumbnails: Thumbnail[] | undefined) {
  const bySize = (thumbnails ?? []).toSorted((left, right) => (left.width ?? 0) - (right.width ?? 0));
  const sharpEnough = bySize.find(thumbnail => (thumbnail.width ?? 0) >= PREFERRED_AVATAR_SIZE);
  const picked = sharpEnough ?? bySize.at(-1);
  return picked && toAbsoluteUrl(picked.url);
}

/** "/@mkbhd", "http://www.youtube.com/@mkbhd/videos" -> "@mkbhd" */
export function toChannelHandle(urlOrPath: string | undefined) {
  if (!urlOrPath) {
    return undefined;
  }

  const { pathname } = new URL(urlOrPath, YOUTUBE_ORIGIN);
  const handle = HANDLE_PATH_PATTERN.exec(pathname)?.[1];
  return handle && decodeURIComponent(handle);
}

/** Entity keys are base64 protobufs that embed the channel id, so they map straight to a channel */
function decodeEntityChannelId(key: string) {
  try {
    return CHANNEL_ID_IN_TEXT_PATTERN.exec(atob(decodeURIComponent(key)))?.[0];
  } catch {
    return undefined;
  }
}

/** The `subscriptionStateEntity` values a response seeds YouTube's entity store with, by channel id */
export function readSubscriptionEntities(response: unknown) {
  const subscribedByChannel = new Map<string, boolean>();
  const parsed = frameworkMutationsSchema.safeParse(response);
  if (!parsed.success) {
    return subscribedByChannel;
  }

  for (const mutation of parsed.data.frameworkUpdates.entityBatchUpdate.mutations) {
    const parsedMutation = subscriptionMutationSchema.safeParse(mutation);
    const entity = parsedMutation.success ? parsedMutation.data.payload.subscriptionStateEntity : null;
    const channelId = entity && decodeEntityChannelId(entity.key);
    if (entity && channelId) {
      subscribedByChannel.set(channelId, entity.subscribed);
    }
  }
  return subscribedByChannel;
}

function readOfficialSubscription({
  response,
  searchRoot,
  channelId
}: {
  response: unknown;
  searchRoot: unknown;
  channelId: string;
}) {
  const entitySubscription = readSubscriptionEntities(response).get(channelId);
  if (entitySubscription !== undefined) {
    return entitySubscription;
  }

  const renderer = subscribeButtonRendererSchema.safeParse(
    findValueByKey({
      root: searchRoot,
      keys: SUBSCRIBE_BUTTON_RENDERER_KEYS,
      isMatch(candidate) {
        const parsed = subscribeButtonRendererSchema.safeParse(candidate);
        return parsed.success && parsed.data.channelId === channelId;
      }
    })
  );
  return renderer.success ? renderer.data.subscribed : undefined;
}

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

function toChannelInfo(candidate: ChannelInfo) {
  const parsed = channelInfoSchema.safeParse(candidate);
  if (parsed.success) {
    return parsed.data;
  }

  // A malformed avatar must not cost the whole channel
  const withoutAvatar = channelInfoSchema.safeParse({
    ...candidate,
    avatarUrl: undefined
  });
  return withoutAvatar.success ? withoutAvatar.data : null;
}

function readWatchChannel({ response, playerResponse }: PageData) {
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
    kind: PageKind.watch,
    channel,
    videoId: videoDetails?.videoId,
    isOwnedByViewer: videoDetails?.isOwnerViewing ?? false,
    hasSubscribeControl: true,
    officialSubscription: readOfficialSubscription({
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

function readChannelPageChannel(response: unknown) {
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
    kind: PageKind.channel,
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

/**
 * The channel a watch or channel page is about, read from the page's data, plus what the data says about the viewer's
 * relation to it. `hasSubscribeControl` is false on a channel page without YouTube's Subscribe button - the viewer's
 * own channel when signed in
 */
export function readPageChannel({ pageData, kind }: { pageData: unknown; kind: PageKind }) {
  const parsed = pageDataSchema.safeParse(pageData);
  if (!parsed.success) {
    return null;
  }

  if (kind === PageKind.watch) {
    return readWatchChannel(parsed.data);
  }

  return readChannelPageChannel(parsed.data.response);
}
