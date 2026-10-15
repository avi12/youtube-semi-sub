import { applySubscriptionSnapshot } from "./official-subscription";
import { parseJson } from "@/lib/utils/json";
import { interceptInitialData } from "@/lib/youtube/page/initial-data-hook";
import { InnerTubeEndpoint } from "@/lib/youtube/page/innertube";
import { YOUTUBE_ORIGIN } from "@/lib/youtube/site";
import { readSubscriptionEntities } from "#channel-button/page/channel-page-data";
import { readIsSignedIn } from "#channel-button/page/page-data-source";

// MAIN world, document_start: YouTube's raw InnerTube data says whether the user is subscribed to every channel it
// shows (`subscriptionStateEntity`), but only on the way in - the app drops `frameworkUpdates` once it stored them.
// So it is read from a hard load's `ytInitialData` and from every /browse and /next body, which is never changed here

const SNAPSHOT_PATHNAMES: ReadonlySet<string> = new Set(
  [InnerTubeEndpoint.browse, InnerTubeEndpoint.next].map(endpoint => new URL(endpoint, YOUTUBE_ORIGIN).pathname)
);

function isSnapshotResponse(response: Response) {
  const hasUrl = response.url !== "";
  return hasUrl && SNAPSHOT_PATHNAMES.has(new URL(response.url).pathname);
}

/** Signed out, every channel reads as not subscribed, which says nothing about the user */
export function syncSubscriptionEntities(data: unknown) {
  try {
    const subscribedByChannel = readSubscriptionEntities(data);
    const isSnapshot = subscribedByChannel.size > 0 && readIsSignedIn();
    if (isSnapshot) {
      applySubscriptionSnapshot(channelId => subscribedByChannel.get(channelId));
    }
  } catch {
    // Only ever reads - YouTube's data goes on as it came either way
  }
}

/** Chains onto whatever override is installed already and hands every body on exactly as it got it */
export function installSubscriptionEntityWatch() {
  interceptInitialData(data => {
    syncSubscriptionEntities(data);
    return data;
  });

  const previousJson = Response.prototype.json;
  const previousText = Response.prototype.text;

  async function json(this: Response) {
    const body: unknown = await previousJson.call(this);
    if (isSnapshotResponse(this)) {
      syncSubscriptionEntities(body);
    }

    return body;
  }

  async function text(this: Response) {
    const body = await previousText.call(this);
    if (isSnapshotResponse(this)) {
      syncSubscriptionEntities(parseJson(body));
    }

    return body;
  }

  Response.prototype.json = json;
  Response.prototype.text = text;
}
