import { useEffect, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";

import {
  advanceDialogue,
  closeDialogue,
  currentLine,
  getDialogueSnapshot,
  subscribeDialogue,
} from "./dialogue";
import { FLOOR_IDS, FLOOR_LABELS, FLOOR_NAMES } from "./court/courtIds";
import { entranceById } from "./entrances";
import { getExplorerSnapshot, playInput, requestFloor, subscribeExplorer } from "./playInput";
import { getQuestSnapshot, subscribeQuest } from "./quest";
import { formatAvailability, formatPrice, SELLER_INTERIOR_ID, STOCK } from "./shopkeeper";

/** The seller's scripted conversation. Compact, sits above the controls, and always has a Close. */
function DialoguePanel() {
  const dialogue = useSyncExternalStore(subscribeDialogue, getDialogueSnapshot, getDialogueSnapshot);
  const line = currentLine(dialogue);
  if (!dialogue.script || !line) {
    return null;
  }
  const last = dialogue.index + 1 >= dialogue.script.lines.length;
  return (
    <div
      role="dialog"
      aria-label="Seller dialogue"
      className="pointer-events-auto absolute inset-x-4 bottom-36 mx-auto max-w-md bg-forest-900/92 px-4 py-3 text-sand-50 ring-1 ring-gold-500/60 lg:inset-x-auto lg:bottom-20 lg:left-4 lg:mx-0 lg:w-80"
    >
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-gold-400">{dialogue.script.speaker}</p>
      <p className="mt-1 text-sm leading-relaxed">{line.text}</p>
      {line.showStock ? (
        <>
          <ul aria-label="Shelf stock" className="mt-2 space-y-0.5 text-xs">
            {STOCK.map((item) => (
              <li key={item.id} className="flex justify-between gap-3">
                <span>{item.name}</span>
                <span className="text-sand-300">
                  {formatPrice(item)} | {formatAvailability(item)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[0.62rem] text-sand-300">Example prices and stock. Nothing can be bought yet.</p>
        </>
      ) : null}
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[0.62rem] text-sand-300">
          {dialogue.index + 1} / {dialogue.script.lines.length}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={closeDialogue}
            className="min-h-11 bg-forest-700 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-sand-50"
          >
            Close
          </button>
          {last ? null : (
            <button
              type="button"
              onClick={() => advanceDialogue()}
              className="min-h-11 bg-gold-500 px-4 text-xs font-semibold uppercase tracking-[0.14em] text-forest-900"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stick({
  label,
  onChange,
}: {
  label: string;
  onChange: (x: number, y: number) => void;
}) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const reset = () => setKnob({ x: 0, y: 0 });
    window.addEventListener("blur", reset);
    return () => window.removeEventListener("blur", reset);
  }, []);

  const apply = (x: number, y: number) => {
    setKnob({ x, y });
    onChange(x, y);
  };

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    const length = Math.hypot(x, y) || 1;
    const scale = length > 1 ? 1 / length : 1;
    apply(x * scale, -y * scale);
  };

  return (
    <div
      role="group"
      aria-label={label}
      onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
      onPointerMove={move}
      onPointerUp={() => apply(0, 0)}
      onPointerCancel={() => apply(0, 0)}
      className="pointer-events-auto relative grid h-28 w-28 touch-none place-items-center rounded-full border border-sand-300/50 bg-forest-900/75 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-sand-50"
    >
      <span
        aria-hidden="true"
        className="absolute size-10 rounded-full bg-gold-500/90"
        style={{ transform: `translate(${knob.x * 32}px, ${-knob.y * 32}px)` }}
      />
      <span className="relative">{label}</span>
    </div>
  );
}

type ExploreHudProps = {
  onMenu: () => void;
  onNewGame: () => void;
};

/** Objective, return path, and the on-screen move, look and interact controls. */
export function ExploreHud({ onMenu, onNewGame }: ExploreHudProps) {
  const hud = useSyncExternalStore(subscribeExplorer, getExplorerSnapshot, getExplorerSnapshot);
  const found = useSyncExternalStore(subscribeQuest, getQuestSnapshot, getQuestSnapshot);
  const touch = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse), (max-width: 1023px)").matches;
  const objective = found ? "Clue found. The Palm Mile marker is yours." : "Find the gold marker on Palm Plaza.";
  const dialogue = useSyncExternalStore(subscribeDialogue, getDialogueSnapshot, getDialogueSnapshot);
  const talking = dialogue.script !== null;
  const lastLine = talking && dialogue.script !== null && dialogue.index + 1 >= dialogue.script.lines.length;
  const sellerPrompt = hud.seller ? "Talk to the seller. Press E or the button." : "";
  const entrance = hud.entrance ? entranceById(hud.entrance) : undefined;
  const doorPrompt =
    hud.door === "enter"
      ? (entrance?.prompts.enter ?? "")
      : hud.door === "exit"
        ? (entrance?.prompts.exit ?? "")
        : hud.door === "closed" || hud.door === "locked"
          ? (entrance?.prompts.blocked ?? "")
          : "";
  const cluePrompt = !found && hud.near ? "Within reach. Press E or Take clue." : "";
  const calling = hud.call !== undefined && hud.call !== null;
  const callPrompt = calling ? "Call the lift. Press E or the button." : "";
  const lift = hud.lift ?? null;
  const cabinPrompt = lift?.inCabin ? "Choose a floor: the buttons, or the 1, 2 and 3 keys." : "";
  const prompt = talking ? "" : sellerPrompt || doorPrompt || callPrompt || hud.liftNote || cabinPrompt || cluePrompt;
  const place = hud.floor ? `Palm Court, ${FLOOR_NAMES[FLOOR_IDS.indexOf(hud.floor as (typeof FLOOR_IDS)[number])] ?? hud.floor}` : null;
  const actionLabel = talking
    ? lastLine
      ? "Close"
      : "Next"
    : hud.seller
      ? "Talk"
      : calling
        ? "Call lift"
        : hud.door === "enter"
        ? "Enter"
        : hud.door === "exit"
          ? "Leave"
          : hud.door === "closed"
            ? "Closed"
            : hud.door === "locked"
              ? "Locked"
              : found
                ? "Clue found"
                : "Take clue";

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-3">
        <div className="pointer-events-none max-w-xs bg-forest-900/80 px-3 py-2 text-sand-50">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-gold-400">Objective</p>
          <p className="mt-1 text-sm leading-relaxed">{objective}</p>
          {hud.room === null ? (
            <p className="mt-1 text-xs leading-relaxed text-sand-100">Open shops on Market Street to the west: Mama Put and the Cold Room (glass doors), Ankara House, Fresh Bread, Mallam Suya and Spare Parts.</p>
          ) : null}
          {hud.room === null ? (
            <p className="mt-1 text-xs leading-relaxed text-sand-100">Palm Court, on the cross street: three floors, stairs and a lift.</p>
          ) : null}
          {place ? (
            <p data-testid="place-chip" className="mt-1 text-xs font-semibold leading-relaxed text-gold-400">
              {place}
              {hud.unit ? ` | Unit ${hud.unit}` : ""}
            </p>
          ) : null}
          <p className="mt-1 text-[0.62rem] leading-relaxed text-sand-300">
            {hud.room === SELLER_INTERIOR_ID ? "The walking figure and the seller are placeholders." : "The walking figure is a placeholder."}
            {place ? " Tenants and unit names are samples." : ""}
          </p>
        </div>
        <div className="pointer-events-auto flex flex-col gap-2">
          <button
            type="button"
            onClick={onMenu}
            className="min-h-12 min-w-24 bg-forest-900/85 px-3 text-sm font-semibold uppercase tracking-[0.14em] text-sand-50"
          >
            Menu
          </button>
          {found ? (
            <button
              type="button"
              onClick={onNewGame}
              className="min-h-12 bg-gold-500 px-3 text-sm font-semibold uppercase tracking-[0.14em] text-forest-900"
            >
              New game
            </button>
          ) : null}
        </div>
      </div>
      <p role="status" className="sr-only">
        {prompt || objective}
      </p>
      <pre data-testid="explorer-state" className="sr-only">
        {JSON.stringify({
          x: Math.round(hud.x * 10) / 10,
          z: Math.round(hud.z * 10) / 10,
          yaw: Math.round(hud.yaw * 100) / 100,
          near: hud.near,
          collected: found,
          door: hud.door,
          entrance: hud.entrance,
          inside: hud.inside,
          room: hud.room,
          seller: hud.seller,
          glass: hud.glass ? { id: hud.glass.id, open: Math.round(hud.glass.open * 100) / 100 } : null,
          camera: hud.camera
            ? { x: Math.round(hud.camera.x * 100) / 100, z: Math.round(hud.camera.z * 100) / 100, distance: Math.round(hud.camera.distance * 100) / 100 }
            : null,
          sellerAt: hud.sellerAt ? { x: Math.round(hud.sellerAt.x * 100) / 100, z: Math.round(hud.sellerAt.z * 100) / 100 } : null,
          speed: Math.round(hud.speed * 10) / 10,
          talking,
          y: Math.round((hud.y ?? 0) * 100) / 100,
          floor: hud.floor ?? null,
          unit: hud.unit ?? null,
          lift: lift ? { ...lift, open: Math.round(lift.open * 100) / 100 } : null,
          call: hud.call ?? null,
          liftNote: hud.liftNote ?? null,
        })}
      </pre>

      {lift?.inCabin ? (
        <div
          role="group"
          aria-label="Lift controls"
          data-testid="lift-panel"
          className="pointer-events-auto absolute bottom-44 right-4 flex flex-col items-center gap-2 bg-forest-900/90 p-2 text-sand-50 ring-1 ring-gold-500/60 lg:bottom-24"
        >
          <p data-testid="lift-indicator" className="min-w-14 bg-black px-2 py-1 text-center text-lg font-bold text-gold-400">
            {lift.phase === "moving" && lift.target !== null ? (lift.target > lift.floor ? "\u25B2 " : "\u25BC ") : ""}
            {FLOOR_LABELS[lift.shown as 0 | 1 | 2]}
          </p>
          {[2, 1, 0].map((level) => (
            <button
              key={level}
              type="button"
              data-testid={`lift-floor-${level}`}
              aria-label={`Floor ${FLOOR_LABELS[level as 0 | 1 | 2]}`}
              aria-pressed={lift.target === level}
              onClick={() => requestFloor(level as 0 | 1 | 2)}
              className={`grid min-h-12 min-w-12 place-items-center rounded-full text-base font-bold ${
                lift.target === level
                  ? "bg-gold-500 text-forest-900"
                  : lift.floor === level && lift.phase !== "moving"
                    ? "bg-emerald-400 text-forest-900"
                    : "bg-forest-700 text-sand-50"
              }`}
            >
              {FLOOR_LABELS[level as 0 | 1 | 2]}
            </button>
          ))}
          <p data-testid="lift-status" className="text-[0.62rem] uppercase tracking-[0.12em] text-sand-300">
            {lift.phase === "moving" ? "Moving" : lift.phase === "closed" ? "Doors closed" : lift.phase === "open" ? "Doors open" : "Doors moving"}
          </p>
        </div>
      ) : null}

      {prompt ? (
        <p className="pointer-events-none absolute inset-x-4 bottom-32 mx-auto max-w-sm bg-forest-900/90 px-3 py-2 text-center text-sm font-semibold leading-snug text-gold-400">
          {prompt}
        </p>
      ) : null}

      {talking ? <DialoguePanel /> : null}

      <div className="absolute inset-x-0 bottom-4 flex items-end justify-between px-4">
        {touch ? (
          <Stick
            label="Move"
            onChange={(x, y) => {
              playInput.moveX = x;
              playInput.moveY = y;
            }}
          />
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => {
            playInput.interact = true;
          }}
          className={`pointer-events-auto min-h-12 min-w-36 px-4 text-sm font-semibold uppercase tracking-[0.14em] text-forest-900 ${
            talking || hud.seller || calling || hud.door === "enter" || hud.door === "exit" || (hud.near && !found) ? "bg-gold-500 ring-2 ring-sand-50" : "bg-gold-500"
          }`}
        >
          {actionLabel}
        </button>
        {touch ? <Stick label="Look" onChange={(x) => { playInput.look = x; }} /> : <span />}
      </div>
    </div>
  );
}
