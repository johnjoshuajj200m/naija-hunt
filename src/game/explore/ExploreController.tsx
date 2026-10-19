import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { doorBlockers, localOf, type DoorFrame } from "./automaticDoor";
import { cameraView, startCamera, stepCamera } from "./cameraRig";
import { collisionBoxes, STREET_CAMERA } from "./collision";
import { CABIN_FRAME, courtDetailOf, LANDING_FRAME } from "./court/courtDetail";
import { COURT_ID } from "./court/courtGeometry";
import { LEVELS, ROOM, stripRoomId, type Level } from "./court/courtIds";
import { COURT_FLOORS, unitOfRoom } from "./court/courtPlan";
import { callLift, indicatedFloor, selectFloor, startLift, stepLift, type LiftRefusal, type LiftState } from "./court/lift";
import { adjacentSpaces, elevationIn, levelAt, PORTALS, portalPassable } from "./court/portals";
import { stairLensY } from "./court/stairs";
import { advanceDialogue, closeDialogue, isDialogueOpen, openDialogue } from "./dialogue";
import { DISTRICT } from "./districtModel";
import { applyDistanceCull, collectCullables, type Cullable } from "./distanceCull";
import { createExplorer } from "./explorerMesh";
import { interactAction, interactTarget } from "./interaction";
import { worldEntrance } from "./entranceWorld";
import { glassDoorsOf, type GlassDoorSet } from "./glassDoor";
import { interiorById, INTERIORS } from "./interiorRegistry";
import {
  interiorBounds,
  interiorBoxes,
  interiorCameraVolume,
  nearDoor,
  roomName,
  STREET,
  type ShopSpace,
} from "./interiors";
import { atRest, speedOf, type Motion } from "./locomotion";
import { canCollect, SPAWNS, type SpawnName } from "./movement";
import {
  consumeFloorRequest,
  consumeInteract,
  holdKey,
  movementWish,
  playInput,
  publishExplorer,
  releaseAllInput,
  releaseKey,
  stepYaw,
} from "./playInput";
import { isClueFound, markClueFound } from "./quest";
import { animateSeller, createSeller, disposeSeller } from "./sellerMesh";
import { startSeller, stepSeller, type SellerState } from "./sellerBehaviour";
import { SELLER, SELLER_INTERIOR_ID, SELLER_SCRIPT, sellerBody } from "./shopkeeper";
import { applyVisibility } from "./spaces";
import { walkFrame } from "./walkFrame";

const STILL = { forward: 0, strafe: 0, turn: 0, run: false };

const REFUSALS: Record<LiftRefusal, string> = {
  moving: "The lift is on its way.",
  doors: "Wait for the doors.",
  elsewhere: "The lift is busy at another floor.",
  outside: "",
};

/**
 * Someone is in the lift's doorway: within DOORWAY_DEPTH of the door plane, on either side, at the floor the cabin
 * is at. The doors never close on them. A person standing further into the cabin is clear of the leaves (a body
 * is 0.3 m wide, a leaf 0.1 m thick), so the doors may close and the cabin may leave.
 */
const DOORWAY_DEPTH = 0.45;
function liftDoorwayOccupied(space: ShopSpace, x: number, z: number, lift: LiftState): boolean {
  if (space !== ROOM.lift && space !== stripRoomId(lift.floor)) {
    return false;
  }
  const frame = space === ROOM.lift ? CABIN_FRAME : LANDING_FRAME;
  const { u, s } = localOf(frame, x, z);
  return Math.abs(s) <= frame.half + 0.3 && Math.abs(u) <= DOORWAY_DEPTH;
}

/** The lift doors' panels as walls in the space the player is in. A landing's doors are shut unless the cabin is there with them open. */
function liftBlockers(space: ShopSpace, lift: LiftState): ReturnType<typeof doorBlockers> {
  const open = lift.phase === "moving" ? 0 : lift.open;
  if (space === ROOM.lift) {
    return doorBlockers(CABIN_FRAME, open);
  }
  const level = LEVELS.find((candidate) => stripRoomId(candidate) === space);
  if (level === undefined) {
    return [];
  }
  const frame: DoorFrame = LANDING_FRAME;
  return doorBlockers(frame, lift.floor === level ? open : 0);
}

type Triple = readonly [number, number, number];

/** "x,y,z" from the address, or null when it is missing or not three numbers. */
function readTriple(text: string | null): Triple | null {
  const parts = (text ?? "").split(",").map(Number);
  return parts.length === 3 && parts.every(Number.isFinite) ? (parts as unknown as Triple) : null;
}

/** The overview camera: a fixed aerial for evidence shots. `eye` and `look` (x,y,z) in the address may move it. */
const OVERVIEW_EYE: Triple = [-28, 48, 12];
const OVERVIEW_LOOK: Triple = [-90, 2, -62];

function readSpawn(): { x: number; z: number; yaw: number; overview: boolean; eye: Triple; look: Triple } {
  const params = new URLSearchParams(window.location.search);
  const name = params.get("at");
  const spawn = name && name in SPAWNS ? SPAWNS[name as SpawnName] : SPAWNS.junction;
  return {
    ...spawn,
    overview: params.get("view") === "overview",
    eye: readTriple(params.get("eye")) ?? OVERVIEW_EYE,
    look: readTriple(params.get("look")) ?? OVERVIEW_LOOK,
  };
}

/**
 * Third-person walk. Keyboard and the on-screen sticks share playInput. The figure is a placeholder
 * with a short stride while it is moving.
 */
export function ExploreController() {
  const { gl, scene } = useThree();
  const streetBoxes = useMemo(() => collisionBoxes(), []);
  // Collision, camera volume and bounds for every room, keyed by room id. Only the active one is read.
  const rooms = useMemo(
    () =>
      new Map(
        INTERIORS.map((def) => [
          def.id,
          { boxes: interiorBoxes(def), camera: interiorCameraVolume(def), bounds: interiorBounds(def) },
        ]),
      ),
    [],
  );
  const start = useMemo(() => readSpawn(), []);
  const figure = useRef<THREE.Group | null>(null);
  const pose = useRef<Motion>({ ...atRest(start) });
  const space = useRef<ShopSpace>(STREET);
  const near = useRef(false);
  const doorSeen = useRef<"enter" | "exit" | "closed" | "locked" | null>(null);
  const entranceSeen = useRef<string | null>(null);
  const roomSeen = useRef<string | null>(null);
  const sellerSeen = useRef(false);
  // The rooms near enough to peek into from the street.
  const peek = useRef(new Set<string>());
  const glassSeen = useRef("");
  const seller = useRef<THREE.Group | null>(null);
  const sellerState = useRef<SellerState>(startSeller());
  const published = useRef(0);
  const gait = useRef({ phase: 0, swing: 0 });
  // The follow camera, and the space it was last placed in. A change of space places it afresh.
  const camera3 = useRef(startCamera(start.yaw));
  const cameraSpace = useRef<ShopSpace | null>(null);
  const collectedAt = useRef<number | null>(null);
  const propCull = useRef<Cullable[] | null>(null);
  // Palm Court: how high the player stands, the lift, the last thing the lift refused, and what the HUD last saw of it.
  const height = useRef(0);
  const lift = useRef<LiftState>(startLift());
  const liftNote = useRef<{ text: string; until: number } | null>(null);
  const liftSeen = useRef("");
  const floorSeen = useRef<string | null>(null);
  const callSeen = useRef<number | null>(null);

  useEffect(() => {
    const created = createExplorer();
    created.position.set(start.x, 0, start.z);
    created.rotation.y = start.yaw;
    figure.current = created;
    scene.add(created);
    return () => {
      figure.current = null;
      scene.remove(created);
      releaseAllInput();
      const materials = new Set<THREE.Material>();
      created.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const list = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of list) {
            materials.add(material);
          }
        }
      });
      for (const material of materials) {
        material.dispose();
      }
    };
  }, [scene, start.x, start.z, start.yaw]);

  useLayoutEffect(() => {
    propCull.current = null;
    const district = scene.getObjectByName("palm-mile-junction");
    if (district) {
      applyVisibility(district, DISTRICT, { active: null });
    }
  }, [scene]);

  // The seller belongs to the room group, so it is shown and hidden with the room and never drawn
  // on the street. It is created here (not merged with the static room) because it animates and walks.
  useEffect(() => {
    const created = createSeller();
    sellerState.current = startSeller();
    created.position.set(SELLER.x, 0, SELLER.z);
    created.rotation.y = SELLER.yaw;
    seller.current = created;
    // A conversation never survives a new walk (New game, menu, reload).
    closeDialogue();
    return () => {
      seller.current = null;
      closeDialogue();
      created.removeFromParent();
      disposeSeller(created);
    };
  }, [scene]);

  useEffect(() => {
    const element = gl.domElement;
    let dragging = false;
    let lastX = 0;
    const down = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }
      dragging = true;
      lastX = event.clientX;
    };
    const move = (event: PointerEvent) => {
      if (!dragging) {
        return;
      }
      playInput.yawAdd += (event.clientX - lastX) * 0.0035;
      lastX = event.clientX;
    };
    const up = () => {
      dragging = false;
    };
    const keyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }
      if (event.code === "Escape") {
        closeDialogue();
        return;
      }
      holdKey(event.code);
    };
    const keyUp = (event: KeyboardEvent) => {
      releaseKey(event.code);
    };
    const stop = () => {
      dragging = false;
      releaseAllInput();
    };
    const hidden = () => {
      if (document.hidden) {
        stop();
      }
    };
    element.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      element.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", hidden);
      releaseAllInput();
    };
  }, [gl]);

  useFrame(({ clock, camera, scene: frameScene }, dt) => {
    const body = figure.current;
    if (!body) {
      return;
    }
    const current = pose.current;
    // While the seller is talking the player stands still. Keys and sticks stay tracked, so nothing
    // is stuck on close: whatever is still held simply resumes.
    const talking = isDialogueOpen();
    const wish = talking ? STILL : movementWish();
    const drag = talking ? 0 : Math.max(-0.12, Math.min(0.12, playInput.yawAdd));
    playInput.yawAdd = 0;
    current.yaw = stepYaw(current.yaw, wish.turn, dt) + drag;

    const district = frameScene.getObjectByName("palm-mile-junction");
    const glass: GlassDoorSet | undefined = district ? glassDoorsOf(district) : undefined;

    // The seller works her kitchen while she can be seen (the room is the player's, or its door is near).
    const sellerRoomActive = space.current === SELLER_INTERIOR_ID;
    const sellerSeen3d = sellerRoomActive || (space.current === STREET && peek.current.has(SELLER_INTERIOR_ID));
    if (sellerSeen3d) {
      sellerState.current = stepSeller(sellerState.current, { dt, talking, player: current });
    }
    const sellerPose = sellerState.current.pose;

    // The lift runs on its own clock. It never closes on someone in its doorway, and a floor button only counts from inside the cabin.
    lift.current = stepLift(lift.current, dt, liftDoorwayOccupied(space.current, current.x, current.z, lift.current));
    const floorPressed = consumeFloorRequest();
    if (floorPressed !== null && space.current === ROOM.lift) {
      const result = selectFloor(lift.current, floorPressed, true);
      lift.current = result.state;
      if (!result.accepted && result.refusal) {
        liftNote.current = { text: REFUSALS[result.refusal], until: clock.elapsedTime + 2.5 };
      }
    }

    // Walls, furniture, people and any door panel that has not finished opening block the move. The player's
    // height follows the floor (stairs, the cabin); a step onto nothing is refused. Crossing a doorway switches
    // space in place (no teleport), then the doors see where the player is.
    const doors = {
      blockers: () => [...(glass ? glass.blockers() : []), ...liftBlockers(space.current, lift.current)],
      update: (step: number, x: number, z: number) => glass?.update(step, x, z),
    };
    const stepped = walkFrame({
      pose: current,
      input: wish,
      dt,
      space: space.current,
      street: streetBoxes,
      rooms,
      doors,
      bodies: sellerRoomActive ? [sellerBody(sellerPose.x, sellerPose.z)] : undefined,
      elevation: {
        y: height.current,
        resolve: (where, x, z, previous) => elevationIn(where, x, z, previous, lift.current),
        portals: PORTALS,
        passable: (portal) => portalPassable(portal, lift.current),
      },
    });
    const moved = stepped.moved;
    current.x = stepped.pose.x;
    current.z = stepped.pose.z;
    current.vx = stepped.pose.vx;
    current.vz = stepped.pose.vz;
    space.current = stepped.space;
    height.current = stepped.y;

    const pressed = consumeInteract();
    const wasFound = isClueFound();
    const reachBefore = space.current === STREET && canCollect(current.x, current.z, wasFound);
    const target = interactTarget(space.current, current.x, current.z, reachBefore, sellerPose);
    const action = interactAction(pressed, talking, target);
    if (action === "advance-dialogue") {
      advanceDialogue();
    } else if (action === "talk") {
      openDialogue(SELLER_SCRIPT);
    } else if ((action === "enter" || action === "exit") && target?.kind === "door") {
      // Entering takes the room's own start pose. Leaving stands the player outside that room's door.
      const destination =
        action === "enter" ? interiorById(target.entranceId)?.insidePose : worldEntrance(target.entranceId).outsidePose;
      if (destination) {
        space.current = action === "enter" ? target.entranceId : STREET;
        current.x = destination.x;
        current.z = destination.z;
        current.yaw = destination.yaw;
        current.vx = 0;
        current.vz = 0;
      }
    } else if (action === "call-lift" && target?.kind === "lift-call") {
      const result = callLift(lift.current, target.level);
      lift.current = result.state;
      if (!result.accepted && result.refusal) {
        liftNote.current = { text: REFUSALS[result.refusal], until: clock.elapsedTime + 2.5 };
      }
    } else if (action === "collect") {
      markClueFound();
    }
    if (district) {
      courtDetailOf(district)?.update(lift.current);
    }
    body.position.set(current.x, height.current, current.z);
    body.rotation.y = current.yaw;

    const step = Math.min(dt, 0.05);
    gait.current.phase += moved ? 10 * step : 0;
    const targetSwing = moved ? Math.sin(gait.current.phase) * 0.55 : 0;
    gait.current.swing += (targetSwing - gait.current.swing) * (1 - Math.exp(-12 * step));
    const swing = gait.current.swing;
    const leftLeg = body.getObjectByName("explorer-left-leg");
    const rightLeg = body.getObjectByName("explorer-right-leg");
    const leftArm = body.getObjectByName("explorer-left-arm");
    const rightArm = body.getObjectByName("explorer-right-arm");
    if (leftLeg && rightLeg && leftArm && rightArm) {
      leftLeg.rotation.x = swing;
      rightLeg.rotation.x = -swing;
      leftArm.rotation.x = -swing * 0.65;
      rightArm.rotation.x = swing * 0.65;
      // The knee bends only on the forward swing, so the foot lifts instead of scraping a straight leg.
      const leftKnee = body.getObjectByName("explorer-left-knee");
      const rightKnee = body.getObjectByName("explorer-right-knee");
      if (leftKnee && rightKnee) {
        leftKnee.rotation.x = -Math.max(0, swing) * 1.05;
        rightKnee.rotation.x = -Math.max(0, -swing) * 1.05;
      }
    }

    const onStreet = space.current === STREET;
    const inReach = onStreet && canCollect(current.x, current.z, wasFound);
    const found = isClueFound();

    // Only a room with a street door can be peeked into from the street.
    peek.current.clear();
    for (const def of INTERIORS) {
      if (def.outer === undefined && nearDoor(def, current.x, current.z)) {
        peek.current.add(def.id);
      }
    }
    // Indoors, the rooms seen through a doorway that is open to this one (a hall's units, a lift whose doors are open).
    const adjacent = onStreet ? undefined : adjacentSpaces(space.current, height.current, PORTALS, lift.current);
    // What is drawn follows the player's space, and the camera is held inside that same space (below), so
    // the street is never behind the lens while the player is in a room and a room is never behind it on the street.
    if (district) {
      applyVisibility(district, DISTRICT, { active: onStreet ? null : space.current, near: peek.current, adjacent });
      propCull.current ??= collectCullables(district, "street-props");
      if (onStreet) {
        applyDistanceCull(propCull.current, current.x, current.z);
      }
      const sellerRoom = district.getObjectByName(roomName({ id: SELLER_INTERIOR_ID }));
      const figureSeller = seller.current;
      if (sellerRoom && figureSeller && figureSeller.parent !== sellerRoom) {
        sellerRoom.add(figureSeller);
      }
    }
    if (seller.current && sellerSeen3d) {
      seller.current.position.set(sellerPose.x, 0, sellerPose.z);
      seller.current.rotation.y = sellerPose.yaw;
      animateSeller(seller.current, clock.elapsedTime);
    }

    const marker = frameScene.getObjectByName("clue-marker");
    if (marker) {
      const gold = marker.getObjectByName("clue-gold");
      const goldMaterial = gold instanceof THREE.Mesh ? gold.material : null;
      if (found) {
        if (collectedAt.current === null) {
          // Already collected on load: stay hidden. A fresh collection plays out once.
          collectedAt.current = wasFound ? -1 : clock.elapsedTime;
        }
        if (collectedAt.current < 0) {
          marker.visible = false;
        } else {
          const t = Math.min(1, (clock.elapsedTime - collectedAt.current) / 0.55);
          const scale = Math.max(0.001, 1 - t);
          marker.visible = t < 1;
          marker.scale.setScalar(scale);
          // Lift while shrinking so the gold stays above the figure instead of dropping into the body.
          marker.position.y = 2.2 * t;
          marker.rotation.y = t * 8;
        }
      } else {
        collectedAt.current = null;
        marker.visible = true;
        marker.scale.setScalar(1);
        marker.position.y = Math.sin(clock.elapsedTime * 2) * 0.08;
        marker.rotation.y = clock.elapsedTime * 0.65;
        if (gold instanceof THREE.Mesh) {
          const pulse = 1 + Math.sin(clock.elapsedTime * 2.4) * 0.06;
          gold.scale.setScalar(pulse);
        }
      }
      if (goldMaterial instanceof THREE.MeshStandardMaterial) {
        goldMaterial.emissiveIntensity = found ? 0.15 : 0.22 + Math.sin(clock.elapsedTime * 3) * 0.14;
      }
    }

    let cameraAt: { x: number; z: number; distance: number } | null = null;
    if (camera instanceof THREE.PerspectiveCamera) {
      if (camera.fov !== 58 || camera.view !== null) {
        camera.fov = 58;
        camera.clearViewOffset();
        camera.updateProjectionMatrix();
      }
      if (start.overview) {
        camera.position.set(...start.eye);
        camera.lookAt(...start.look);
      } else {
        // The camera is clamped to the space the player is in. On the frame that space changes it is placed
        // in the new one at once (never carried across a wall), then eases out from there.
        const volume = rooms.get(space.current)?.camera ?? STREET_CAMERA;
        const reset = cameraSpace.current !== space.current;
        cameraSpace.current = space.current;
        camera3.current = stepCamera(camera3.current, current, volume, dt, reset);
        const view = cameraView(camera3.current, current);
        // The rig works in plan and at one height; a floor above the street lifts the whole shot with the player.
        // A stair core has a flight above and below almost everywhere, so there the lens is kept clear of them.
        const rise = height.current;
        const wanted = view.eye.y + rise;
        const eyeY = space.current === ROOM.stairs ? stairLensY(view.eye.x, view.eye.z, rise, wanted) : wanted;
        camera.position.set(view.eye.x, eyeY, view.eye.z);
        camera.lookAt(view.target.x, view.target.y + rise, view.target.z);
        cameraAt = { x: view.eye.x, z: view.eye.z, distance: camera3.current.distance };
      }
    }

    const now = interactTarget(space.current, current.x, current.z, inReach, sellerPose);
    const doorNow = now?.kind === "door" ? now.action : now?.kind === "shut" ? now.state : null;
    const entranceNow = now?.kind === "door" || now?.kind === "shut" ? now.entranceId : null;
    const sellerNow = now?.kind === "seller";
    const roomNow = onStreet ? null : space.current;
    const glassNow = glass?.nearest(current.x, current.z, 8) ?? null;
    // Openness moves every frame while a door slides, so it is published on a coarse step instead of every frame.
    const glassKey = glassNow ? `${glassNow.id}:${Math.round(glassNow.open * 10)}` : "";

    // Palm Court: which floor, which unit, and the lift panel while the player is in or beside the lift.
    const roomRecord = DISTRICT.rooms.get(space.current);
    const inCourt = roomRecord?.buildingId === COURT_ID;
    const inCabin = space.current === ROOM.lift;
    const beside = LEVELS.some((level) => stripRoomId(level) === space.current);
    const level: Level = levelAt(height.current);
    const floorNow = inCourt ? (COURT_FLOORS[level]?.id ?? null) : null;
    const unitNow = unitOfRoom(space.current)?.id ?? null;
    const note = liftNote.current && liftNote.current.until > clock.elapsedTime ? liftNote.current.text : null;
    const liftNow =
      inCabin || beside
        ? {
            phase: lift.current.phase,
            floor: lift.current.floor,
            shown: indicatedFloor(lift.current),
            target: lift.current.target,
            open: lift.current.open,
            inCabin,
          }
        : null;
    const callNow = now?.kind === "lift-call" ? now.level : null;
    const liftKey = liftNow
      ? `${liftNow.phase}|${liftNow.floor}|${liftNow.shown}|${liftNow.target ?? "-"}|${Math.round(liftNow.open * 10)}|${inCabin ? 1 : 0}|${note ?? ""}`
      : "";
    const changed =
      liftKey !== liftSeen.current ||
      floorNow !== floorSeen.current ||
      callNow !== callSeen.current ||
      inReach !== near.current ||
      found !== wasFound ||
      doorNow !== doorSeen.current ||
      entranceNow !== entranceSeen.current ||
      roomNow !== roomSeen.current ||
      sellerNow !== sellerSeen.current ||
      glassKey !== glassSeen.current;
    glassSeen.current = glassKey;
    liftSeen.current = liftKey;
    floorSeen.current = floorNow;
    callSeen.current = callNow;
    near.current = inReach;
    doorSeen.current = doorNow;
    entranceSeen.current = entranceNow;
    roomSeen.current = roomNow;
    sellerSeen.current = sellerNow;
    if (clock.elapsedTime - published.current > 0.15 || changed) {
      published.current = clock.elapsedTime;
      publishExplorer({
        x: current.x,
        z: current.z,
        yaw: current.yaw,
        near: inReach,
        collected: found,
        door: doorNow,
        entrance: entranceNow,
        inside: roomNow !== null,
        room: roomNow,
        seller: sellerNow,
        camera: cameraAt,
        sellerAt: sellerSeen3d ? { x: sellerPose.x, z: sellerPose.z } : null,
        speed: speedOf(current),
        glass: glassNow,
        y: height.current,
        floor: floorNow,
        unit: unitNow,
        lift: liftNow,
        call: callNow,
        liftNote: note,
      });
    }
  });

  return null;
}
