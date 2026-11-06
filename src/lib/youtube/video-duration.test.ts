import { formatDuration, parseDurationText } from "./video-duration";
import { describe, expect, it } from "vitest";

describe("parseDurationText", () => {
  it("reads minutes and hours", () => {
    expect(parseDurationText("12:34")).toBe(754);
    expect(parseDurationText("0:45")).toBe(45);
    expect(parseDurationText("1:02:03")).toBe(3723);
  });

  it("finds no length in words or malformed text", () => {
    expect(parseDurationText("LIVE")).toBeNull();
    expect(parseDurationText("45")).toBeNull();
    expect(parseDurationText("1:75")).toBeNull();
    expect(parseDurationText(undefined)).toBeNull();
  });
});

describe("formatDuration", () => {
  it("writes a length the way YouTube does", () => {
    expect(formatDuration(45)).toBe("0:45");
    expect(formatDuration(754)).toBe("12:34");
    expect(formatDuration(3723)).toBe("1:02:03");
  });
});
