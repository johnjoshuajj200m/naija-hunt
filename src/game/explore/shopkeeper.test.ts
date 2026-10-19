import * as THREE from "three";
import { afterEach, describe, expect, it } from "vitest";

import { collisionBoxes } from "./collision";
import {
  advanceDialogue,
  closeDialogue,
  currentLine,
  getDialogueSnapshot,
  isDialogueOpen,
  openDialogue,
  subscribeDialogue,
} from "./dialogue";
import { createExplorer } from "./explorerMesh";
import { interactAction, interactTarget } from "./interaction";
import { worldEntrance } from "./entranceWorld";
import { DISTRICT } from "./districtModel";
import { interiorBounds, interiorBoxes } from "./interiors";
import { roomOwner, tagOwner, applyVisibility } from "./spaces";
import { COUNTER, MAMA_PUT_INTERIOR, ROOM_NAME } from "./mamaPut";
import { blocked, EXPLORER_RADIUS, PLAY_BOUNDS, SPAWNS } from "./movement";
import { walk } from "./testKit";
import { consumeInteract, holdKey, releaseAllInput, releaseKey } from "./playInput";
import { animateSeller, createSeller, disposeSeller } from "./sellerMesh";
import {
  formatAvailability,
  formatPrice,
  inSellerReach,
  SELLER,
  sellerBody,
  SELLER_REACH,
  SELLER_SCRIPT,
  STOCK,
} from "./shopkeeper";

/** Horizontal extent of the vertices between two heights. */
function widthBetween(group: THREE.Object3D, lowY: number, highY: number): number {
  group.updateMatrixWorld(true);
  const point = new THREE.Vector3();
  let min = Infinity;
  let max = -Infinity;
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      const position = object.geometry.getAttribute("position");
      for (let i = 0; i < position.count; i += 1) {
        point.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
        if (point.y >= lowY && point.y <= highY) {
          min = Math.min(min, point.x);
          max = Math.max(max, point.x);
        }
      }
    }
  });
  return max - min;
}

const room = interiorBoxes(MAMA_PUT_INTERIOR);
const INTERIOR_BOUNDS = interiorBounds(MAMA_PUT_INTERIOR);
const INSIDE_POSE = MAMA_PUT_INTERIOR.insidePose;
const OUTSIDE_POSE = worldEntrance("mama-put").outsidePose;
const street = collisionBoxes();

afterEach(() => {
  closeDialogue();
  releaseAllInput();
});

describe("seller placement", () => {
  it("stands behind the counter, facing the customer side", () => {
    expect(SELLER.x).toBeGreaterThan(COUNTER.maxX);
    expect(SELLER.z).toBeGreaterThan(COUNTER.minZ);
    expect(SELLER.z).toBeLessThan(COUNTER.maxZ);
    // yaw pi/2 faces -x (forward is (-sin yaw, -cos yaw)), toward the counter and the door.
    expect(-Math.sin(SELLER.yaw)).toBeCloseTo(-1);
    expect(-Math.cos(SELLER.yaw)).toBeCloseTo(0);
  });

  it("cannot be walked through, and leaves the counter and the room usable", () => {
    // Her body is a moving solid: it blocks the player where she stands.
    expect(blocked(SELLER.x, SELLER.z, EXPLORER_RADIUS, [...room, sellerBody(SELLER.x, SELLER.z)], INTERIOR_BOUNDS)).toBe(true);
    expect(sellerBody(SELLER.x, SELLER.z).minX).toBeGreaterThan(COUNTER.maxX);
    // A customer can stand at the counter, opposite the seller.
    expect(blocked(COUNTER.minX - EXPLORER_RADIUS - 0.05, SELLER.z, EXPLORER_RADIUS, room, INTERIOR_BOUNDS)).toBe(false);
    // The counter itself blocks, and a customer walking at it stops on their own side.
    expect(blocked((COUNTER.minX + COUNTER.maxX) / 2, SELLER.z, EXPLORER_RADIUS, room, INTERIOR_BOUNDS)).toBe(true);
    // Along the lane between the two tables, level with the seller.
    const pushed = walk({ x: COUNTER.minX - 3, z: -6.2, yaw: -Math.PI / 2 }, { forward: 1, strafe: 0 }, 2, room, INTERIOR_BOUNDS);
    expect(blocked(pushed.x, pushed.z, EXPLORER_RADIUS, room, INTERIOR_BOUNDS)).toBe(false);
    expect(pushed.x).toBeLessThan(COUNTER.minX);
    expect(pushed.x).toBeGreaterThan(COUNTER.minX - EXPLORER_RADIUS - 0.2);
  });

  it("is only reachable once the player has walked up to the counter", () => {
    expect(inSellerReach(INSIDE_POSE.x, INSIDE_POSE.z)).toBe(false);
    expect(inSellerReach(COUNTER.minX - EXPLORER_RADIUS - 0.05, SELLER.z)).toBe(true);
    expect(inSellerReach(SELLER.x + SELLER_REACH + 0.1, SELLER.z)).toBe(false);
  });
});

describe("seller figure", () => {
  it("is a different, wider placeholder figure from the player", () => {
    const seller = createSeller();
    const player = createExplorer();
    const sellerBox = new THREE.Box3().setFromObject(seller);
    expect(seller.name).toBe("PLACEHOLDER_seller");
    // The silhouette differs low down: a flared wrapper against a pair of legs.
    expect(widthBetween(seller, 0.1, 0.4)).toBeGreaterThan(widthBetween(player, 0.1, 0.4) + 0.2);
    expect(sellerBox.min.y).toBeGreaterThanOrEqual(0);
    expect(sellerBox.max.y).toBeLessThan(1.9);

    const colours = (group: THREE.Object3D) => {
      const set = new Set<string>();
      group.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          const attribute = object.geometry.getAttribute("color");
          for (let i = 0; i < attribute.count; i += 1) {
            set.add(new THREE.Color(attribute.getX(i), attribute.getY(i), attribute.getZ(i)).getHexString());
          }
        }
      });
      return set;
    };
    const sellerColours = colours(seller);
    const playerColours = colours(player);
    const shared = [...sellerColours].filter((hex) => playerColours.has(hex));
    // The outfit is its own palette; only incidental colours may overlap.
    expect(shared.length).toBeLessThanOrEqual(2);
    disposeSeller(seller);
  });

  it("idles in place without moving off its mark, and casts no shadow", () => {
    const seller = createSeller();
    const head = seller.getObjectByName("seller-head");
    const torso = seller.getObjectByName("seller-torso");
    expect(head).toBeDefined();
    animateSeller(seller, 0.4);
    const turnA = head?.rotation.y;
    animateSeller(seller, 2.4);
    const turnB = head?.rotation.y;
    expect(turnA).not.toBe(turnB);
    expect(Math.abs(torso?.position.y ?? 9)).toBeLessThan(0.02);
    expect(seller.position.toArray()).toEqual([0, 0, 0]);
    seller.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        expect(object.castShadow).toBe(false);
      }
    });
    disposeSeller(seller);
  });

  it("is hidden with the room, so it only shows inside the shop", () => {
    const district = new THREE.Group();
    const roomGroup = new THREE.Group();
    roomGroup.name = ROOM_NAME;
    tagOwner(roomGroup, roomOwner({ id: "mama-put", buildingId: "market-east-corner", floorId: "ground" }, "interior"));
    const seller = createSeller();
    roomGroup.add(seller);
    district.add(roomGroup);
    const visible = (object: THREE.Object3D): boolean => {
      for (let node: THREE.Object3D | null = object; node; node = node.parent) {
        if (!node.visible) {
          return false;
        }
      }
      return true;
    };

    applyVisibility(district, DISTRICT, { active: null });
    expect(visible(seller)).toBe(false);
    applyVisibility(district, DISTRICT, { active: "mama-put" });
    expect(visible(seller)).toBe(true);
    applyVisibility(district, DISTRICT, { active: null });
    expect(visible(seller)).toBe(false);
    disposeSeller(seller);
  });
});

describe("stock", () => {
  it("lists three placeholder items with a name, a price and an availability", () => {
    expect(STOCK).toHaveLength(3);
    for (const item of STOCK) {
      expect(item.name.length).toBeGreaterThan(0);
      expect(item.price).toBeGreaterThan(0);
      expect(item.quantity).toBeGreaterThanOrEqual(0);
      expect(formatPrice(item)).toContain(String(item.price));
      expect(formatAvailability(item).length).toBeGreaterThan(0);
    }
  });

  it("says plainly that nothing can be bought", () => {
    const text = SELLER_SCRIPT.lines.map((line) => line.text).join(" ");
    expect(text).toMatch(/cannot take a payment/i);
    expect(SELLER_SCRIPT.speaker).toMatch(/prototype/i);
    expect(SELLER_SCRIPT.lines.some((line) => line.showStock)).toBe(true);
  });
});

describe("dialogue state", () => {
  it("opens at the first line, steps through, then closes after the last", () => {
    expect(isDialogueOpen()).toBe(false);
    expect(openDialogue(SELLER_SCRIPT)).toBe(true);
    expect(currentLine()?.text).toBe(SELLER_SCRIPT.lines[0]?.text);
    for (let i = 1; i < SELLER_SCRIPT.lines.length; i += 1) {
      expect(advanceDialogue()).toBe("next");
      expect(currentLine()?.text).toBe(SELLER_SCRIPT.lines[i]?.text);
    }
    expect(advanceDialogue()).toBe("closed");
    expect(isDialogueOpen()).toBe(false);
    expect(advanceDialogue()).toBe("idle");
  });

  it("does not restart when opened again, and Close works at any line", () => {
    openDialogue(SELLER_SCRIPT);
    advanceDialogue();
    expect(openDialogue(SELLER_SCRIPT)).toBe(false);
    expect(getDialogueSnapshot().index).toBe(1);
    closeDialogue();
    expect(isDialogueOpen()).toBe(false);
    expect(getDialogueSnapshot().index).toBe(0);
  });

  it("notifies subscribers and keeps the snapshot stable between changes", () => {
    let calls = 0;
    const off = subscribeDialogue(() => {
      calls += 1;
    });
    openDialogue(SELLER_SCRIPT);
    const first = getDialogueSnapshot();
    expect(getDialogueSnapshot()).toBe(first);
    closeDialogue();
    closeDialogue();
    off();
    expect(calls).toBe(2);
  });
});

describe("interaction priority", () => {
  const nearSeller = { x: -73.6, z: SELLER.z };

  it("talks to the seller only when the player is close enough", () => {
    expect(interactTarget("mama-put", nearSeller.x, nearSeller.z, false)).toEqual({ kind: "seller" });
    expect(interactTarget("mama-put", INSIDE_POSE.x, INSIDE_POSE.z, false)).toBeNull();
  });

  it("keeps the exit door working inside, and the seller never appears on the street", () => {
    expect(interactTarget("mama-put", -76.2, -0.4, false)).toEqual({ kind: "door", action: "exit", entranceId: "mama-put" });
    expect(interactTarget("street", SELLER.x, SELLER.z, false)).toBeNull();
  });

  it("keeps the entrance door and the clue", () => {
    expect(interactTarget("street", OUTSIDE_POSE.x, OUTSIDE_POSE.z, false)).toEqual({ kind: "door", action: "enter", entranceId: "mama-put" });
    expect(interactTarget("street", SPAWNS.clue.x, SPAWNS.clue.z, true)).toEqual({ kind: "clue" });
    expect(interactTarget("street", SPAWNS.clue.x, SPAWNS.clue.z, false)).toBeNull();
  });

  it("maps a press to exactly one action", () => {
    const seller = interactTarget("mama-put", nearSeller.x, nearSeller.z, false);
    const exit = interactTarget("mama-put", -76.2, -0.4, false);
    const enter = interactTarget("street", OUTSIDE_POSE.x, OUTSIDE_POSE.z, false);
    const clue = interactTarget("street", SPAWNS.clue.x, SPAWNS.clue.z, true);
    expect(interactAction(true, false, seller)).toBe("talk");
    expect(interactAction(true, false, exit)).toBe("exit");
    expect(interactAction(true, false, enter)).toBe("enter");
    expect(interactAction(true, false, clue)).toBe("collect");
    expect(interactAction(true, false, null)).toBe("none");
    expect(interactAction(false, false, seller)).toBe("none");
  });

  it("gives every press to an open conversation, never to a door", () => {
    expect(interactAction(true, true, { kind: "door", action: "exit", entranceId: "mama-put" })).toBe("advance-dialogue");
    expect(interactAction(true, true, null)).toBe("advance-dialogue");
    expect(interactAction(false, true, { kind: "seller" })).toBe("none");
  });

  it("does not reopen the conversation while E stays held", () => {
    // Frame 1: E goes down and opens the conversation. Later frames: E is still down, nothing pressed.
    holdKey("KeyE");
    const target = interactTarget("mama-put", nearSeller.x, nearSeller.z, false);
    const first = interactAction(consumeInteract(), isDialogueOpen(), target);
    expect(first).toBe("talk");
    openDialogue(SELLER_SCRIPT);
    for (let frame = 0; frame < 5; frame += 1) {
      expect(interactAction(consumeInteract(), isDialogueOpen(), target)).toBe("none");
    }
    expect(getDialogueSnapshot().index).toBe(0);
    releaseKey("KeyE");
  });

  it("takes the player to the street pose and back without touching the room box list", () => {
    const entered = INSIDE_POSE;
    expect(blocked(entered.x, entered.z, EXPLORER_RADIUS, room, INTERIOR_BOUNDS)).toBe(false);
    expect(blocked(OUTSIDE_POSE.x, OUTSIDE_POSE.z, EXPLORER_RADIUS, street, PLAY_BOUNDS)).toBe(false);
  });
});
