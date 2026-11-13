import { z } from "@/lib/zod";

export enum ChatRole {
  SYSTEM = "system",
  USER = "user",
  ASSISTANT = "assistant"
}

/** One chat turn, the shape both engines take: Prompt API `initialPrompts` and LiteRT-LM conversation messages */
export const chatMessageSchema = z.object({
  role: z.enum(ChatRole),
  content: z.string()
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;
