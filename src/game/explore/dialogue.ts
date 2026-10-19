import type { DialogueLine, DialogueScript } from "./shopkeeper";

/** The open conversation, if any. Replaced, never mutated, so React can read it by reference. */
export type DialogueSnapshot = {
  script: DialogueScript | null;
  index: number;
};

const closed: DialogueSnapshot = { script: null, index: 0 };
let state: DialogueSnapshot = closed;
const listeners = new Set<() => void>();

function set(next: DialogueSnapshot): void {
  state = next;
  for (const listener of listeners) {
    listener();
  }
}

export function getDialogueSnapshot(): DialogueSnapshot {
  return state;
}

export function subscribeDialogue(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isDialogueOpen(): boolean {
  return state.script !== null;
}

export function currentLine(snapshot: DialogueSnapshot = state): DialogueLine | null {
  return snapshot.script ? (snapshot.script.lines[snapshot.index] ?? null) : null;
}

/** Opens a script at its first line. Does nothing if one is already open, so a repeat press cannot restart it. */
export function openDialogue(script: DialogueScript): boolean {
  if (state.script || script.lines.length === 0) {
    return false;
  }
  set({ script, index: 0 });
  return true;
}

/** Moves to the next line, or closes after the last one. Returns what happened. */
export function advanceDialogue(): "next" | "closed" | "idle" {
  if (!state.script) {
    return "idle";
  }
  if (state.index + 1 < state.script.lines.length) {
    set({ script: state.script, index: state.index + 1 });
    return "next";
  }
  set(closed);
  return "closed";
}

export function closeDialogue(): void {
  if (state.script) {
    set(closed);
  }
}
