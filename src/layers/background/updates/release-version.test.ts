import { describe, expect, it } from "vitest";

import { isNewerVersion, parseLatestReleaseVersion } from "./release-version";

const STABLE_RELEASE = {
  tag_name: "v1.2.3",
  draft: false,
  prerelease: false
};

describe("isNewerVersion", () => {
  it("compares each segment as a number", () => {
    expect(
      isNewerVersion({
        candidate: "1.10.0",
        current: "1.9.0"
      })
    ).toBe(true);
    expect(
      isNewerVersion({
        candidate: "2.0",
        current: "1.99.99"
      })
    ).toBe(true);
  });

  it("is false for an equal or older version", () => {
    expect(
      isNewerVersion({
        candidate: "1.2.3",
        current: "1.2.3"
      })
    ).toBe(false);
    expect(
      isNewerVersion({
        candidate: "1.9.0",
        current: "1.10.0"
      })
    ).toBe(false);
  });
});

describe("parseLatestReleaseVersion", () => {
  it("reads the version out of a v-prefixed tag", () => {
    expect(parseLatestReleaseVersion(STABLE_RELEASE)).toBe("1.2.3");
  });

  it("ignores drafts and prereleases", () => {
    expect(
      parseLatestReleaseVersion({
        ...STABLE_RELEASE,
        draft: true
      })
    ).toBeNull();
    expect(
      parseLatestReleaseVersion({
        ...STABLE_RELEASE,
        prerelease: true
      })
    ).toBeNull();
  });

  it("ignores tags that are not v<semver>", () => {
    expect(
      parseLatestReleaseVersion({
        ...STABLE_RELEASE,
        tag_name: "1.2.3"
      })
    ).toBeNull();
    expect(
      parseLatestReleaseVersion({
        ...STABLE_RELEASE,
        tag_name: "v1.2.3-beta"
      })
    ).toBeNull();
  });

  it("ignores a malformed reply", () => {
    expect(parseLatestReleaseVersion({ message: "Not Found" })).toBeNull();
    expect(parseLatestReleaseVersion(null)).toBeNull();
  });
});
