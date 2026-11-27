import { readIsSignedIn } from "#channel-button/page/page-data-source";
import { readSubscriptionEntities } from "#channel-button/page/readers/subscription-state";
import { parseJson } from "@/lib/utils/json";
import { interceptInitialData } from "@/lib/youtube/page/initial-data-hook";
import { captureResponseReaders } from "@/lib/youtube/page/response-readers";
import { InnerTubePath, isYouTubeUrlAt } from "@/lib/youtube/site";
import { z } from "@/lib/zod";

import { applySubscriptionSnapshot } from "./official-subscription";

// MAIN world, document_start: YouTube's raw InnerTube data says whether the user is subscribed to every channel it
// shows (`subscriptionStateEntity`), but only on the way in - the app drops `frameworkUpdates` once it stored them.
// So it is read from a hard load's `ytInitialData` and from every /browse and /next body, which is never changed here

const SNAPSHOT_PATHNAMES = [InnerTubePath.BROWSE, InnerTubePath.NEXT];

/** m.youtube.com assigns `ytInitialData` as JSON text first, and only that copy keeps `frameworkUpdates` */
const initialDataTextSchema = z.string();

function isSnapshotResponse(response: Response) {
  return SNAPSHOT_PATHNAMES.some(pathname =>
    isYouTubeUrlAt({
      url: response.url,
      pathname
    })
  );
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
    const parsed = initialDataTextSchema.safeParse(data);
    syncSubscriptionEntities(parsed.success ? parseJson(parsed.data) : data);
    return data;
  });

  const { json: previousJson, text: previousText } = captureResponseReaders();

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
