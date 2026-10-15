import type { ChannelInfo } from "@/lib/schemas/channel";

const YOUTUBE_ORIGIN = "https://www.youtube.com";
const HANDLE_PREFIX = "@";

export function formatHandle(handle: string) {
  const isPrefixed = handle.startsWith(HANDLE_PREFIX);
  return isPrefixed ? handle : `${HANDLE_PREFIX}${handle}`;
}

export function getChannelUrl({ channelId, handle }: Pick<ChannelInfo, "channelId" | "handle">) {
  const path = handle ? formatHandle(handle) : `channel/${channelId}`;
  return new URL(path, YOUTUBE_ORIGIN).href;
}
