import { createCursor, type Cursor, tokenize, TokenKind } from "@/lib/filter/length/length-tokenizer";
import {
  BETWEEN_WORD,
  CLAUSE_JOINERS,
  Comparison,
  COMPARISON_PHRASES,
  DEFAULT_UNIT_SECONDS,
  OPEN_ENDED_MARK,
  RANGE_SEPARATORS,
  UNIT_SECONDS
} from "@/lib/filter/length/length-vocabulary";
import { parseDurationText } from "@/lib/youtube/video/video-duration";
import { z } from "@/lib/zod";

// A length condition typed as one expression - ">=69m", "5-20m", "under 1h", "between 2 and 10 minutes" - read by
// a tokenizer and a small grammar into the inclusive second bounds a length filter stores:
//   expression := clause (joiner clause)*
//   clause     := "between"? duration separator duration | comparison duration | duration "+"
//   duration   := (number unit?)+ | clock time ("1:30:00")
// A number without a unit takes its range partner's unit ("5-20m"), else minutes

const boundsSchema = z.object({
  minSeconds: z.number().optional(),
  maxSeconds: z.number().optional()
});
type Bounds = z.infer<typeof boundsSchema>;

class ExpressionError extends Error {}

/** The comparison the next tokens spell, consumed, or null */
function takeComparison(cursor: Cursor) {
  for (const [phrase, comparison] of COMPARISON_PHRASES) {
    const words = phrase.split(" ");
    const isMatch = words.every((word, i) => cursor.peek(i)?.text === word);
    if (isMatch) {
      cursor.skip(words.length);
      return comparison;
    }
  }
  return null;
}

function readNumber(text: string) {
  const isClockTime = text.includes(":");
  if (isClockTime) {
    const seconds = parseDurationText(text);
    if (seconds === null) {
      throw new ExpressionError(`"${text}" isn't a time - write it like 1:30 or 1:02:03`);
    }

    return {
      seconds,
      isClockTime
    };
  }

  const value = Number(text);
  if (!Number.isFinite(value)) {
    throw new ExpressionError(`"${text}" isn't a number`);
  }

  return {
    seconds: value,
    isClockTime
  };
}

/**
 * A duration: one or more number-unit terms ("1h 30m"), or a clock time. A lone number without a unit keeps its
 * value for the caller to scale (`unitlessValue`)
 */
function takeDuration(cursor: Cursor) {
  let seconds = 0;
  let unitSeconds: number | null = null;
  let unitlessValue: number | null = null;
  while (cursor.peek()?.kind === TokenKind.NUMBER && unitlessValue === null) {
    const number = readNumber(cursor.take()?.text ?? "");
    if (number.isClockTime) {
      seconds += number.seconds;
      unitSeconds = 1;
      continue;
    }

    const unit = cursor.peek()?.kind === TokenKind.WORD ? UNIT_SECONDS[cursor.peek()?.text ?? ""] : undefined;
    if (unit === undefined) {
      unitlessValue = number.seconds;
      continue;
    }

    cursor.take();
    seconds += number.seconds * unit;
    unitSeconds = unit;
  }

  if (unitSeconds === null && unitlessValue === null) {
    return null;
  }

  return {
    seconds,
    unitSeconds,
    unitlessValue
  };
}

type Duration = NonNullable<ReturnType<typeof takeDuration>>;

function toSeconds({ duration, fallbackUnitSeconds }: { duration: Duration; fallbackUnitSeconds: number }) {
  const unitless = (duration.unitlessValue ?? 0) * (duration.unitSeconds ?? fallbackUnitSeconds);
  return Math.round(duration.seconds + unitless);
}

function requireDuration({ cursor, after }: { cursor: Cursor; after: string }) {
  const duration = takeDuration(cursor);
  if (!duration) {
    throw new ExpressionError(`Add a length after "${after}", like 10m`);
  }

  return duration;
}

function boundsOfComparison({ comparison, seconds }: { comparison: Comparison; seconds: number }) {
  const bounds: Bounds = {
    [Comparison.LESS_THAN]: {
      maxSeconds: seconds - 1
    },
    [Comparison.AT_MOST]: {
      maxSeconds: seconds
    },
    [Comparison.MORE_THAN]: {
      minSeconds: seconds + 1
    },
    [Comparison.AT_LEAST]: {
      minSeconds: seconds
    },
    [Comparison.EXACTLY]: {
      minSeconds: seconds,
      maxSeconds: seconds
    }
  }[comparison];
  return bounds;
}

function takeRange({ cursor, first }: { cursor: Cursor; first: Duration }) {
  const separator = cursor.take()?.text ?? "";
  const second = requireDuration({
    cursor,
    after: separator
  });
  const fallbackUnitSeconds = second.unitSeconds ?? first.unitSeconds ?? DEFAULT_UNIT_SECONDS;
  const ends = [first, second].map(duration =>
    toSeconds({
      duration,
      fallbackUnitSeconds
    })
  );
  const bounds: Bounds = {
    minSeconds: Math.min(...ends),
    maxSeconds: Math.max(...ends)
  };
  return bounds;
}

function takeClause(cursor: Cursor) {
  const comparison = takeComparison(cursor);
  if (comparison) {
    const duration = requireDuration({
      cursor,
      after: comparison
    });
    return boundsOfComparison({
      comparison,
      seconds: toSeconds({
        duration,
        fallbackUnitSeconds: DEFAULT_UNIT_SECONDS
      })
    });
  }

  if (cursor.peek()?.text === BETWEEN_WORD) {
    cursor.take();
  }

  const duration = takeDuration(cursor);
  const next = cursor.peek()?.text ?? "";
  if (!duration) {
    throw new ExpressionError(next ? `Didn't get "${next}" - try <=10m, >=1h or 5-20m` : "Type a length, like >=10m");
  }

  if (RANGE_SEPARATORS.has(next)) {
    return takeRange({
      cursor,
      first: duration
    });
  }

  if (next === OPEN_ENDED_MARK) {
    cursor.take();
    return boundsOfComparison({
      comparison: Comparison.AT_LEAST,
      seconds: toSeconds({
        duration,
        fallbackUnitSeconds: DEFAULT_UNIT_SECONDS
      })
    });
  }

  throw new ExpressionError("Say how it compares, like <=10m, >10m or 5-20m");
}

/** Every clause has to hold, so their bounds narrow each other */
function intersectBounds(boundsList: Bounds[]) {
  const mins = boundsList.flatMap(bounds => bounds.minSeconds ?? []);
  const maxes = boundsList.flatMap(bounds => bounds.maxSeconds ?? []);
  const bounds: Bounds = {
    ...(mins.length > 0 && {
      minSeconds: Math.max(0, ...mins)
    }),
    ...(maxes.length > 0 && {
      maxSeconds: Math.min(...maxes)
    })
  };
  return bounds;
}

function parseClauses(text: string) {
  const cursor = createCursor(tokenize(text));
  const boundsList = [takeClause(cursor)];
  while (!cursor.isDone()) {
    const joiner = cursor.take()?.text ?? "";
    if (!CLAUSE_JOINERS.has(joiner)) {
      throw new ExpressionError(`Didn't get "${joiner}" - join two limits with "and", like >=5m and <=20m`);
    }

    boundsList.push(takeClause(cursor));
  }
  return intersectBounds(boundsList);
}

/** The bounds an expression sets, or why it sets none - worded for the person typing it */
export function parseLengthExpression(text: string) {
  if (text.trim() === "") {
    return {
      bounds: null,
      error: "Type a length, like >=10m or 5-20m"
    };
  }

  try {
    const bounds = parseClauses(text);
    const isEmptyRange = (bounds.maxSeconds ?? Infinity) < (bounds.minSeconds ?? 0);
    const isInvalidRange = isEmptyRange || (bounds.maxSeconds !== undefined && bounds.maxSeconds < 0);
    if (isInvalidRange) {
      return {
        bounds: null,
        error: "No video can be that long and that short at once"
      };
    }

    return {
      bounds,
      error: null
    };
  } catch (error) {
    if (!(error instanceof ExpressionError)) {
      throw error;
    }

    return {
      bounds: null,
      error: error.message
    };
  }
}
