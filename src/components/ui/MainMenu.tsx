import type { MenuPanel } from "./PrototypeSheet";

type MainMenuProps = {
  clueFound: boolean;
  onEnter: () => void;
  onNewGame: () => void;
  onOpen: (panel: MenuPanel) => void;
};

const shortcuts: Array<{ panel: MenuPanel; label: string }> = [
  { panel: "map", label: "Map" },
  { panel: "inventory", label: "Inventory" },
  { panel: "character", label: "Character" },
];

export function MainMenu({ clueFound, onEnter, onNewGame, onOpen }: MainMenuProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4 sm:p-5 lg:w-[23rem] lg:p-6">
      <header className="pointer-events-auto flex items-center gap-3 bg-forest-900/80 px-3 py-2">
        <span
          aria-hidden="true"
          className="grid size-11 shrink-0 place-items-center bg-forest-900 font-display text-lg font-bold text-gold-400"
        >
          NH
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-3xl leading-none text-sand-50 sm:text-4xl">Naija Hunt</h1>
          <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-sand-100">Palm Mile</p>
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-sand-300">
            Fictional district · Visual preview
          </p>
        </div>
      </header>

      <div className="pointer-events-auto bg-forest-900/88 px-4 py-4 backdrop-blur-sm">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-gold-400">Featured objective</p>
        <h2 className="mt-1 font-display text-2xl text-sand-50">Palm Mile cache</h2>
        <p className="mt-1 text-sm leading-relaxed text-sand-100">
          {clueFound
            ? "The Palm Mile marker is already yours on this browser."
            : "A gold marker stands on Palm Plaza. Walk the streets and take it."}
        </p>

        <button
          type="button"
          aria-describedby="prototype-note"
          onClick={onEnter}
          className="mt-4 flex min-h-12 w-full items-center justify-center bg-gold-500 text-sm font-semibold uppercase tracking-[0.16em] text-forest-900 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-sand-50"
        >
          Enter district
        </button>
        <p id="prototype-note" className="mt-2 text-xs leading-relaxed text-sand-300">
          Starts the walk through Palm Mile. The figure is a placeholder.
        </p>
        {clueFound ? (
          <button
            type="button"
            onClick={onNewGame}
            className="mt-2 min-h-12 w-full border border-sand-300/40 text-sm font-semibold uppercase tracking-[0.14em] text-sand-50"
          >
            New game
          </button>
        ) : null}

        <div className="mt-3 grid grid-cols-3 gap-2">
          {shortcuts.map((shortcut) => (
            <button
              key={shortcut.panel}
              type="button"
              onClick={() => onOpen(shortcut.panel)}
              className="min-h-12 border border-sand-300/35 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-sand-50 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-gold-500"
            >
              {shortcut.label}
            </button>
          ))}
        </div>

        <nav aria-label="Primary" className="mt-3 grid grid-cols-3 gap-2 border-t border-sand-300/20 pt-3">
          <button type="button" aria-current="page" className="min-h-12 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-gold-400">
            Explore
          </button>
          <button
            type="button"
            onClick={() => onOpen("inventory")}
            className="min-h-12 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-sand-100"
          >
            Inventory
          </button>
          <button
            type="button"
            onClick={() => onOpen("profile")}
            className="min-h-12 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-sand-100"
          >
            Profile
          </button>
        </nav>
      </div>
    </div>
  );
}
