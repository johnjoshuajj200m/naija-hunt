import { lazy, Suspense, useLayoutEffect, useState, useSyncExternalStore } from "react";

import { MainMenu } from "../components/ui/MainMenu";
import { PrototypeSheet, type MenuPanel } from "../components/ui/PrototypeSheet";
import { ExploreHud } from "../game/explore/ExploreHud";
import { releaseAllInput } from "../game/explore/playInput";
import { playPath, readPlayQuery, type PlayQuery } from "../game/explore/playSession";
import { getQuestSnapshot, loadQuest, resetQuest, subscribeQuest } from "../game/explore/quest";

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
  const [mode, setMode] = useState<PlayQuery>(() => {
    const initial = readPlayQuery(window.location.search);
    if (initial.fresh) {
      resetQuest();
      window.history.replaceState({}, "", playPath(initial.playing, window.location.href));
      return readPlayQuery(window.location.search);
    }
    loadQuest();
    return initial;
  });
  const [run, setRun] = useState(0);
  const clueFound = useSyncExternalStore(subscribeQuest, getQuestSnapshot, getQuestSnapshot);

  useLayoutEffect(() => {
    const onPop = () => setMode(readPlayQuery(window.location.search));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const enterDistrict = () => {
    releaseAllInput();
    window.history.pushState({}, "", playPath(true, window.location.href));
    setMode(readPlayQuery(window.location.search));
    setPanel(null);
  };

  const returnToMenu = () => {
    releaseAllInput();
    window.history.pushState({}, "", playPath(false, window.location.href));
    setMode(readPlayQuery(window.location.search));
  };

  const newGame = () => {
    releaseAllInput();
    resetQuest();
    setRun((value) => value + 1);
    window.history.pushState({}, "", playPath(true, window.location.href));
    setMode(readPlayQuery(window.location.search));
    setPanel(null);
  };

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
              <DistrictPreview playing={mode.playing} run={run} />
            </div>
          </Suspense>
        ) : (
          <div className="flex h-full items-end bg-forest-900 p-6 pb-40 lg:items-center lg:pb-6">
            <p className="max-w-sm text-sm leading-relaxed text-sand-100">3D preview unavailable on this device.</p>
          </div>
        )}
      </section>

      {!mode.playing && <MainMenu clueFound={clueFound} onEnter={enterDistrict} onNewGame={newGame} onOpen={setPanel} />}
      {mode.playing && !mode.overview && <ExploreHud onMenu={returnToMenu} onNewGame={newGame} />}
      {panel && <PrototypeSheet panel={panel} onClose={() => setPanel(null)} />}
    </div>
  );
}
