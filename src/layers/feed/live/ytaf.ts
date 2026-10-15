import { z } from "@/lib/zod";

// YouTube Auto Feed (avi12/youtube-auto-feed) rewrites the feed grid from its own /browse polls and drops what
// they lack, so while it runs the grid is never written here: the patched response carries the videos, and ytaf
// is asked to refetch - over the BroadcastChannel it already listens on for subscription changes.
// Installed is not running: ytaf can be switched off in its popup, and then the feed is written here as without it.
// Its on/off state is read by overhearing the settings its ISOLATED bridge sends its MAIN world - only overhearing:
// a messenger of our own in its namespace would answer its requests too, ahead of its bridge

const YTAF_PRESENCE_GLOBAL = "__ytafFeedMessenger";
const YTAF_CHANNEL_NAME = "ytaf";
const YTAF_SETTINGS_NAMESPACE = "ytaf-settings";

/** The events @webext-core/messaging's custom-event messenger travels on */
enum MessengerEvent {
  request = "@webext-core/messaging/custom-events",
  response = "@webext-core/messaging/custom-events/response"
}

enum YtafSettingsMessage {
  /** Its bridge's push, on startup and on every change */
  settingsChanged = "settingsChanged",
  /** Its MAIN world's pull on startup, answered by the bridge */
  getSettings = "getSettings"
}

enum YtafMessageType {
  subscriptionChange = "subscription-change"
}

const ytafSettingsSchema = z.looseObject({
  isExtensionEnabled: z.boolean()
});

const settingsPushSchema = z.looseObject({
  namespace: z.literal(YTAF_SETTINGS_NAMESPACE),
  message: z.looseObject({
    type: z.literal(YtafSettingsMessage.settingsChanged),
    data: ytafSettingsSchema
  })
});

const settingsReplySchema = z.looseObject({
  namespace: z.literal(YTAF_SETTINGS_NAMESPACE),
  message: z.looseObject({
    type: z.literal(YtafSettingsMessage.getSettings)
  }),
  response: z.looseObject({
    res: ytafSettingsSchema
  })
});

/** ytaf's default until its settings are overheard - and for a ytaf too old to send them */
let isYtafEnabled = true;

/** Read lazily: the two extensions' content scripts load in no guaranteed order */
export function isYouTubeAutoFeedActive() {
  return YTAF_PRESENCE_GLOBAL in globalThis && isYtafEnabled;
}

export function nudgeYouTubeAutoFeed() {
  const channel = new BroadcastChannel(YTAF_CHANNEL_NAME);
  channel.postMessage({ type: YtafMessageType.subscriptionChange });
  channel.close();
}

function readOverheardSettings(e: Event) {
  const detail = e instanceof CustomEvent ? e.detail : undefined;
  const push = settingsPushSchema.safeParse(detail);
  if (push.success) {
    return push.data.message.data;
  }

  const reply = settingsReplySchema.safeParse(detail);
  return reply.success ? reply.data.response.res : null;
}

/** MAIN world, document_start: follows ytaf being switched on and off; calls back on every change */
export function watchYouTubeAutoFeedSwitch(callback: () => void) {
  function handleMessengerEvent(e: Event) {
    const settings = readOverheardSettings(e);
    const isChanged = !!settings && settings.isExtensionEnabled !== isYtafEnabled;
    if (!settings || !isChanged) {
      return;
    }

    isYtafEnabled = settings.isExtensionEnabled;
    callback();
  }

  addEventListener(MessengerEvent.request, handleMessengerEvent);
  addEventListener(MessengerEvent.response, handleMessengerEvent);
}
