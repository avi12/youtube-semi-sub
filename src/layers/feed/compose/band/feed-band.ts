import { AnchorSide, type FeedItemSlot, type FeedSlot, type PlacementAnchor } from "#feed/compose/feed-slot";
import { collectContentVideoIds, publishedTextsFromGridItem, videoIdFromGridItem } from "#feed/items/feed-items";
import { type FeedVideo, sortNewestFirst } from "@/lib/schemas/feed-video";
import { MILLISECONDS_PER_DAY } from "@/lib/utils/time";
import { parseFirstRelativeTime } from "@/lib/youtube/relative-time";
import { z } from "@/lib/zod";

// The feed's root contents mix section markers (shelves) with root-level video items. The root videos form the
// "Latest" band, split into runs by the markers. Only the band is touched: videos are added or removed, and the
// result is poured back into the runs at their original lengths so every marker keeps its row

const UNKNOWN_TIME_MAX_AGE_MS = MILLISECONDS_PER_DAY;

const inlineRunSchema = z.object({
  start: z.number(),
  end: z.number()
});
type InlineRun = z.infer<typeof inlineRunSchema>;

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

function extractBand({ contents, runs }: { contents: readonly unknown[]; runs: InlineRun[] }) {
  const band: FeedItemSlot[] = [];
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

function readBandTimes({ band, now }: { band: readonly FeedItemSlot[]; now: number }) {
  return band.map(slot =>
    parseFirstRelativeTime({
      texts: publishedTextsFromGridItem(slot.item),
      now
    })
  );
}

/**
 * Whether an upload is recent enough for the loaded page: no older than its oldest band item - an older one is left
 * for later pages - or, when no item's time can be read (non-English UI), from the last 24 hours
 */
function createLoadedSpanCheck({ times, now }: { times: ReturnType<typeof parseFirstRelativeTime>[]; now: number }) {
  const knownTimes = times.filter(time => time !== null);
  const isTimeKnown = knownTimes.length > 0;
  const oldestTime = Math.min(...knownTimes.map(time => time.earliestTime));
  return function isWithinLoadedSpan(video: FeedVideo) {
    return isTimeKnown ? video.publishedAt >= oldestTime : now - video.publishedAt <= UNKNOWN_TIME_MAX_AGE_MS;
  };
}

/**
 * Plans the band with `videos` inserted at time-correct positions and `removedVideoIds` taken out.
 * A video goes before the first band item older than it, within the loaded span (`createLoadedSpanCheck`); when no
 * item's time can be read, the inserted videos lead the band. Shorts never join the band - they belong in the
 * Shorts shelf, which is held to the same span.
 * A relative time is only an hour wide, so the same video would land left or right of its neighbours as the feed is
 * fetched again: once placed, a video stays next to the feed item it was first placed beside (`anchors`) - behind
 * the item before it, or at the band's start ahead of the item after it, so newer videos arriving above push it along
 * with its neighbours - as long as that item is still there. `placements` reports where each inserted video went
 */
export function planFeedBand({
  contents,
  videos,
  now,
  removedVideoIds,
  anchors = new Map()
}: {
  contents: readonly unknown[];
  videos: readonly FeedVideo[];
  now: number;
  removedVideoIds: ReadonlySet<string>;
  anchors?: ReadonlyMap<string, PlacementAnchor>;
}) {
  const runs = findInlineRuns(contents);
  const fullBand = extractBand({
    contents,
    runs
  });
  const band = fullBand.filter(slot => !removedVideoIds.has(slot.videoId));
  const removedIds = fullBand.filter(slot => removedVideoIds.has(slot.videoId)).map(slot => slot.videoId);
  const times = readBandTimes({
    band,
    now
  });
  // The span YouTube loaded, so taking items out never narrows what may be inserted
  const isWithinLoadedSpan = createLoadedSpanCheck({
    times: readBandTimes({
      band: fullBand,
      now
    }),
    now
  });
  if (runs.length === 0) {
    return {
      runs,
      slots: band,
      insertedVideos: [],
      placements: new Map<string, PlacementAnchor>(),
      removedIds,
      isChanged: false,
      isWithinLoadedSpan
    };
  }

  const isTimeKnown = times.some(time => time !== null);
  const presentIds = collectContentVideoIds(contents);
  function isInsertable(video: FeedVideo) {
    return !video.isShort && !presentIds.has(video.videoId) && isWithinLoadedSpan(video);
  }

  const insertedVideos = sortNewestFirst(videos.filter(isInsertable));
  const pending = insertedVideos.map(video => ({
    videoId: video.videoId,
    video
  }));
  const bandIds = new Set(band.map(slot => slot.videoId));
  // gaps[i] holds the videos placed before band item i, the last one those after the whole band
  const gaps: (typeof pending)[] = Array.from({ length: band.length + 1 }, () => []);
  const stillAnchored = pending.filter(({ videoId }) => bandIds.has(anchors.get(videoId)?.videoId ?? ""));
  for (const entry of stillAnchored) {
    const anchor = anchors.get(entry.videoId);
    const iAnchor = band.findIndex(slot => slot.videoId === anchor?.videoId);
    gaps[anchor?.side === AnchorSide.before ? iAnchor : iAnchor + 1]?.push(entry);
  }

  const free = pending.filter(entry => !stillAnchored.includes(entry));
  if (!isTimeKnown) {
    gaps[0]?.push(...free.splice(0));
  }

  for (const [i] of band.entries()) {
    const time = times[i];
    while (time && free[0] && free[0].video.publishedAt > time.approximateTime) {
      gaps[i]?.push(...free.splice(0, 1));
    }
  }
  gaps.at(-1)?.push(...free);

  const slots: FeedSlot[] = [];
  const placements = new Map<string, PlacementAnchor>();
  for (const [i, gap] of gaps.entries()) {
    const previous = band[i - 1];
    const next = band[i];
    const anchor = previous
      ? {
          videoId: previous.videoId,
          side: AnchorSide.after
        }
      : next && {
          videoId: next.videoId,
          side: AnchorSide.before
        };
    for (const entry of gap.toSorted((first, second) => second.video.publishedAt - first.video.publishedAt)) {
      slots.push(entry);

      if (anchor) {
        placements.set(entry.videoId, anchor);
      }
    }

    if (next) {
      slots.push(next);
    }
  }

  return {
    runs,
    slots,
    placements,
    insertedVideos,
    removedIds,
    isChanged: insertedVideos.length > 0 || removedIds.length > 0,
    isWithinLoadedSpan
  };
}

/** Pours the band back into the runs: every run keeps its length, the last one absorbs the difference */
export function reflowBandIntoRuns({
  contents,
  runs,
  band
}: Parameters<typeof extractBand>[0] & {
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
