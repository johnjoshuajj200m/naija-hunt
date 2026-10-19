import { BUILDINGS } from "../scenes/junction/junctionBuildings";
import { resolveEntrances, type ResolvedEntrance } from "./entrances";

/** Every entrance placed against the real building list. Resolved once; the list never changes at runtime. */
export const WORLD_ENTRANCES: readonly ResolvedEntrance[] = resolveEntrances(BUILDINGS);

export function worldEntrance(id: string): ResolvedEntrance {
  const found = WORLD_ENTRANCES.find((entrance) => entrance.id === id);
  if (!found) {
    throw new Error(`No entrance "${id}".`);
  }
  return found;
}
