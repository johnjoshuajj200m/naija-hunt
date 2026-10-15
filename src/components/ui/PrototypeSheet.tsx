export type MenuPanel = "map" | "inventory" | "character" | "profile";

const panels: Record<MenuPanel, { title: string; body: string; future?: readonly string[] }> = {
  map: {
    title: "Map",
    body: "The district map is not built yet. Palm Mile is fictional and can only be seen in the 3D view.",
  },
  inventory: {
    title: "Inventory",
    body: "Inventory is not built yet. Nothing is stored, and nothing can be collected.",
  },
  character: {
    title: "Character",
    body: "The protagonist is not in this build. No character is standing in Palm Mile. A licensed model will be added separately.",
  },
  profile: {
    title: "Profile",
    body: "These systems are planned for later milestones.",
    future: ["Crews", "Chat", "Heists", "Multiplayer"],
  },
};

type PrototypeSheetProps = {
  panel: MenuPanel;
  onClose: () => void;
};

export function PrototypeSheet({ panel, onClose }: PrototypeSheetProps) {
  const content = panels[panel];

  return (
    <div className="absolute inset-0 z-20 flex items-end justify-center bg-forest-900/75 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="prototype-sheet-title"
        className="w-full max-w-md border border-gold-500/50 bg-forest-900 px-5 py-5 text-sand-50 shadow-2xl"
      >
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-gold-400">Not built yet</p>
        <h2 id="prototype-sheet-title" className="mt-2 font-display text-3xl text-sand-50">
          {content.title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-sand-100">{content.body}</p>
        {content.future && (
          <>
            <ul className="mt-4 flex flex-wrap gap-2">
              {content.future.map((item) => (
                <li key={item} className="border border-sand-300/30 px-3 py-1 text-sm text-sand-100">
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-sand-300">None of these exist yet.</p>
          </>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-5 min-h-12 w-full border border-gold-500/70 bg-forest-800 text-sm font-semibold uppercase tracking-[0.14em] text-sand-50 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-gold-500"
        >
          Close
        </button>
      </div>
    </div>
  );
}
