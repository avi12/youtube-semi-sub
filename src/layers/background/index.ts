import { collectAiFilterKeys } from "@/lib/filter/ai-verdicts";
import { MessageType, onMessage } from "@/lib/messaging/extension-messaging";
import { isUploadsLengthFiltered, isUploadsWatched, type SemiSubscriptions } from "@/lib/schemas/semi-subscription";
import { semiSubscriptionsItem } from "@/lib/storage";
import { classifyPendingVideos, startAiMatch } from "#ai-match";
import {
  pruneChannelCaches,
  refreshAllChannels,
  refreshChannel,
  refreshChannels,
  UPLOADS_UNAVAILABLE_ERROR
} from "#background/cache/channel-cache";
import { browser } from "#imports";

const REFRESH_ALARM_NAME = "refresh-channels";
const REFRESH_PERIOD_MINUTES = 15;

async function createRefreshAlarm() {
  await browser.alarms.create(REFRESH_ALARM_NAME, {
    periodInMinutes: REFRESH_PERIOD_MINUTES
  });
}

async function ensureRefreshAlarm() {
  const alarm = await browser.alarms.get(REFRESH_ALARM_NAME);
  if (!alarm) {
    await createRefreshAlarm();
  }
}

async function handleInstalled() {
  // Re-created rather than ensured, so an update applies a changed period
  await createRefreshAlarm();
  // Refetched before pruning: an update may have dropped the cache, and AI verdicts are kept only for cached videos
  await refreshAllChannels({
    isForced: false
  });
  await pruneChannelCaches();
}

/** An AI filter was edited away or removed, so the verdicts judged under it may have no user left */
function hasDroppedAiFilter({ subscriptions, previousSubscriptions }: Parameters<typeof handleSubscriptionsChange>[0]) {
  for (const channelId in previousSubscriptions) {
    const keys = collectAiFilterKeys(subscriptions[channelId]);
    const isDropped = [...collectAiFilterKeys(previousSubscriptions[channelId])].some(key => !keys.has(key));
    if (isDropped) {
      return true;
    }
  }
  return false;
}

async function handleSubscriptionsChange({ subscriptions, previousSubscriptions }: {
  subscriptions: SemiSubscriptions;
  previousSubscriptions: SemiSubscriptions;
}) {
  // Never pruned on a plain addition: the dialog's preview verdicts for a newly saved channel are kept that way
  const isChannelRemoved = Object.keys(previousSubscriptions)
    .some(channelId => !Object.hasOwn(subscriptions, channelId));
  const isPruneNeeded = isChannelRemoved || hasDroppedAiFilter({
    subscriptions,
    previousSubscriptions
  });
  if (isPruneNeeded) {
    await pruneChannelCaches();
  }

  // Fetched as soon as their uploads matter: a new channel, an unsubscribe, a hide filter that starts hiding, a filter
  // that starts reading lengths
  await refreshChannels({
    channelIds: Object.values(subscriptions)
      .filter(subscription => {
        const previous = previousSubscriptions[subscription.channelId];
        const wasWatched = !!previous && isUploadsWatched(previous);
        const wasLengthFiltered = !!previous && isUploadsLengthFiltered(previous);
        const isNewlyWatched = isUploadsWatched(subscription) && !wasWatched;
        return isNewlyWatched || isUploadsLengthFiltered(subscription) && !wasLengthFiltered;
      })
      .map(({ channelId }) => channelId),
    isForced: true
  });
}

export function startBackground() {
  // Every listener is registered synchronously, so the event that cold-wakes the worker is still delivered to it
  browser.runtime.onInstalled.addListener(() => {
    handleInstalled().catch(console.error);
  });

  browser.runtime.onStartup.addListener(() => {
    refreshAllChannels({
      isForced: false
    }).catch(console.error);
  });

  browser.alarms.onAlarm.addListener(alarm => {
    const isRefreshAlarm = alarm.name === REFRESH_ALARM_NAME;
    if (isRefreshAlarm) {
      // New uploads trigger classification by themselves; this also retries what an earlier pass left pending
      refreshAllChannels({
        isForced: false
      }).then(() => classifyPendingVideos()).catch(console.error);
    }
  });

  semiSubscriptionsItem.watch((subscriptions, previousSubscriptions) => {
    handleSubscriptionsChange({
      subscriptions,
      previousSubscriptions
    }).catch(console.error);
  });

  onMessage(MessageType.refreshChannel, ({ channelId }) => refreshChannel(channelId));

  onMessage(MessageType.refreshAllChannels, async () => {
    const isRefreshed = await refreshAllChannels({
      isForced: true
    });
    if (!isRefreshed) {
      throw new Error(UPLOADS_UNAVAILABLE_ERROR);
    }
  });

  onMessage(MessageType.refreshStaleChannels, async () => {
    await refreshAllChannels({
      isForced: false
    });
  });

  startAiMatch();

  // Alarms can be lost (the extension was disabled, or the browser dropped them on restart) - restore on every wake
  ensureRefreshAlarm().catch(console.error);
}
