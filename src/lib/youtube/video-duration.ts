import { type ClassicRenderer, type Lockup } from "@/lib/youtube/schemas/renderers";
import { readText } from "@/lib/youtube/schemas/text";

// A video's length as its tile shows it: "12:34" or "1:02:03" on a thumbnail badge. Live and upcoming videos show
// words there instead ("LIVE", "UPCOMING"), which have no length yet

export const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const DURATION_TEXT_PATTERN = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/;
const MAX_UNIT_VALUE = 59;
const PADDED_UNIT_LENGTH = 2;

/** Seconds in a badge text, or null when it is not a length */
export function parseDurationText(text: string | undefined) {
  const match = text?.trim().match(DURATION_TEXT_PATTERN);
  if (!match) {
    return null;
  }

  const [, hours, minutes = "0", seconds = "0"] = match;
  const isUnitOverflowing = hours !== undefined && Number(minutes) > MAX_UNIT_VALUE || Number(seconds) > MAX_UNIT_VALUE;
  if (isUnitOverflowing) {
    return null;
  }

  return Number(hours ?? 0) * SECONDS_PER_HOUR + Number(minutes) * SECONDS_PER_MINUTE + Number(seconds);
}

/** "12:34" or "1:02:03", the way YouTube writes a length */
export function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor(totalSeconds % SECONDS_PER_HOUR / SECONDS_PER_MINUTE);
  const seconds = String(totalSeconds % SECONDS_PER_MINUTE).padStart(PADDED_UNIT_LENGTH, "0");
  if (hours === 0) {
    return `${minutes}:${seconds}`;
  }

  return `${hours}:${String(minutes).padStart(PADDED_UNIT_LENGTH, "0")}:${seconds}`;
}

/** The lockup's length badge - the first one on its thumbnail */
export function findLockupDurationBadge(lockup: Lockup) {
  const overlays = lockup.contentImage?.thumbnailViewModel?.overlays ?? [];
  const badges = overlays.flatMap(overlay => overlay.thumbnailBottomOverlayViewModel?.badges ?? []);
  return badges[0]?.thumbnailBadgeViewModel;
}

export function durationFromLockup(lockup: Lockup) {
  return parseDurationText(findLockupDurationBadge(lockup)?.text);
}

export function durationFromClassicRenderer(renderer: ClassicRenderer) {
  return parseDurationText(readText(renderer.lengthText));
}
