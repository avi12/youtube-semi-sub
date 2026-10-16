import { MessageType, onMessage } from "@/lib/messaging/extension-messaging";
import { downloadLiteRtModel, getLiteRtDownloadFraction, inferWithLiteRt } from "#ai-match/engine/litert/litert-host";

// Chromium's offscreen page: hosts the LiteRT-LM download and engine for the service worker. Cancel and delete are the
// worker closing this page

onMessage(MessageType.offscreenAiDownload, () => downloadLiteRtModel());
onMessage(MessageType.offscreenAiDownloadFraction, () => getLiteRtDownloadFraction());
onMessage(MessageType.offscreenAiInfer, ({ messages }) => inferWithLiteRt(messages));
