import { isLightTextColor } from "./page-theme";
import { describe, expect, it } from "vitest";

describe("isLightTextColor", () => {
  it.each([
    ["rgb(241, 241, 241)", true],
    ["rgba(255, 255, 255, 0.9)", true],
    ["rgb(15, 15, 15)", false],
    ["rgb(96, 96, 96)", false],
    ["", false],
    ["currentcolor", false]
  ])("reads %j as light: %s", (color, isLight) => {
    expect(isLightTextColor(color)).toBe(isLight);
  });
});
