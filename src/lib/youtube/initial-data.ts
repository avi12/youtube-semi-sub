// A youtube.com page's HTML embeds its InnerTube response as `var ytInitialData = {...};</script>`

/** The global that holds the page's InnerTube response */
export const INITIAL_DATA_GLOBAL = "ytInitialData";

const INITIAL_DATA_PATTERN = new RegExp(String.raw`(var ${INITIAL_DATA_GLOBAL} = )(\{.+?\});<\/script>`, "s");

/** The embedded JSON and where it starts in `html`, or null when the page embeds none */
export function findInitialDataJson(html: string) {
  const match = INITIAL_DATA_PATTERN.exec(html);
  const [, declaration = "", json = ""] = match ?? [];
  if (!match) {
    return null;
  }

  return {
    json,
    iJsonStart: match.index + declaration.length
  };
}
