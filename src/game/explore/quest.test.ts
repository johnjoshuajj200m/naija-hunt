import { afterEach, describe, expect, it, vi } from "vitest";

import { playPath, readPlayQuery } from "./playSession";
import { CLUE_STORAGE_KEY, isClueFound, loadQuest, markClueFound, readStoredClue, resetQuest, writeStoredClue } from "./quest";

afterEach(() => {
  vi.restoreAllMocks();
  resetQuest();
  localStorage.clear();
});

describe("play query", () => {
  it("reads play, overview and a one-shot new game", () => {
    expect(readPlayQuery("?play=1")).toEqual({ playing: true, overview: false, fresh: false });
    expect(readPlayQuery("?play=1&view=overview&new=1")).toEqual({ playing: true, overview: true, fresh: true });
    expect(readPlayQuery("")).toEqual({ playing: false, overview: false, fresh: false });
  });

  it("toggles play and drops the new-game flag without dropping stats", () => {
    expect(playPath(true, "http://localhost/?stats=1")).toBe("/?stats=1&play=1");
    expect(playPath(false, "http://localhost/?play=1&at=clue&stats=1&new=1")).toBe("/?stats=1");
  });
});

describe("clue persistence", () => {
  it("collects once and survives a reload of the module state", () => {
    expect(markClueFound()).toBe(true);
    expect(markClueFound()).toBe(false);
    expect(localStorage.getItem(CLUE_STORAGE_KEY)).toBe("1");
    expect(isClueFound()).toBe(true);

    loadQuest();
    expect(isClueFound()).toBe(true);
  });

  it("clears the clue for a new game", () => {
    markClueFound();
    resetQuest();
    expect(isClueFound()).toBe(false);
    expect(localStorage.getItem(CLUE_STORAGE_KEY)).toBeNull();
  });

  it("treats a blocked store as a miss and does not throw", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readStoredClue()).toBe(false);
    expect(() => writeStoredClue(true)).not.toThrow();
    expect(markClueFound()).toBe(true);
    expect(isClueFound()).toBe(true);
  });
});
