import { type FeedVideo, feedVideoSchema, VIDEO_DESCRIPTION_MAX_LENGTH } from "@/lib/schemas/feed-video";
import { WHITESPACE_RUN_PATTERN } from "@/lib/utils/text";
import { isShortsUrl } from "@/lib/youtube/site";
import { buildVideoThumbnailUrl } from "@/lib/youtube/video/video-thumbnail";
import { z } from "@/lib/zod";

const URL_PATTERN = /https?:\/\/\S+/g;
const XML_MIME_TYPE = "application/xml";
const FEED_TAG = "feed";
const ENTRY_TAG = "entry";

/**
 * The part of a description that says what the video is: links (sponsors, socials) dropped, whitespace collapsed, cut
 * to a bounded length on whole code points
 */
export function summarizeDescription(description: string) {
  const text = description.replaceAll(URL_PATTERN, " ").replaceAll(WHITESPACE_RUN_PATTERN, " ").trim();
  return Array.from(text).slice(0, VIDEO_DESCRIPTION_MAX_LENGTH).join("").trim();
}

const rssEntrySchema = z
  .looseObject({
    videoId: z.string(),
    channelId: z.string(),
    title: z.string(),
    published: z.string(),
    author: z.looseObject({
      name: z.string()
    }),
    /** The upload's page: `/shorts/<id>` for a Short, a watch URL for any other upload */
    link: z
      .array(z.looseObject({ href: z.string() }))
      .optional()
      .catch(undefined),
    group: z
      .looseObject({
        thumbnail: z
          .looseObject({
            url: z.url()
          })
          .optional()
          .catch(undefined),
        description: z.string().optional().catch(undefined)
      })
      .optional()
      .catch(undefined)
  })
  .transform(entry => {
    const description = summarizeDescription(entry.group?.description ?? "");
    return {
      videoId: entry.videoId,
      channelId: entry.channelId,
      channelTitle: entry.author.name,
      title: entry.title,
      publishedAt: Date.parse(entry.published),
      thumbnailUrl: entry.group?.thumbnail?.url ?? buildVideoThumbnailUrl(entry.videoId),
      isShort: entry.link?.some(link => isShortsUrl(link.href)) ?? false,
      ...(description && {
        description
      })
    };
  })
  .pipe(feedVideoSchema);

/** The direct children of an element by their name without the namespace prefix (`yt:videoId` -> `videoId`) */
function childrenNamed({ elParent, name }: { elParent: Element | undefined; name: string }) {
  return Array.from(elParent?.children ?? []).filter(elChild => elChild.localName === name);
}

function readText({ elParent, name }: { elParent: Element | undefined; name: string }) {
  return (
    childrenNamed({
      elParent,
      name
    })[0]?.textContent ?? undefined
  );
}

/** One entry as plain fields, every value a string (a title like "1984" stays text) */
function readEntry(elEntry: Element) {
  const [elAuthor] = childrenNamed({
    elParent: elEntry,
    name: "author"
  });
  const [elGroup] = childrenNamed({
    elParent: elEntry,
    name: "group"
  });
  const [elThumbnail] = childrenNamed({
    elParent: elGroup,
    name: "thumbnail"
  });
  return {
    videoId: readText({
      elParent: elEntry,
      name: "videoId"
    }),
    channelId: readText({
      elParent: elEntry,
      name: "channelId"
    }),
    title: readText({
      elParent: elEntry,
      name: "title"
    }),
    published: readText({
      elParent: elEntry,
      name: "published"
    }),
    author: {
      name: readText({
        elParent: elAuthor,
        name: "name"
      })
    },
    link: childrenNamed({
      elParent: elEntry,
      name: "link"
    }).map(elLink => ({
      href: elLink.getAttribute("href") ?? undefined
    })),
    group: {
      thumbnail: {
        url: elThumbnail?.getAttribute("url") ?? undefined
      },
      description: readText({
        elParent: elGroup,
        name: "description"
      })
    }
  };
}

/**
 * Reads a channel's Atom upload feed with the browser's own `DOMParser`, so it runs only where one exists (a page,
 * not Chromium's service worker); null when the document is not a feed at all
 */
export function parseRssFeed(xml: string) {
  const document = new DOMParser().parseFromString(xml, XML_MIME_TYPE);
  const isFeed = document.documentElement?.localName === FEED_TAG && !document.querySelector("parsererror");
  if (!isFeed) {
    return null;
  }

  const videos: FeedVideo[] = [];
  for (const elEntry of childrenNamed({
    elParent: document.documentElement,
    name: ENTRY_TAG
  })) {
    const parsedEntry = rssEntrySchema.safeParse(readEntry(elEntry));
    if (parsedEntry.success) {
      videos.push(parsedEntry.data);
    }
  }
  return videos;
}
