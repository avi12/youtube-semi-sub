import {
  pruneChannelCaches,
  refreshAllChannels,
  refreshChannel,
  refreshChannels,
  UPLOADS_UNAVAILABLE_ERROR
} from "./channel-cache";
import { channelIdSchema } from "@/lib/channel";
import { MessageType, onMessage } from "@/lib/messaging/extension-messaging";
import type { SemiSubscriptions } from "@/lib/semi-subscription";
import { semiSubscriptionsItem } from "@/lib/storage";
import { z } from "@/lib/zod";
import { browser } from "#imports";

const REFRESH_ALARM_NAME = "refresh-channels";
const REFRESH_PERIOD_MINUTES = 15;
const INVALID_CHANNEL_ID_ERROR = "Invalid channel id";

const refreshChannelDataSchema = z.object({
  channelId: channelIdSchema
});

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
  await pruneChannelCaches();
  await refreshAllChannels({
    isForced: false
  });
}

async function handleSubscriptionsChange({ subscriptions, previousSubscriptions }: {
  subscriptions: SemiSubscriptions;
  previousSubscriptions: SemiSubscriptions;
}) {
  const isChannelRemoved = Object.keys(previousSubscriptions)
    .some(channelId => !Object.hasOwn(subscriptions, channelId));
  if (isChannelRemoved) {
    await pruneChannelCaches();
  }

  await refreshChannels({
    channelIds: Object.keys(subscriptions).filter(channelId => !Object.hasOwn(previousSubscriptions, channelId)),
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
      refreshAllChannels({
        isForced: false
      }).catch(console.error);
    }
  });

  semiSubscriptionsItem.watch((subscriptions, previousSubscriptions) => {
    handleSubscriptionsChange({
      subscriptions,
      previousSubscriptions
    }).catch(console.error);
  });

  onMessage(MessageType.refreshChannel, async ({ data }) => {
    const parsed = refreshChannelDataSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(INVALID_CHANNEL_ID_ERROR);
    }

    return await refreshChannel(parsed.data.channelId);
  });

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

  // Alarms can be lost (the extension was disabled, or the browser dropped them on restart) - restore on every wake
  ensureRefreshAlarm().catch(console.error);
}
