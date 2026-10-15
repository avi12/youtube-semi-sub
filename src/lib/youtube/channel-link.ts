import type { ChannelInfo } from "@/lib/schemas/channel";
import { YOUTUBE_ORIGIN } from "@/lib/youtube/site";

const HANDLE_PREFIX = "@";

export function formatHandle(handle: string) {
  const isPrefixed = handle.startsWith(HANDLE_PREFIX);
  return isPrefixed ? handle : `${HANDLE_PREFIX}${handle}`;
}

export function getChannelUrl({ channelId, handle }: Pick<ChannelInfo, "channelId" | "handle">) {
  const path = handle ? formatHandle(handle) : `channel/${channelId}`;
  return new URL(path, YOUTUBE_ORIGIN).href;
}
