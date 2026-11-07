import {
  type AiJudgeContext,
  compileTitleFilter,
  createModeJudge,
  FilterKind,
  getTitleFilterError,
  isMembersOnlyLocked,
  isVideoFilterValid,
  listFilterConditions,
  MatchState,
  type RegexFilter,
  type VideoFilter
} from "@/lib/filter/title-filter";
import { type FeedVideo, feedVideoSchema } from "@/lib/schemas/feed-video";
import { SubscriptionMode } from "@/lib/schemas/subscription-mode";
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

/** Whether a definite verdict puts the video in the feed: a follow filter shows its matches, a hide filter the rest */
const SHOWN_STATE_BY_MODE = {
  [SubscriptionMode.follow]: MatchState.matches,
  [SubscriptionMode.hide]: MatchState.doesNotMatch
} as const satisfies Record<SubscriptionMode, MatchState>;

/**
 * Splits the rows by what the feed ends up showing, in either mode: shown rows (a pending one may still show, in
 * upload order) and hidden rows - the ones a follow filter leaves out or a hide filter hides
 */
export function partitionPreviewRows({ rows, mode }: {
  rows: PreviewRow[];
  mode: SubscriptionMode;
}) {
  const shownState = SHOWN_STATE_BY_MODE[mode];
  const shownRows: PreviewRow[] = [];
  const hiddenRows: PreviewRow[] = [];
  let shownCount = 0;
  let pendingCount = 0;
  for (const row of rows) {
    if (row.matchState === MatchState.pending) {
      shownRows.push(row);
      pendingCount++;
      continue;
    }

    if (row.matchState !== shownState) {
      hiddenRows.push(row);
      continue;
    }

    shownRows.push(row);
    shownCount++;
  }

  return {
    shownRows,
    hiddenRows,
    shownCount,
    pendingCount
  };
}

/** What a preview highlights in each title: the filter's RegExp condition, once it compiles and isn't empty */
function findHighlightRegex(filter: VideoFilter) {
  const regexFilter = listFilterConditions(filter).find(condition => condition.kind === FilterKind.regex);
  return regexFilter?.pattern ? compileTitleFilter(regexFilter) : null;
}

/**
 * How the filter treats each preview video - the same judge the real feed is filtered by, its RegExp condition's
 * matches highlighted. A hide filter that lets every video through hides nothing, where such a follow filter adds
 * every video (`isFilterInert`). Not valid while a condition can't run - a pattern mid-edit, a blank description, AI
 * match off with nothing else to judge by - then nothing is judged at all
 */
export function previewVideoFilter({ filter, videos, mode, isMember, ...context }: AiJudgeContext & {
  filter: VideoFilter;
  videos: FeedVideo[];
  mode: SubscriptionMode;
  /** Following leaves a members-only video out for a non-member, whatever the filter says (`isMembersOnlyLocked`) */
  isMember?: boolean;
}) {
  const judge = createModeJudge({
    filter,
    mode,
    ...context
  });
  const isValid = isVideoFilterValid(filter) && judge !== null;
  const regex = findHighlightRegex(filter);
  if (!isValid || !judge) {
    return {
      isValid: false,
      ...partitionPreviewRows({
        rows: [],
        mode
      })
    };
  }

  const rows = videos.map(video => {
    const isLeftOut = mode === SubscriptionMode.follow && isMembersOnlyLocked({
      video,
      isMember
    });
    const row: PreviewRow = {
      video,
      matchState: isLeftOut ? MatchState.doesNotMatch : judge(video),
      segments: regex ?
        highlightMatches({
          title: video.title,
          regex
        }) :
        [{
          text: video.title,
          isHighlighted: false
        }]
    };
    return row;
  });
  return {
    isValid,
    ...partitionPreviewRows({
      rows,
      mode
    })
  };
}

export type VideoFilterPreview = ReturnType<typeof previewVideoFilter>;

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
