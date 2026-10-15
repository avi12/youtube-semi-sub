import { z } from "@/lib/zod";

export enum ChatRole {
  system = "system",
  user = "user",
  assistant = "assistant"
}

/** One chat turn, the shape both engines take: Prompt API `initialPrompts` and LiteRT-LM conversation messages */
const chatMessageSchema = z.object({
  role: z.enum(ChatRole),
  content: z.string()
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;
