import type { LengthFilter } from "@/lib/filter/title-filter";
import { formatDuration, parseDurationText, SECONDS_PER_MINUTE } from "@/lib/youtube/video-duration";
import { z } from "@/lib/zod";

// A length condition typed as one expression - ">=69m", "5-20m", "under 1h", "between 2 and 10 minutes" - read by
// a tokenizer and a small grammar into the inclusive second bounds a length filter stores:
//   expression := clause (joiner clause)*
//   clause     := "between"? duration separator duration | comparison duration | duration "+"
//   duration   := (number unit?)+ | clock time ("1:30:00")
// A number without a unit takes its range partner's unit ("5-20m"), else minutes

const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const DEFAULT_UNIT_SECONDS = SECONDS_PER_MINUTE;

const UNIT_SECONDS: Readonly<Record<string, number>> = {
  s: 1,
  sec: 1,
  secs: 1,
  second: 1,
  seconds: 1,
  m: SECONDS_PER_MINUTE,
  min: SECONDS_PER_MINUTE,
  mins: SECONDS_PER_MINUTE,
  minute: SECONDS_PER_MINUTE,
  minutes: SECONDS_PER_MINUTE,
  h: SECONDS_PER_HOUR,
  hr: SECONDS_PER_HOUR,
  hrs: SECONDS_PER_HOUR,
  hour: SECONDS_PER_HOUR,
  hours: SECONDS_PER_HOUR
};

enum Comparison {
  LESS_THAN = "<",
  AT_MOST = "<=",
  MORE_THAN = ">",
  AT_LEAST = ">=",
  EXACTLY = "="
}

/** Every way to write a comparison, symbols and words, longest first so "<=" wins over "<" */
const COMPARISON_PHRASES: readonly (readonly [string, Comparison])[] = [
  ["no more than", Comparison.AT_MOST],
  ["no longer than", Comparison.AT_MOST],
  ["no less than", Comparison.AT_LEAST],
  ["no shorter than", Comparison.AT_LEAST],
  ["shorter than", Comparison.LESS_THAN],
  ["longer than", Comparison.MORE_THAN],
  ["less than", Comparison.LESS_THAN],
  ["fewer than", Comparison.LESS_THAN],
  ["more than", Comparison.MORE_THAN],
  ["at most", Comparison.AT_MOST],
  ["at least", Comparison.AT_LEAST],
  ["up to", Comparison.AT_MOST],
  ["maximum", Comparison.AT_MOST],
  ["minimum", Comparison.AT_LEAST],
  ["within", Comparison.AT_MOST],
  ["exactly", Comparison.EXACTLY],
  ["under", Comparison.LESS_THAN],
  ["below", Comparison.LESS_THAN],
  ["over", Comparison.MORE_THAN],
  ["above", Comparison.MORE_THAN],
  ["max", Comparison.AT_MOST],
  ["<=", Comparison.AT_MOST],
  [">=", Comparison.AT_LEAST],
  ["=<", Comparison.AT_MOST],
  ["=>", Comparison.AT_LEAST],
  ["==", Comparison.EXACTLY],
  ["≤", Comparison.AT_MOST],
  ["≥", Comparison.AT_LEAST],
  ["<", Comparison.LESS_THAN],
  [">", Comparison.MORE_THAN],
  ["=", Comparison.EXACTLY]
];

const RANGE_SEPARATORS: ReadonlySet<string> = new Set(["-", "–", "—", "..", "to", "and", "~"]);
const CLAUSE_JOINERS: ReadonlySet<string> = new Set([",", ";", "and", "&", "&&"]);
const BETWEEN_WORD = "between";
const OPEN_ENDED_MARK = "+";
const SYMBOL_CHARACTERS = "<>=≤≥-–—~,;&+.";

enum TokenKind {
  NUMBER = "number",
  WORD = "word",
  SYMBOL = "symbol"
}

const tokenSchema = z.object({
  kind: z.enum(TokenKind),
  text: z.string()
});
type Token = z.infer<typeof tokenSchema>;

const boundsSchema = z.object({
  minSeconds: z.number().optional(),
  maxSeconds: z.number().optional()
});
type Bounds = z.infer<typeof boundsSchema>;

class ExpressionError extends Error {}

function isDigit(character: string) {
  return character >= "0" && character <= "9";
}

function isLetter(character: string) {
  return character.toLowerCase() !== character.toUpperCase();
}

function readWhile({ text, iStart, isPart }: { text: string; iStart: number; isPart: (character: string) => boolean }) {
  let iEnd = iStart;
  while (iEnd < text.length && isPart(text.charAt(iEnd))) {
    iEnd++;
  }
  return iEnd;
}

/** Digits with colons ("1:30") or one decimal point - a second point starts a ".." range separator instead */
function readNumberEnd({ text, iStart }: { text: string; iStart: number }) {
  let iEnd = iStart;
  let isPointSeen = false;
  while (iEnd < text.length) {
    const character = text.charAt(iEnd);
    const isPoint = character === "." && !isPointSeen && isDigit(text.charAt(iEnd + 1));
    if (!isDigit(character) && character !== ":" && !isPoint) {
      break;
    }

    if (isPoint) {
      isPointSeen = true;
    }

    iEnd++;
  }
  return iEnd;
}

function isSymbolPart(character: string) {
  return SYMBOL_CHARACTERS.includes(character);
}

function readTokenKind({ text, i }: { text: string; i: number }) {
  const character = text.charAt(i);
  const isNumberStart = isDigit(character) || (character === "." && isDigit(text.charAt(i + 1)));
  if (isNumberStart) {
    return TokenKind.NUMBER;
  }

  return isLetter(character) ? TokenKind.WORD : TokenKind.SYMBOL;
}

/** Splits the text into numbers ("69", "1.5", "1:30"), words and runs of symbols ("<=", "..") */
function tokenize(text: string) {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    if (text.charAt(i).trim() === "") {
      i++;
      continue;
    }

    const kind = readTokenKind({
      text,
      i
    });

    const iEnd =
      kind === TokenKind.NUMBER
        ? readNumberEnd({
            text,
            iStart: i
          })
        : Math.max(
            readWhile({
              text,
              iStart: i,
              isPart: kind === TokenKind.WORD ? isLetter : isSymbolPart
            }),
            i + 1
          );
    tokens.push({
      kind,
      text: text.slice(i, iEnd).toLowerCase()
    });
    i = iEnd;
  }
  return tokens;
}

/** Reads tokens front to back */
function createCursor(tokens: Token[]) {
  let iToken = 0;
  return {
    peek: (offset = 0) => tokens[iToken + offset],
    take: () => tokens[iToken++],
    skip(count: number) {
      iToken += count;
    },
    isDone: () => iToken >= tokens.length
  };
}

type Cursor = ReturnType<typeof createCursor>;

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
    if (isEmptyRange || (bounds.maxSeconds !== undefined && bounds.maxSeconds < 0)) {
      return {
        bounds: null,
        error: "No video can be that long and that short at once"
      };
    }

    return {
      bounds,
      error: null
    };
  } catch (e) {
    if (!(e instanceof ExpressionError)) {
      throw e;
    }

    return {
      bounds: null,
      error: e.message
    };
  }
}

/** A length in the shortest units it reads in: "45s", "20m", "1h", "1h30m" */
function formatLengthValue(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  if (seconds !== 0 && totalSeconds >= SECONDS_PER_MINUTE) {
    return formatDuration(totalSeconds);
  }

  const parts = [
    hours > 0 ? `${hours}h` : "",
    minutes > 0 ? `${minutes}m` : "",
    seconds > 0 || totalSeconds === 0 ? `${seconds}s` : ""
  ];
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
