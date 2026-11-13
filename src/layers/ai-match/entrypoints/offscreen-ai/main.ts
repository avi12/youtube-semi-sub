import { downloadLiteRtModel, getLiteRtDownloadFraction, inferWithLiteRt } from "#ai-match/engine/litert/litert-host";
import { MessageType, onMessage } from "@/lib/messaging/extension-messaging";

// Chromium's offscreen page: hosts the LiteRT-LM download and engine for the service worker. Cancel and delete are the
// worker closing this page

onMessage(MessageType.OFFSCREEN_AI_DOWNLOAD, () => downloadLiteRtModel());
onMessage(MessageType.OFFSCREEN_AI_DOWNLOAD_FRACTION, () => getLiteRtDownloadFraction());
onMessage(MessageType.OFFSCREEN_AI_INFER, ({ messages }) => inferWithLiteRt(messages));
