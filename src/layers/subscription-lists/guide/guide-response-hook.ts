import { buildSemiGuideEntry, patchGuideResponse, readGuideSubscriptions } from "./guide-data";
import { getPageState } from "@/lib/page/page-state";
import { parseJson } from "@/lib/utils/json";
import { InnerTubePath, isYouTubeUrlAt } from "@/lib/youtube/site";
import { applySubscriptionSnapshot } from "#channel-button";
import { listFollowedSubscriptions, listSemiSubscriptions } from "#subscription-lists/semi-channels";

// www.youtube.com fetches the sidebar from /youtubei/v1/guide (and re-fetches it when it expires) and reads the body
// with text(). Patching the body puts the semi-subscribed channels into the very first render of the guide and of
// the mini guide's Subscriptions flyout. Every other response passes through the previous override untouched

function isGuideResponse(response: Response) {
  return isYouTubeUrlAt({
    url: response.url,
    pathname: InnerTubePath.guide
  });
}

function readSemiGuideEntries() {
  return listFollowedSubscriptions(listSemiSubscriptions(getPageState())).map(buildSemiGuideEntry);
}

/** A body that fails to patch is handed on exactly as YouTube sent it */
function patchSafely<T>(patch: () => T | null) {
  try {
    return patch();
  } catch {
    return null;
  }
}

function patchGuideBody(body: unknown) {
  return patchSafely(() => patchGuideResponse({
    response: body,
    entries: readSemiGuideEntries()
  }));
}

/** YouTube's own body, before ours are added: the guide lists the user's real subscriptions */
function syncOfficialSubscriptions(body: unknown) {
  const readIsSubscribed = readGuideSubscriptions(body);
  if (readIsSubscribed) {
    applySubscriptionSnapshot(readIsSubscribed);
  }
}

/** Chains onto whatever override is installed already (the feed hook goes first), so both keep working */
export function installGuideResponseHook() {
  const previousJson = Response.prototype.json;
  const previousText = Response.prototype.text;

  async function json(this: Response) {
    const body: unknown = await previousJson.call(this);
    if (!isGuideResponse(this)) {
      return body;
    }

    syncOfficialSubscriptions(body);
    return patchGuideBody(body) ?? body;
  }

  async function text(this: Response) {
    const body = await previousText.call(this);
    if (!isGuideResponse(this)) {
      return body;
    }

    const parsedBody = parseJson(body);
    syncOfficialSubscriptions(parsedBody);
    const patched = patchGuideBody(parsedBody);
    return patched ? JSON.stringify(patched) : body;
  }

  Response.prototype.json = json;
  Response.prototype.text = text;
}
