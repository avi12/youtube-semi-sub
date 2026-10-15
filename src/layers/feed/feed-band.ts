import { collectContentVideoIds, publishedTextsFromGridItem, videoIdFromGridItem } from "./feed-items";
import type { FeedVideo } from "@/lib/feed-video";
import { parseFirstRelativeTime } from "@/lib/youtube/relative-time";

// The feed's root contents mix section markers (shelves) with root-level video items. The root videos form the
// "Latest" band, split into runs by the markers. Only the band is touched: videos are added or removed, and the
// result is poured back into the runs at their original lengths so every marker keeps its row

const UNKNOWN_TIME_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface InlineRun {
  start: number;
  end: number;
}

type BandSlot = {
  videoId: string;
  item: unknown;
} | {
  videoId: string;
  video: FeedVideo;
};

export function findInlineRuns(contents: readonly unknown[]) {
  const runs: InlineRun[] = [];
  let iRunStart = -1;
  for (const [i, item] of contents.entries()) {
    const isVideo = !!videoIdFromGridItem(item);
    if (isVideo && iRunStart === -1) {
      iRunStart = i;
    }

    if (!isVideo && iRunStart !== -1) {
      runs.push({
        start: iRunStart,
        end: i
      });
      iRunStart = -1;
    }
  }

  if (iRunStart !== -1) {
    runs.push({
      start: iRunStart,
      end: contents.length
    });
  }

  return runs;
}

function extractBand({ contents, runs }: {
  contents: readonly unknown[];
  runs: InlineRun[];
}) {
  const band: {
    videoId: string;
    item: unknown;
  }[] = [];
  for (const run of runs) {
    for (const item of contents.slice(run.start, run.end)) {
      const videoId = videoIdFromGridItem(item);
      if (videoId) {
        band.push({
          videoId,
          item
        });
      }
    }
  }
  return band;
}

/**
 * Plans the band with `videos` inserted at time-correct positions and `removedVideoIds` taken out.
 * A video goes before the first band item older than it; one older than the whole loaded page is left for
 * later pages. When no item's time can be read (non-English UI), videos from the last 24 hours lead the band
 */
export function planFeedBand({ contents, videos, now, removedVideoIds }: {
  contents: readonly unknown[];
  videos: readonly FeedVideo[];
  now: number;
  removedVideoIds: ReadonlySet<string>;
}) {
  const runs = findInlineRuns(contents);
  const fullBand = extractBand({
    contents,
    runs
  });
  const band = fullBand.filter(slot => !removedVideoIds.has(slot.videoId));
  const removedIds = fullBand.filter(slot => removedVideoIds.has(slot.videoId)).map(slot => slot.videoId);
  if (runs.length === 0) {
    return {
      runs,
      slots: band,
      insertedVideos: [],
      removedIds,
      isChanged: false
    };
  }

  const times = band.map(slot => parseFirstRelativeTime({
    texts: publishedTextsFromGridItem(slot.item),
    now
  }));
  const knownTimes = times.filter(time => time !== null);
  const isTimeKnown = knownTimes.length > 0;
  const oldestTime = Math.min(...knownTimes.map(time => time.earliestTime));

  const presentIds = collectContentVideoIds(contents);
  function isInsertable(video: FeedVideo) {
    if (presentIds.has(video.videoId)) {
      return false;
    }

    return isTimeKnown ? video.publishedAt >= oldestTime : now - video.publishedAt <= UNKNOWN_TIME_MAX_AGE_MS;
  }

  const insertedVideos = videos.filter(isInsertable).toSorted((left, right) => right.publishedAt - left.publishedAt);
  const pending = insertedVideos.map(video => ({
    videoId: video.videoId,
    video
  }));
  const slots: BandSlot[] = isTimeKnown ? [] : pending.splice(0);
  for (const [i, slot] of band.entries()) {
    const time = times[i];
    while (time && pending[0] && pending[0].video.publishedAt > time.approxTime) {
      slots.push(...pending.splice(0, 1));
    }
    slots.push(slot);
  }
  slots.push(...pending);

  return {
    runs,
    slots,
    insertedVideos,
    removedIds,
    isChanged: insertedVideos.length > 0 || removedIds.length > 0
  };
}

/** Pours the band back into the runs: every run keeps its length, the last one absorbs the difference */
export function reflowBandIntoRuns({ contents, runs, band }: {
  contents: readonly unknown[];
  runs: InlineRun[];
  band: readonly unknown[];
}) {
  const result: unknown[] = [];
  const iLastRun = runs.length - 1;
  let iBand = 0;
  let iRead = 0;
  for (const [iRun, run] of runs.entries()) {
    result.push(...contents.slice(iRead, run.start));
    const slotCount = iRun === iLastRun ? band.length - iBand : run.end - run.start;
    result.push(...band.slice(iBand, iBand + slotCount));
    iBand = Math.min(iBand + slotCount, band.length);
    iRead = run.end;
  }

  result.push(...contents.slice(iRead));
  return result;
}
