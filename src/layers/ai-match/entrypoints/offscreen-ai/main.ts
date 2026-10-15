import { chatMessageSchema } from "@/lib/ai/chat-message";
import { MessageType, onMessage } from "@/lib/messaging/extension-messaging";
import { z } from "@/lib/zod";
import { downloadLiteRtModel, getLiteRtDownloadFraction, inferWithLiteRt } from "#ai-match/engine/litert/litert-host";

// Chromium's offscreen page: hosts the LiteRT-LM download and engine for the service worker. Cancel and delete are the
// worker closing this page

const inferRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1)
});

onMessage(MessageType.offscreenAiDownload, () => downloadLiteRtModel());
onMessage(MessageType.offscreenAiDownloadFraction, () => getLiteRtDownloadFraction());
onMessage(MessageType.offscreenAiInfer, async ({ data }) => {
  const parsed = inferRequestSchema.safeParse(data);
  return parsed.success ? await inferWithLiteRt(parsed.data.messages) : null;
});
