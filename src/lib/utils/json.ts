/** The parsed JSON, or null when the text is not JSON */
export function parseJson(text: string) {
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch {
    return null;
  }
}
