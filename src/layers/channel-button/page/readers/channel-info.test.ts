import { describe, expect, it } from "vitest";

import { MKBHD_ID } from "#channel-button/page/fixtures/channel-ids";

import { toChannelHandle } from "./channel-info";

describe("toChannelHandle", () => {
  it.each([
    ["/@RickAstleyYT", "@RickAstleyYT"],
    ["http://www.youtube.com/@mkbhd", "@mkbhd"],
    ["https://m.youtube.com/@mkbhd/videos", "@mkbhd"],
    ["/@%D7%A2%D7%91%D7%A8%D7%99%D7%AA", "@עברית"]
  ])("reads %s as %s", (url, handle) => {
    expect(toChannelHandle(url)).toBe(handle);
  });

  it.each([`/channel/${MKBHD_ID}`, undefined])("finds no handle in %s", url => {
    expect(toChannelHandle(url)).toBeUndefined();
  });
});
