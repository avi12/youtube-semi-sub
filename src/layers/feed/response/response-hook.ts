import { readInitialDataHtml, readSubscriptionsFeed } from "./feed-response";
import { getPageState } from "@/lib/page/page-state";
import { interceptInitialData } from "@/lib/youtube/page/initial-data-hook";
import { getYouTubeSite, YouTubeSite } from "@/lib/youtube/site";
import {
  composeForPageState,
  loadNativesFor,
  planForPageState,
  recordFeedChange,
  waitForPageState
} from "#feed/feed-session";

// Semi-sub videos are injected where every reader of the subscriptions feed gets its data: the Response body
// (YouTube's own /browse fetch, YouTube Auto Feed's clone of it and its own polls) and, on m.youtube.com, the
// ytInitialData a hard load renders from. Patching Response.prototype instead of wrapping fetch keeps this
// independent of which extension's fetch wrapper ends up outermost. Anything that is not the feed passes through
// untouched, and any failure falls back to the original data

const BROWSE_URL_PATTERN = /^https:\/\/(?:www|m)\.youtube\.com\/youtubei\/v1\/browse(?:[?#]|$)/;
const FEED_PAGE_URL_PATTERN = /^https:\/\/(?:www|m)\.youtube\.com\/feed\/subscriptions\/?(?:[?#]|$)/;
// The longest a feed response is held back for native renderers; slower ones are inserted live afterwards
const RESPONSE_PATCH_BUDGET_MS = 1500;
const NO_REMOVALS: ReadonlySet<string> = new Set();

/** Synchronous: uses whatever page state and native renderers are already loaded */
function patchFeedDataNow(data: unknown) {
  const feed = readSubscriptionsFeed(data);
  const state = getPageState();
  if (!feed || !state?.isExtensionEnabled) {
    return null;
  }

  const composed = composeForPageState({
    contents: feed.contents,
    state,
    removedVideoIds: NO_REMOVALS
  });
  if (!composed) {
    return null;
  }

  recordFeedChange(composed);
  return feed.withContents(composed.contents);
}

async function patchFeedData(data: unknown) {
  const feed = readSubscriptionsFeed(data);
  if (!feed) {
    return null;
  }

  const deadline = Date.now() + RESPONSE_PATCH_BUDGET_MS;
  const state = await waitForPageState(deadline);
  if (!state?.isExtensionEnabled) {
    return null;
  }

  const { insertedVideos } = planForPageState({
    contents: feed.contents,
    state,
    removedVideoIds: NO_REMOVALS
  });
  await loadNativesFor({
    videos: insertedVideos,
    deadline
  });
  return patchFeedDataNow(data);
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
    return BROWSE_URL_PATTERN.test(this.url) ? readPatchedJson(this) : originalJson.call(this);
  }

  function text(this: Response) {
    if (BROWSE_URL_PATTERN.test(this.url)) {
      return readPatchedText({
        response: this,
        patch: patchBrowseText
      });
    }

    if (FEED_PAGE_URL_PATTERN.test(this.url)) {
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

  // www renders a hard load as is and inserts live, animated, with full native renderers. m.youtube.com renders it
  // from `ytInitialData`, patched as it is assigned (the first assignment, a JSON string, passes through)
  if (getYouTubeSite() === YouTubeSite.mobile) {
    interceptInitialData(value => patchFeedDataNow(value) ?? value);
  }
}
