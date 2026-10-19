/** The Palm Mile clue, remembered in this browser only. */

export const CLUE_STORAGE_KEY = "naija-hunt.palm-mile-clue";

let found = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function readStoredClue(): boolean {
  try {
    return window.localStorage.getItem(CLUE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeStoredClue(value: boolean): void {
  try {
    if (value) {
      window.localStorage.setItem(CLUE_STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(CLUE_STORAGE_KEY);
    }
  } catch {
    // Private mode or a full store. This page still shows the right objective.
  }
}

export function loadQuest(): void {
  found = readStoredClue();
  emit();
}

export function isClueFound(): boolean {
  return found;
}

/** Returns false when the clue was already taken, so the UI cannot collect it twice. */
export function markClueFound(): boolean {
  if (found) {
    return false;
  }
  found = true;
  writeStoredClue(true);
  emit();
  return true;
}

export function resetQuest(): void {
  found = false;
  writeStoredClue(false);
  emit();
}

export function subscribeQuest(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getQuestSnapshot(): boolean {
  return found;
}
