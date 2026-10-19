import { BUILDINGS } from "../scenes/junction/buildingList";
import { BUSINESSES } from "./businesses";
import { COURT_INTERIORS } from "./court/courtPlan";
import type { InteriorDef } from "./interiors";
import { planInterior } from "./roomPlan";

/** One room per business, planned against the building its street door is in. */
export const STREET_INTERIORS: readonly InteriorDef[] = BUSINESSES.map((business) => {
  const building = BUILDINGS.find((entry) => entry.id === business.buildingId);
  if (!building) {
    throw new Error(`Business "${business.id}" names a building that does not exist: ${business.buildingId}.`);
  }
  return planInterior(business, building);
});

/**
 * Every room the district has: the street businesses', then the rooms inside Palm Court that are reached from
 * another room (its stair core, lift, halls and upper units).
 */
export const INTERIORS: readonly InteriorDef[] = [...STREET_INTERIORS, ...COURT_INTERIORS];

export function interiorById(id: string): InteriorDef | undefined {
  return INTERIORS.find((interior) => interior.id === id);
}
