import { SECONDS_PER_HOUR } from "@/lib/filter/length/length-vocabulary";
import type { LengthFilter } from "@/lib/filter/schema/video-filter-schema";
import { formatDuration, SECONDS_PER_MINUTE } from "@/lib/youtube/video/video-duration";

/** A length in the shortest units it reads in: "45s", "20m", "1h", "1h30m" */
function formatLengthValue(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  const hasRemainder = seconds !== 0 && totalSeconds >= SECONDS_PER_MINUTE;
  if (hasRemainder) {
    return formatDuration(totalSeconds);
  }

  const hasSeconds = seconds > 0 || totalSeconds === 0;
  const parts = [hours > 0 ? `${hours}h` : "", minutes > 0 ? `${minutes}m` : "", hasSeconds ? `${seconds}s` : ""];
  return parts.join("");
}

/** The expression a stored length filter reads as, for the field to start from */
export function formatLengthExpression({ minSeconds, maxSeconds }: LengthFilter) {
  if (minSeconds !== undefined && maxSeconds !== undefined) {
    return minSeconds === maxSeconds
      ? `=${formatLengthValue(minSeconds)}`
      : `${formatLengthValue(minSeconds)}-${formatLengthValue(maxSeconds)}`;
  }

  if (maxSeconds !== undefined) {
    return `<=${formatLengthValue(maxSeconds)}`;
  }

  return minSeconds === undefined ? "" : `>=${formatLengthValue(minSeconds)}`;
}
