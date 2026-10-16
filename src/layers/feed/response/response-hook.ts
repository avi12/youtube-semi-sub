import { readInitialDataHtml, readSubscriptionsContinuation, readSubscriptionsFeed } from "./feed-response";
import type { PageState } from "@/lib/messaging/page-messaging";
import { getPageState } from "@/lib/page/page-state";
import { interceptInitialData } from "@/lib/youtube/page/initial-data-hook";
import {
  FeedPathname,
  getYouTubeSite,
  InnerTubePath,
  isYouTubeUrlAt,
  YouTubeSite
} from "@/lib/youtube/site";
import {
  composeForPageState,
  findHiddenVideoIds,
  loadNativesFor,
  planForPageState,
  recordFeedChange,
  waitForPageState
} from "#feed/feed-session";
import { isHiddenVideoListHonored } from "#feed/live/ytaf";

// Semi-sub videos are injected where every reader of the subscriptions feed gets its data: the Response body
// (YouTube's own /browse fetch, YouTube Auto Feed's clone of it and its own polls) and, on m.youtube.com, the
// ytInitialData a hard load renders from. Patching Response.prototype instead of wrapping fetch keeps this
// independent of which extension's fetch wrapper ends up outermost. Anything that is not the feed passes through
// untouched, and any failure falls back to the original data.
// The first page takes videos into its band and Shorts into its Shorts shelf. m puts its Shorts shelf on a later
// page, past the first page and outside the grid it writes live, so on m a later page's Shorts shelf is filled here
// too - with the Shorts no earlier page of the same load shelved. www's later pages are left to the live write.
// Every page loses the videos a subscribed channel's hide filter hides, from its band and its Shorts shelf. The first
// page also lists them beside its grid for a YouTube Auto Feed that reads the list, which would otherwise keep showing
// what it already shows

// The longest a feed response is held back for native renderers; slower ones are inserted live afterwards
const RESPONSE_PATCH_BUDGET_MS = 1500;
const NO_REMOVALS: ReadonlySet<string> = new Set();

/** The Shorts the current feed load put in a shelf already */
const shelvedShortIds = new Set<string>();

/** The first page's copy: other contents, and the hidden ids beside them */
type FirstPageCopy = Parameters<NonNullable<ReturnType<typeof readSubscriptionsFeed>>["withContents"]>[0];

/** A feed page and a copy of it with other contents; only the first page lists the hidden ids */
function readFeedPage(data: unknown) {
  const firstPage = readSubscriptionsFeed(data);
  if (firstPage) {
    return {
      contents: firstPage.contents,
      isLaterPage: false,
      withContents: firstPage.withContents
    };
  }

  const laterPage = readSubscriptionsContinuation(data);
  return laterPage && {
    contents: laterPage.contents,
    isLaterPage: true,
    withContents: ({ contents }: FirstPageCopy) => laterPage.withContents(contents)
  };
}

/**
 * What a page is filled from: a later page only takes the Shorts no earlier page shelved - and on www nothing, its
 * later pages only lose what is hidden
 */
function stateForPage({ state, isLaterPage }: {
  state: PageState;
  isLaterPage: boolean;
}) {
  if (!isLaterPage) {
    return state;
  }

  const isShelfFilledOnLaterPages = getYouTubeSite() === YouTubeSite.mobile;
  const pageState: PageState = {
    ...state,
    followedUploads: isShelfFilledOnLaterPages
      ? state.followedUploads.filter(video => video.isShort && !shelvedShortIds.has(video.videoId))
      : []
  };
  return pageState;
}

function recordShelvedShorts({ insertedIds, state }: {
  insertedIds: readonly string[];
  state: PageState;
}) {
  const shortIds = new Set(state.followedUploads.filter(video => video.isShort).map(video => video.videoId));
  for (const videoId of insertedIds) {
    if (shortIds.has(videoId)) {
      shelvedShortIds.add(videoId);
    }
  }
}

/**
 * Synchronous: uses whatever page state and native renderers are already loaded. Without `isInserting` the page only
 * loses what is hidden
 */
function patchFeedDataNow({ data, isInserting }: {
  data: unknown;
  isInserting: boolean;
}) {
  const page = readFeedPage(data);
  if (page && !page.isLaterPage) {
    shelvedShortIds.clear();
  }

  const state = getPageState();
  if (!page || !state?.isExtensionEnabled) {
    return null;
  }

  const hiddenIds = findHiddenVideoIds({
    contents: page.contents,
    state
  });
  const pageState = stateForPage({
    state,
    isLaterPage: page.isLaterPage
  });
  const composed = composeForPageState({
    contents: page.contents,
    state: isInserting ? pageState : {
      ...pageState,
      followedUploads: []
    },
    removedVideoIds: hiddenIds
  });
  const isHiddenListWritten = hiddenIds.size > 0 && !page.isLaterPage && isHiddenVideoListHonored();
  if (!composed && !isHiddenListWritten) {
    return null;
  }

  if (composed) {
    recordFeedChange(composed);
    recordShelvedShorts({
      insertedIds: composed.insertedIds,
      state
    });
  }

  return page.withContents({
    contents: composed?.contents ?? [...page.contents],
    hiddenVideoIds: isHiddenListWritten ? [...hiddenIds] : null
  });
}

async function patchFeedData(data: unknown) {
  const page = readFeedPage(data);
  if (!page) {
    return null;
  }

  const deadline = Date.now() + RESPONSE_PATCH_BUDGET_MS;
  const state = await waitForPageState(deadline);
  if (!state?.isExtensionEnabled) {
    return null;
  }

  const { insertedVideos } = planForPageState({
    contents: page.contents,
    state: stateForPage({
      state,
      isLaterPage: page.isLaterPage
    }),
    removedVideoIds: NO_REMOVALS
  });
  await loadNativesFor({
    videos: insertedVideos,
    deadline
  });
  return patchFeedDataNow({
    data,
    isInserting: true
  });
}

async function patchBrowseText(text: string) {
  const patched = await patchFeedData(JSON.parse(text));
  return patched ? JSON.stringify(patched) : text;
}

async function patchFeedHtml(html: string) {
  const initialData = readInitialDataHtml(html);
  const patched = initialData && await patchFeedData(initialData.data);
  return initialData && patched ? initialData.withData(patched) : html;
}

function installResponsePatch() {
  // Whatever is current, so other extensions' overrides installed earlier stay in the chain
  const originalJson = Response.prototype.json;
  const originalText = Response.prototype.text;

  async function readPatchedJson(response: Response) {
    const data: unknown = JSON.parse(await originalText.call(response));
    const patched = await patchFeedData(data).catch(() => null);
    return patched ?? data;
  }

  async function readPatchedText({ response, patch }: {
    response: Response;
    patch: (text: string) => Promise<string>;
  }) {
    const text = await originalText.call(response);
    return patch(text).catch(() => text);
  }

  function json(this: Response) {
    const isBrowseResponse = isYouTubeUrlAt({
      url: this.url,
      pathname: InnerTubePath.browse
    });
    return isBrowseResponse ? readPatchedJson(this) : originalJson.call(this);
  }

  function text(this: Response) {
    const isBrowseResponse = isYouTubeUrlAt({
      url: this.url,
      pathname: InnerTubePath.browse
    });
    if (isBrowseResponse) {
      return readPatchedText({
        response: this,
        patch: patchBrowseText
      });
    }

    const isFeedPage = isYouTubeUrlAt({
      url: this.url,
      pathname: FeedPathname.subscriptions
    });
    if (isFeedPage) {
      return readPatchedText({
        response: this,
        patch: patchFeedHtml
      });
    }

    return originalText.call(this);
  }

  Response.prototype.json = json;
  Response.prototype.text = text;
}

export function installResponseHooks() {
  installResponsePatch();

  // A hard load renders from `ytInitialData`, patched as it is assigned (m's first assignment, a JSON string, passes
  // through). www only takes the hidden videos out there - a running YouTube Auto Feed would otherwise show them until
  // its first poll - and inserts live, animated, with full native renderers
  const isInsertingOnHardLoad = getYouTubeSite() === YouTubeSite.mobile;
  interceptInitialData(value => patchFeedDataNow({
    data: value,
    isInserting: isInsertingOnHardLoad
  }) ?? value);
}
