import { lazy, Suspense, useState } from "react";

import { MainMenu } from "../components/ui/MainMenu";
import { PrototypeSheet, type MenuPanel } from "../components/ui/PrototypeSheet";

// Three.js is large, so the 3D scene loads after the menu instead of inside the first bundle.
const DistrictPreview = lazy(() =>
  import("../game/scenes/DistrictPreview").then((module) => ({ default: module.DistrictPreview })),
);

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function App() {
  const [webgl] = useState(detectWebGL);
  const [panel, setPanel] = useState<MenuPanel | null>(null);
  const [entryAttempted, setEntryAttempted] = useState(false);

  return (
    <div className="relative h-dvh overflow-hidden bg-forest-900 text-sand-50">
      <section
        aria-label="Live 3D preview of Palm Mile, a fictional Lagos-inspired district"
        className="absolute inset-0"
      >
        {webgl ? (
          <Suspense
            fallback={
              <p aria-live="polite" className="p-6 text-sm text-sand-100">
                Loading the 3D preview.
              </p>
            }
          >
            <div className="h-full w-full" aria-hidden="true">
              <DistrictPreview />
            </div>
          </Suspense>
        ) : (
          <div className="flex h-full items-end bg-forest-900 p-6 pb-40 lg:items-center lg:pb-6">
            <p className="max-w-sm text-sm leading-relaxed text-sand-100">3D preview unavailable on this device.</p>
          </div>
        )}
      </section>

      <MainMenu entryAttempted={entryAttempted} onEnter={() => setEntryAttempted(true)} onOpen={setPanel} />
      {panel && <PrototypeSheet panel={panel} onClose={() => setPanel(null)} />}
    </div>
  );
}
