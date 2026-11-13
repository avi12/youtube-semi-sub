import { parseJson } from "@/lib/utils/json";

const JSON_OPENING_BRACKETS = new Set(["{", "["]);
const JSON_CLOSING_BRACKETS = new Set(["}", "]"]);
const JSON_START_PATTERN = /[[{]/;

/**
 * Cuts the object or array opening at `start` out of surrounding text by walking its brackets, skipping any bracket
 * inside a string. Stopping at the first `}` instead would cut short whenever a string in the value contains one
 */
function sliceJsonValue({ text, start }: { text: string; start: number }) {
  const opening = text[start];
  if (opening === undefined || !JSON_OPENING_BRACKETS.has(opening)) {
    return null;
  }

  let depth = 0;
  let isInsideString = false;
  let isEscaped = false;
  for (let i = start; i < text.length; i++) {
    const character = text[i];
    if (isEscaped) {
      isEscaped = false;
      continue;
    }

    if (isInsideString) {
      isEscaped = character === "\\";
      isInsideString = character !== '"';
      continue;
    }

    if (character === '"') {
      isInsideString = true;
      continue;
    }

    if (character !== undefined && JSON_OPENING_BRACKETS.has(character)) {
      depth++;
      continue;
    }

    if (character === undefined || !JSON_CLOSING_BRACKETS.has(character)) {
      continue;
    }

    depth--;

    if (depth === 0) {
      return text.slice(start, i + 1);
    }
  }

  return null;
}

/**
 * LiteRT-LM has no structured-output constraint, so a reply asked for JSON can come back fenced or wrapped in prose.
 * Pulls out the first balanced JSON object or array; null when there is no usable JSON
 */
export function extractJsonFromText(text: string) {
  const json = sliceJsonValue({
    text,
    start: text.search(JSON_START_PATTERN)
  });
  return json === null ? null : parseJson(json);
}
