import type { Level } from "./court/courtIds";

/** Sticks write the axes. The keyboard shares this module so blur can drop every held control. */
export const playInput = {
  moveX: 0,
  moveY: 0,
  look: 0,
  /** Radians added by a pointer drag, consumed each frame. */
  yawAdd: 0,
  interact: false,
};

const held = new Set<string>();

/** Slow enough that a short arrow tap turns a little, and a stalled frame cannot spin the body. */
export const TURN_RATE = 1.15;

function clamp(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

/** The lift floor a key asks for: 1, 2 and 3 are the ground, second and third floors. */
const FLOOR_KEYS: Record<string, Level> = {
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Numpad1: 0,
  Numpad2: 1,
  Numpad3: 2,
};

let floorRequest: Level | null = null;

/** A floor button pressed (a key, or the on-screen panel). It waits until the controller takes it; the lift decides whether it counts. */
export function requestFloor(level: Level): void {
  floorRequest = level;
}

export function consumeFloorRequest(): Level | null {
  const take = floorRequest;
  floorRequest = null;
  return take;
}

export function holdKey(code: string): void {
  held.add(code);
  if (code === "KeyE") {
    playInput.interact = true;
  }
  const floor = FLOOR_KEYS[code];
  if (floor !== undefined) {
    floorRequest = floor;
  }
}

export function releaseKey(code: string): void {
  held.delete(code);
}

export function releaseAllInput(): void {
  held.clear();
  playInput.moveX = 0;
  playInput.moveY = 0;
  playInput.look = 0;
  playInput.yawAdd = 0;
  playInput.interact = false;
  floorRequest = null;
}

export function movementWish(): { forward: number; strafe: number; turn: number; run: boolean } {
  let forward = playInput.moveY;
  let strafe = playInput.moveX;
  let turn = playInput.look;
  if (held.has("KeyW") || held.has("ArrowUp")) {
    forward += 1;
  }
  if (held.has("KeyS") || held.has("ArrowDown")) {
    forward -= 1;
  }
  if (held.has("KeyD")) {
    strafe += 1;
  }
  if (held.has("KeyA")) {
    strafe -= 1;
  }
  if (held.has("ArrowLeft")) {
    turn += 1;
  }
  if (held.has("ArrowRight")) {
    turn -= 1;
  }
  // Shift asks to run. Whether the figure may is decided in locomotion.ts, not here.
  const run = held.has("ShiftLeft") || held.has("ShiftRight");
  return { forward: clamp(forward), strafe: clamp(strafe), turn: clamp(turn), run };
}

export function consumeInteract(): boolean {
  // One press, not the whole time the key is down. A held key must not walk in and straight back out.
  const take = playInput.interact;
  playInput.interact = false;
  return take;
}

export function stepYaw(yaw: number, turn: number, dt: number): number {
  const step = Math.min(Math.max(dt, 0), 0.05);
  return yaw + clamp(turn) * TURN_RATE * step;
}

export type ExplorerHud = {
  x: number;
  z: number;
  yaw: number;
  near: boolean;
  collected: boolean;
  /** What the nearest door does: enter or exit it, or it will not open (closed shop, locked home). */
  door: "enter" | "exit" | "closed" | "locked" | null;
  /** Id of that door (see entrances.ts), for its prompt. */
  entrance: string | null;
  inside: boolean;
  /** Id of the room the player is in, or null on the street. */
  room: string | null;
  /** Close enough to the seller to talk. */
  seller: boolean;
  /** Where the follow camera is: the lens and how far behind the player it sits. For diagnostics and tests. */
  camera: { x: number; z: number; distance: number } | null;
  /** Where the seller is now, while she is in the room the player is in or can be seen from its door. */
  sellerAt: { x: number; z: number } | null;
  /** The player's speed in metres per second. */
  speed: number;
  /** The sliding glass door nearest the player (within a few metres) and how open it is, 0 shut to 1 open. */
  glass: { id: string; open: number } | null;
  /** The player's height above the street, metres: 0 on the street and on Palm Court's ground floor, more on the stairs and upper floors. */
  y?: number;
  /** Id of Palm Court's floor the player is on ("ground", "second", "third"), or null anywhere else. */
  floor?: string | null;
  /** Id of the rentable unit the player is in (PC-2A ...), or null. */
  unit?: string | null;
  /** The lift, while the player is in or beside it. */
  lift?: LiftHud | null;
  /** The floor whose lift call button is in reach, if any. */
  call?: number | null;
  /** Why the last lift press was not taken, for a moment. */
  liftNote?: string | null;
};

/** What the on-screen lift panel needs. */
export type LiftHud = {
  phase: "closed" | "opening" | "open" | "closing" | "moving";
  /** The floor the cabin is at (0 ground, 1 second, 2 third). */
  floor: number;
  /** The floor the indicator shows. */
  shown: number;
  target: number | null;
  /** Doors, 0 shut to 1 open. */
  open: number;
  /** The player is inside the cabin. */
  inCabin: boolean;
};

const initial: ExplorerHud = {
  x: 0,
  z: 0,
  yaw: 0,
  near: false,
  collected: false,
  door: null,
  entrance: null,
  inside: false,
  room: null,
  seller: false,
  camera: null,
  sellerAt: null,
  speed: 0,
  glass: null,
};
let hud: ExplorerHud = initial;
const listeners = new Set<() => void>();

export function publishExplorer(next: ExplorerHud): void {
  hud = next;
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeExplorer(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getExplorerSnapshot(): ExplorerHud {
  return hud;
}
