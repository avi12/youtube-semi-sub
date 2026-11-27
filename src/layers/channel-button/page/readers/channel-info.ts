import { type ChannelInfo, channelInfoSchema } from "@/lib/schemas/channel";
import type { Thumbnail } from "@/lib/youtube/schemas/thumbnail";
import { YOUTUBE_ORIGIN } from "@/lib/youtube/site";

const HANDLE_PATH_PATTERN = /^\/(@[^/]+)/;
const PROTOCOL_RELATIVE_PREFIX = "//";
const PREFERRED_AVATAR_SIZE = 88;

function toAbsoluteUrl(url: string) {
  return url.startsWith(PROTOCOL_RELATIVE_PREFIX) ? `https:${url}` : url;
}

/** The smallest avatar that still looks sharp at the dialog's size, else the largest there is */
export function pickAvatarUrl(thumbnails: Thumbnail[] | undefined) {
  const bySize = (thumbnails ?? []).toSorted((left, right) => (left.width ?? 0) - (right.width ?? 0));
  const sharpEnough = bySize.find(thumbnail => (thumbnail.width ?? 0) >= PREFERRED_AVATAR_SIZE);
  const picked = sharpEnough ?? bySize.at(-1);
  return picked && toAbsoluteUrl(picked.url);
}

/** "/@mkbhd", "http://www.youtube.com/@mkbhd/videos" -> "@mkbhd" */
export function toChannelHandle(urlOrPath: string | undefined) {
  if (!urlOrPath) {
    return undefined;
  }

  const { pathname } = new URL(urlOrPath, YOUTUBE_ORIGIN);
  const handle = HANDLE_PATH_PATTERN.exec(pathname)?.[1];
  return handle && decodeURIComponent(handle);
}

export function toChannelInfo(candidate: ChannelInfo) {
  const parsed = channelInfoSchema.safeParse(candidate);
  if (parsed.success) {
    return parsed.data;
  }

  // A malformed avatar must not cost the whole channel
  const withoutAvatar = channelInfoSchema.safeParse({
    ...candidate,
    avatarUrl: undefined
  });
  return withoutAvatar.success ? withoutAvatar.data : null;
}
