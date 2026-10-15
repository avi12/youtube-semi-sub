import { buildSemiGuideEntry, patchGuideResponse } from "./guide-data";
import { listSemiSubscriptions } from "./semi-channels";
import { getPageState } from "@/lib/page/page-state";

// www.youtube.com fetches the sidebar from /youtubei/v1/guide (and re-fetches it when it expires) and reads the body
// with text(). Patching the body puts the semi-subscribed channels into the very first render of the guide and of
// the mini guide's Subscriptions flyout. Every other response passes through the previous override untouched

const GUIDE_PATHNAME = "/youtubei/v1/guide";

function isGuideResponse(response: Response) {
  const hasUrl = response.url !== "";
  return hasUrl && new URL(response.url).pathname === GUIDE_PATHNAME;
}

function readSemiGuideEntries() {
  return listSemiSubscriptions(getPageState()).map(buildSemiGuideEntry);
}

/** A body that fails to patch is handed on exactly as YouTube sent it */
function patchSafely<T>(patch: () => T | null) {
  try {
    return patch();
  } catch {
    return null;
  }
}

function parseJson(text: string) {
  try {
    const body: unknown = JSON.parse(text);
    return body;
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

function patchGuideBodyText(text: string) {
  const patched = patchGuideBody(parseJson(text));
  return patched ? JSON.stringify(patched) : null;
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

    return patchGuideBody(body) ?? body;
  }

  async function text(this: Response) {
    const body = await previousText.call(this);
    if (!isGuideResponse(this)) {
      return body;
    }

    return patchGuideBodyText(body) ?? body;
  }

  Response.prototype.json = json;
  Response.prototype.text = text;
}
