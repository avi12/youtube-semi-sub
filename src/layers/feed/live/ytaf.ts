import { z } from "@/lib/zod";

// YouTube Auto Feed (avi12/youtube-auto-feed) rewrites the feed grid from its own /browse polls and drops what
// they lack, so while it runs the grid is never written here: the patched response carries the videos, and ytaf
// is asked to refetch - over the BroadcastChannel it already listens on for subscription changes.
// Installed is not running: ytaf can be switched off in its popup, and then the feed is written here as without it.
// Its on/off state is read by overhearing the settings its ISOLATED bridge sends its MAIN world - only overhearing:
// a messenger of our own in its namespace would answer its requests too, ahead of its bridge

const YTAF_PRESENCE_GLOBAL = "__ytafFeedMessenger";
/** The version of the contract ytaf keeps with this extension, which it sets at document_start in the MAIN world */
const YTAF_CONTRACT_VERSION_GLOBAL = "__ytafHonorsSemiSubTags";
const YTAF_CHANNEL_NAME = "ytaf";
const YTAF_SETTINGS_NAMESPACE = "ytaf-settings";

/** The events @webext-core/messaging's custom-event messenger travels on */
enum MessengerEvent {
  REQUEST = "@webext-core/messaging/custom-events",
  RESPONSE = "@webext-core/messaging/custom-events/response"
}

enum YtafSettingsMessage {
  /** Its bridge's push, on startup and on every change */
  SETTINGS_CHANGED = "settingsChanged",
  /** Its MAIN world's pull on startup, answered by the bridge */
  GET_SETTINGS = "getSettings"
}

enum YtafMessageType {
  SUBSCRIPTION_CHANGE = "subscription-change"
}

/** What ytaf promises from each contract version on */
enum YtafContractVersion {
  /** Before ytaf took on the contract: it keeps nothing it didn't fetch itself */
  NONE = 0,
  /** It keeps tagged items YouTube's own feed lacks - Shorts in its shelf too - for as long as a response has them */
  HONORS_SEMI_SUB_TAGS = 1,
  /** It also drops the videos a response lists as hidden (`yssHiddenVideoIds`) at once, and never adds one */
  DROPS_HIDDEN_VIDEOS = 2
}

/** Absent before ytaf took on the contract, `true` for its first version, a number since */
const contractVersionSchema = z
  .union([z.literal(true).transform(() => YtafContractVersion.HONORS_SEMI_SUB_TAGS), z.number().int().nonnegative()])
  .catch(YtafContractVersion.NONE);

const ytafSettingsSchema = z.looseObject({
  isExtensionEnabled: z.boolean()
});

const settingsPushSchema = z.looseObject({
  namespace: z.literal(YTAF_SETTINGS_NAMESPACE),
  message: z.looseObject({
    type: z.literal(YtafSettingsMessage.SETTINGS_CHANGED),
    data: ytafSettingsSchema
  })
});

const settingsReplySchema = z.looseObject({
  namespace: z.literal(YTAF_SETTINGS_NAMESPACE),
  message: z.looseObject({
    type: z.literal(YtafSettingsMessage.GET_SETTINGS)
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

function readYouTubeAutoFeedContractVersion() {
  return contractVersionSchema.parse(Object.getOwnPropertyDescriptor(globalThis, YTAF_CONTRACT_VERSION_GLOBAL)?.value);
}

/**
 * Shorts are injected unless a running ytaf is too old to keep them: it never adopts new shelf items and prunes the
 * Shorts of channels outside the user's subscriptions, so they would only flash in and out
 */
export function isShortsInjectionAllowed() {
  return !isYouTubeAutoFeedActive() || readYouTubeAutoFeedContractVersion() >= YtafContractVersion.HONORS_SEMI_SUB_TAGS;
}

/** Whether ytaf, when installed, reads the hidden videos a feed response lists - its contract version 2 on */
export function isHiddenVideoListHonored() {
  return readYouTubeAutoFeedContractVersion() >= YtafContractVersion.DROPS_HIDDEN_VIDEOS;
}

export function nudgeYouTubeAutoFeed() {
  const channel = new BroadcastChannel(YTAF_CHANNEL_NAME);
  channel.postMessage({ type: YtafMessageType.SUBSCRIPTION_CHANGE });
  channel.close();
}

function readOverheardSettings(event: Event) {
  const detail = event instanceof CustomEvent ? event.detail : undefined;
  const push = settingsPushSchema.safeParse(detail);
  if (push.success) {
    return push.data.message.data;
  }

  const reply = settingsReplySchema.safeParse(detail);
  return reply.success ? reply.data.response.res : null;
}

/** MAIN world, document_start: follows ytaf being switched on and off; calls back on every change */
export function watchYouTubeAutoFeedSwitch(callback: () => void) {
  function handleMessengerEvent(event: Event) {
    const settings = readOverheardSettings(event);
    const isChanged = !!settings && settings.isExtensionEnabled !== isYtafEnabled;
    if (!settings || !isChanged) {
      return;
    }

    isYtafEnabled = settings.isExtensionEnabled;
    callback();
  }

  addEventListener(MessengerEvent.REQUEST, handleMessengerEvent);
  addEventListener(MessengerEvent.RESPONSE, handleMessengerEvent);
}
