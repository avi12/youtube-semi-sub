import { fetchText } from "./fetch-text";
import { buildVideoThumbnailUrl } from "./video-thumbnail";
import { type FeedVideo, feedVideoSchema } from "@/lib/schemas/feed-video";
import { parseFirstRelativeTime } from "@/lib/youtube/relative-time";
import { z } from "@/lib/zod";

// Fallback for when RSS is down: the channel's Videos tab. Its page embeds the InnerTube browse response as
// `ytInitialData`. A direct InnerTube POST is not an option - the browser stamps the extension's Origin on it and
// YouTube answers 403 - while a GET carries no Origin

const YOUTUBE_ORIGIN = "https://www.youtube.com";
const INTERFACE_LANGUAGE_PARAM = "hl";
// Relative publish times ("3 hours ago") are only parsed in English
const ENGLISH_INTERFACE_LANGUAGE = "en";
const INITIAL_DATA_START_MARKER = "var ytInitialData = ";
const INITIAL_DATA_END_MARKER = ";</script>";
const LOCKUP_VIDEO_CONTENT_TYPE = "LOCKUP_CONTENT_TYPE_VIDEO";

const textSchema = z.looseObject({
  simpleText: z.string().optional(),
  runs: z
    .array(
      z.looseObject({
        text: z.string()
      })
    )
    .optional()
});
type InnerTubeText = z.infer<typeof textSchema>;

const videoRendererSchema = z.looseObject({
  videoId: z.string(),
  title: textSchema,
  publishedTimeText: textSchema.optional()
});
type VideoRenderer = z.infer<typeof videoRendererSchema>;

const metadataPartSchema = z.looseObject({
  text: z
    .looseObject({
      content: z.string()
    })
    .optional(),
  accessibilityLabel: z.string().optional()
});

const lockupViewModelSchema = z.looseObject({
  contentId: z.string(),
  contentType: z.string().optional(),
  metadata: z.looseObject({
    lockupMetadataViewModel: z.looseObject({
      title: z.looseObject({
        content: z.string()
      }),
      metadata: z
        .looseObject({
          contentMetadataViewModel: z
            .looseObject({
              metadataRows: z
                .array(
                  z.looseObject({
                    metadataParts: z.array(metadataPartSchema).optional()
                  })
                )
                .optional()
            })
            .optional()
        })
        .optional()
    })
  })
});
type LockupViewModel = z.infer<typeof lockupViewModelSchema>;

const gridItemSchema = z.looseObject({
  richItemRenderer: z.looseObject({
    content: z.looseObject({
      lockupViewModel: lockupViewModelSchema.optional(),
      videoRenderer: videoRendererSchema.optional()
    })
  })
});
type GridItem = z.infer<typeof gridItemSchema>;

const channelBrowseResponseSchema = z.looseObject({
  contents: z.looseObject({
    twoColumnBrowseResultsRenderer: z.looseObject({
      tabs: z.array(
        z.looseObject({
          tabRenderer: z
            .looseObject({
              content: z
                .looseObject({
                  richGridRenderer: z
                    .looseObject({
                      contents: z.array(z.unknown())
                    })
                    .optional()
                })
                .optional()
            })
            .optional()
        })
      )
    })
  }),
  metadata: z.looseObject({
    channelMetadataRenderer: z.looseObject({
      title: z.string(),
      externalId: z.string()
    })
  })
});
type ChannelBrowseResponse = z.infer<typeof channelBrowseResponseSchema>;

const gridUploadSchema = z.object({
  videoId: z.string(),
  title: z.string(),
  /** Every text that may carry the relative publish time, most precise first */
  timeTexts: z.array(z.string())
});
type GridUpload = z.infer<typeof gridUploadSchema>;

function readText(text: InnerTubeText) {
  return text.simpleText ?? text.runs?.map(run => run.text).join("") ?? "";
}

function readLockup(lockup: LockupViewModel) {
  const isVideo = lockup.contentType === undefined || lockup.contentType === LOCKUP_VIDEO_CONTENT_TYPE;
  if (!isVideo) {
    return null;
  }

  const { lockupMetadataViewModel } = lockup.metadata;
  const rows = lockupMetadataViewModel.metadata?.contentMetadataViewModel?.metadataRows ?? [];
  const timeTexts = rows
    .flatMap(row => row.metadataParts ?? [])
    .flatMap(part => [part.accessibilityLabel, part.text?.content])
    .filter(text => text !== undefined);
  const upload: GridUpload = {
    videoId: lockup.contentId,
    title: lockupMetadataViewModel.title.content,
    timeTexts
  };
  return upload;
}

function readVideoRenderer(renderer: VideoRenderer) {
  const upload: GridUpload = {
    videoId: renderer.videoId,
    title: readText(renderer.title),
    timeTexts: renderer.publishedTimeText ? [readText(renderer.publishedTimeText)] : []
  };
  return upload;
}

function readGridItem(item: GridItem) {
  const { lockupViewModel, videoRenderer } = item.richItemRenderer.content;
  if (lockupViewModel) {
    return readLockup(lockupViewModel);
  }

  return videoRenderer ? readVideoRenderer(videoRenderer) : null;
}

// Live and upcoming videos carry no relative time - they count as published now
function findPublishedAt({ timeTexts, now }: {
  timeTexts: string[];
  now: number;
}) {
  return parseFirstRelativeTime({
    texts: timeTexts,
    now
  })?.approxTime ?? now;
}

function findGridContents(response: ChannelBrowseResponse) {
  for (const tab of response.contents.twoColumnBrowseResultsRenderer.tabs) {
    const contents = tab.tabRenderer?.content?.richGridRenderer?.contents;
    if (contents) {
      return contents;
    }
  }
  return null;
}

/** Pulls the embedded InnerTube response out of a youtube.com page */
export function extractInitialData(html: string) {
  const iMarker = html.indexOf(INITIAL_DATA_START_MARKER);
  if (iMarker === -1) {
    return null;
  }

  const iStart = iMarker + INITIAL_DATA_START_MARKER.length;
  const iEnd = html.indexOf(INITIAL_DATA_END_MARKER, iStart);
  if (iEnd === -1) {
    return null;
  }

  try {
    const initialData: unknown = JSON.parse(html.slice(iStart, iEnd));
    return initialData;
  } catch {
    return null;
  }
}

/** Reads the uploads of a channel's Videos tab (newest first); publish times are approximated from relative text */
export function parseVideosTab({ response, now }: {
  response: unknown;
  now: number;
}) {
  const parsed = channelBrowseResponseSchema.safeParse(response);
  if (!parsed.success) {
    return null;
  }

  const gridContents = findGridContents(parsed.data);
  if (!gridContents) {
    return null;
  }

  const { title: channelTitle, externalId: channelId } = parsed.data.metadata.channelMetadataRenderer;
  const videos: FeedVideo[] = [];
  for (const item of gridContents) {
    const parsedItem = gridItemSchema.safeParse(item);
    const upload = parsedItem.success ? readGridItem(parsedItem.data) : null;
    if (!upload) {
      continue;
    }

    const video = feedVideoSchema.safeParse({
      videoId: upload.videoId,
      channelId,
      channelTitle,
      title: upload.title,
      publishedAt: findPublishedAt({
        timeTexts: upload.timeTexts,
        now
      }),
      thumbnailUrl: buildVideoThumbnailUrl(upload.videoId)
    });
    if (video.success) {
      videos.push(video.data);
    }
  }
  return videos;
}

/** The channel's Videos tab uploads, or null when the page is unavailable or unreadable */
export async function fetchVideosTabUploads(channelId: string) {
  const url = new URL(`/channel/${channelId}/videos`, YOUTUBE_ORIGIN);
  url.searchParams.set(INTERFACE_LANGUAGE_PARAM, ENGLISH_INTERFACE_LANGUAGE);
  // Cookies carry the user's consent choice - without them EU visitors get the consent interstitial instead
  const html = await fetchText({
    url,
    credentials: "include"
  });
  if (html === null) {
    return null;
  }

  return parseVideosTab({
    response: extractInitialData(html),
    now: Date.now()
  });
}
