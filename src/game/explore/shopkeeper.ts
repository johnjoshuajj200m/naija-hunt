import { interiorById } from "./interiorRegistry";
import type { Aabb } from "./movement";
import { npcBody, type NpcZone } from "./npcZone";

/** The room the seller works in. The controller adds the figure to that room's group. */
export const SELLER_INTERIOR_ID = "mama-put";

/** Where she may be: the kitchen behind the serving counter (interiorLayouts.ts). */
export const SELLER_ZONE: NpcZone = (() => {
  const zone = interiorById(SELLER_INTERIOR_ID)?.zones.find((candidate) => candidate.role === "seller");
  if (!zone) {
    throw new Error("The seller's room has no seller zone.");
  }
  return zone;
})();

/**
 * Where the seller stands when she is at home: behind the serving counter, facing the customer side,
 * toward the door. Metres, y up. She walks between the zone's other stations, so this is her place and
 * not her only position.
 */
export const SELLER = SELLER_ZONE.stations[0] as { x: number; z: number; yaw: number };

/** The square her body takes up. Moves with her, so it is a function of where she is. */
export function sellerBody(x: number, z: number): Aabb {
  return npcBody(x, z, SELLER_ZONE.radius);
}

/** How close the player must stand before the seller can be spoken to. Measured from the seller. */
export const SELLER_REACH = 3;

export function inSellerReach(x: number, z: number, at: { x: number; z: number } = SELLER): boolean {
  const dx = x - at.x;
  const dz = z - at.z;
  return dx * dx + dz * dz <= SELLER_REACH * SELLER_REACH;
}

/**
 * Placeholder stock. Display only: there is no wallet, no payment and no inventory behind it.
 * Prices are example numbers in naira, not a pricing decision.
 */
export type ShopItem = {
  id: string;
  name: string;
  /** Placeholder price in naira. */
  price: number;
  /** Units the seller says are on the shelf. Never changes in this build. */
  quantity: number;
};

export const STOCK: readonly ShopItem[] = [
  { id: "water", name: "Bottled water", price: 150, quantity: 12 },
  { id: "bread", name: "Bread", price: 600, quantity: 6 },
  { id: "snack", name: "Plantain chips", price: 250, quantity: 9 },
];

export function formatPrice(item: ShopItem): string {
  return `\u20a6${item.price}`;
}

export function formatAvailability(item: ShopItem): string {
  return item.quantity > 0 ? `${item.quantity} on the shelf` : "none left";
}

export type DialogueLine = {
  text: string;
  /** Show the stock list next to this line. */
  showStock?: boolean;
};

export type DialogueScript = {
  id: string;
  /** Always labelled as a prototype, so the figure is not mistaken for finished character art. */
  speaker: string;
  lines: readonly DialogueLine[];
};

/** Scripted and local. Add lines here; nothing calls a server or a model. */
export const SELLER_SCRIPT: DialogueScript = {
  id: "mama-put-seller",
  speaker: "Mama Put seller (prototype)",
  lines: [
    { text: "Welcome to Mama Put. Come in, come in." },
    { text: "Have a look at what is on the shelf today.", showStock: true },
    { text: "Selling is not switched on yet, so I cannot take a payment. These are only examples." },
    { text: "The gold marker everyone talks about is out on Palm Plaza. Go well!" },
  ],
};
