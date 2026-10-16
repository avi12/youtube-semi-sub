import { settleBefore } from "@/lib/utils/promise";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

const DEADLINE_MS = 1000;

describe("settleBefore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with the value that arrives in time", async () => {
    await expect(
      settleBefore({
        promise: Promise.resolve("value"),
        deadline: Date.now() + DEADLINE_MS
      })
    ).resolves.toBe("value");
  });

  it("resolves with null once the deadline passes first", async () => {
    const settled = settleBefore({
      promise: new Promise(() => {}),
      deadline: Date.now() + DEADLINE_MS
    });
    await vi.advanceTimersByTimeAsync(DEADLINE_MS);
    await expect(settled).resolves.toBeNull();
  });

  it("resolves with null when the promise rejects", async () => {
    await expect(
      settleBefore({
        promise: Promise.reject(new Error("failed")),
        deadline: Date.now() + DEADLINE_MS
      })
    ).resolves.toBeNull();
  });
});
