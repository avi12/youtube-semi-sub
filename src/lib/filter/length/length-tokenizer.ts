import { z } from "@/lib/zod";

const SYMBOL_CHARACTERS = "<>=≤≥-\u2013\u2014~,;&+.";

export enum TokenKind {
  NUMBER = "number",
  WORD = "word",
  SYMBOL = "symbol"
}

const tokenSchema = z.object({
  kind: z.enum(TokenKind),
  text: z.string()
});
type Token = z.infer<typeof tokenSchema>;

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
    const isNumberEnd = !isDigit(character) && character !== ":" && !isPoint;
    if (isNumberEnd) {
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
export function tokenize(text: string) {
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
export function createCursor(tokens: Token[]) {
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

export type Cursor = ReturnType<typeof createCursor>;
