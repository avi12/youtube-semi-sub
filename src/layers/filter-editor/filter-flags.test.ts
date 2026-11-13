import { describe, expect, it } from "vitest";

import { setFilterFlag } from "./filter-flags";

describe("setFilterFlag", () => {
  it("adds a flag in canonical order", () => {
    expect(
      setFilterFlag({
        flags: "s",
        flag: "i",
        isEnabled: true
      })
    ).toBe("is");
  });

  it("removes a flag", () => {
    expect(
      setFilterFlag({
        flags: "ims",
        flag: "m",
        isEnabled: false
      })
    ).toBe("is");
  });

  it("turns u off when v turns on and the other way round", () => {
    expect(
      setFilterFlag({
        flags: "iu",
        flag: "v",
        isEnabled: true
      })
    ).toBe("iv");
    expect(
      setFilterFlag({
        flags: "iv",
        flag: "u",
        isEnabled: true
      })
    ).toBe("iu");
  });

  it("drops flags outside the allowed set", () => {
    expect(
      setFilterFlag({
        flags: "gi",
        flag: "s",
        isEnabled: true
      })
    ).toBe("is");
  });
});
