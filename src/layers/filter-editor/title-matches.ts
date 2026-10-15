import {
  type AiFilter,
  type AiJudgeContext,
  compileTitleFilter,
  createVideoJudge,
  getTitleFilterError,
  MatchState,
  type RegexFilter
} from "@/lib/filter/title-filter";
import { type FeedVideo, feedVideoSchema } from "@/lib/schemas/feed-video";
import { z } from "@/lib/zod";

const GLOBAL_FLAG = "g";

const titleSegmentSchema = z.object({
  text: z.string(),
  isHighlighted: z.boolean()
});
type TitleSegment = z.infer<typeof titleSegmentSchema>;

const previewRowSchema = z.object({
  video: feedVideoSchema,
  matchState: z.enum(MatchState),
  segments: z.array(titleSegmentSchema)
});
export type PreviewRow = z.infer<typeof previewRowSchema>;

/** Splits a title into the substrings the filter matched and the plain text between them */
export function highlightMatches({ title, regex }: {
  title: string;
  regex: RegExp;
}) {
  const globalRegex = new RegExp(regex, regex.global ? regex.flags : `${regex.flags}${GLOBAL_FLAG}`);
  const segments: TitleSegment[] = [];
  let iSegmentStart = 0;
  for (const match of title.matchAll(globalRegex)) {
    const [matchedText] = match;
    const isEmptyMatch = matchedText.length === 0;
    if (isEmptyMatch) {
      continue;
    }

    const isTextBeforeMatch = match.index > iSegmentStart;
    if (isTextBeforeMatch) {
      segments.push({
        text: title.slice(iSegmentStart, match.index),
        isHighlighted: false
      });
    }

    segments.push({
      text: matchedText,
      isHighlighted: true
    });
    iSegmentStart = match.index + matchedText.length;
  }

  const isTextAfterLastMatch = iSegmentStart < title.length;
  if (isTextAfterLastMatch) {
    segments.push({
      text: title.slice(iSegmentStart),
      isHighlighted: false
    });
  }

  return segments;
}

function previewRegexRow({ video, regex }: {
  video: FeedVideo;
  regex: RegExp | null;
}) {
  if (!regex) {
    const unmatchedRow: PreviewRow = {
      video,
      matchState: MatchState.doesNotMatch,
      segments: [{
        text: video.title,
        isHighlighted: false
      }]
    };
    return unmatchedRow;
  }

  const isMatch = regex.test(video.title);
  const row: PreviewRow = {
    video,
    matchState: isMatch ? MatchState.matches : MatchState.doesNotMatch,
    segments: highlightMatches({
      title: video.title,
      regex
    })
  };
  return row;
}

/** Feed rows are the videos that land (or may still land) in the feed, in upload order; skipped rows never will */
export function partitionPreviewRows(rows: PreviewRow[]) {
  const feedRows: PreviewRow[] = [];
  const skippedRows: PreviewRow[] = [];
  let matchCount = 0;
  let pendingCount = 0;
  for (const row of rows) {
    if (row.matchState === MatchState.doesNotMatch) {
      skippedRows.push(row);
      continue;
    }

    feedRows.push(row);

    if (row.matchState === MatchState.pending) {
      pendingCount++;
    } else {
      matchCount++;
    }
  }

  return {
    feedRows,
    skippedRows,
    matchCount,
    pendingCount
  };
}

/** How the filter treats each preview video - the same compiled RegExp `selectFeedVideos` applies to the real feed */
export function previewTitleFilter({ filter, videos }: {
  filter: RegexFilter;
  videos: FeedVideo[];
}) {
  const regex = compileTitleFilter(filter);
  const rows = videos.map(video => previewRegexRow({
    video,
    regex
  }));
  return {
    isValid: regex !== null,
    ...partitionPreviewRows(rows)
  };
}

export type TitleFilterPreview = ReturnType<typeof previewTitleFilter>;

/**
 * How an AI filter treats each preview video, by the verdicts `selectFeedVideos` reads: a video without one yet is
 * pending. Not valid while the description is blank or AI match is off - then nothing is judged at all
 */
export function previewAiFilter({ filter, videos, aiVerdicts, isAiEnabled }: AiJudgeContext & {
  filter: AiFilter;
  videos: FeedVideo[];
}) {
  const judge = createVideoJudge({
    filter,
    aiVerdicts,
    isAiEnabled
  });
  const rows: PreviewRow[] = judge
    ? videos.map(video => ({
      video,
      matchState: judge(video),
      segments: [{
        text: video.title,
        isHighlighted: false
      }]
    }))
    : [];
  const preview: TitleFilterPreview = {
    isValid: judge !== null,
    ...partitionPreviewRows(rows)
  };
  return preview;
}

/** What the preview says when the filter can't run, and when nothing matches - worded per filter kind */
const previewHintsSchema = z.object({
  invalidSummary: z.string(),
  invalid: z.string(),
  noMatch: z.string()
});
export type PreviewHints = z.infer<typeof previewHintsSchema>;

/** The engine's error minus V8's `Invalid regular expression: /<pattern>/<flags>: ` echo of the input */
export function getReadableFilterError(filter: RegexFilter) {
  const error = getTitleFilterError(filter);
  if (!error) {
    return null;
  }

  const v8Prefix = `Invalid regular expression: /${filter.pattern}/${filter.flags}: `;
  const isV8Message = error.startsWith(v8Prefix);
  const reason = isV8Message ? error.slice(v8Prefix.length) : error;
  return `${reason.charAt(0).toUpperCase()}${reason.slice(1)}`;
}
