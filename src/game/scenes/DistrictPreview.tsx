import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { createDistrict } from "./createDistrict";
import { HAZE_COLOR } from "./sky";

/** Same breakpoint as the menu: below it the menu is a bottom panel, above it a left column. */
const WIDE_LAYOUT_MIN_WIDTH = 1024;
/** Approximate pixel heights of the phone header and bottom menu panel the scene sits between. */
const COMPACT_HEADER_PX = 96;
const COMPACT_PANEL_PX = 404;
/** Width of the desktop menu column in pixels (23rem). */
const WIDE_MENU_PX = 368;

/**
 * Frames the street for the layout. The projection is shifted so the subject sits in the part of
 * the screen the menu does not cover: between header and panel on phones, right of the column on
 * desktop.
 */
function CameraRig() {
  const appliedLayout = useRef("");

  useFrame(({ camera, size, clock }) => {
    if (!(camera instanceof THREE.PerspectiveCamera)) {
      return;
    }
    const wide = size.width >= WIDE_LAYOUT_MIN_WIDTH;

    // Projection only changes when the viewport changes.
    const layoutKey = `${wide ? "wide" : "compact"}-${size.width}x${size.height}`;
    if (appliedLayout.current !== layoutKey) {
      appliedLayout.current = layoutKey;
      // Phones use a very wide lens, but the view offset keeps only its central band, so edge stretch stays small.
      camera.fov = wide ? 62 : 98;
      if (wide) {
        camera.setViewOffset(size.width, size.height, -WIDE_MENU_PX / 2, 0, size.width, size.height);
      } else {
        const panelTop = Math.max(0.35, 1 - COMPACT_PANEL_PX / size.height);
        const headerBottom = Math.min(0.2, COMPACT_HEADER_PX / size.height);
        const bandCenter = (panelTop + headerBottom) / 2;
        camera.setViewOffset(size.width, size.height, 0, (0.5 - bandCenter) * size.height, size.width, size.height);
      }
      camera.updateProjectionMatrix();
    }

    const drift = Math.sin(clock.elapsedTime * 0.15);
    if (wide) {
      camera.position.set(3.2 + drift * 0.6, 3, 16);
      camera.lookAt(-1.5 + drift * 0.3, 16, -40);
    } else {
      camera.position.set(3.2 + drift * 0.4, 3, 17);
      camera.lookAt(-3.5, 16.2, -40);
    }
  });

  return null;
}

function DistrictScene() {
  const [district] = useState(createDistrict);
  const sunTarget = useMemo(() => {
    const target = new THREE.Object3D();
    target.position.set(0, 0, -16);
    return target;
  }, []);

  useEffect(() => {
    return () => {
      district.dispose();
    };
  }, [district]);

  useFrame(({ clock }) => {
    district.update(clock.elapsedTime);
  });

  return (
    <>
      <color attach="background" args={[HAZE_COLOR]} />
      <fog attach="fog" args={[HAZE_COLOR, 26, 150]} />
      <hemisphereLight args={["#fff0d6", "#8a7458", 1.5]} />
      <primitive object={sunTarget} />
      <directionalLight
        position={[9, 15, 12]}
        target={sunTarget}
        intensity={2.5}
        color="#ffd7a5"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={90}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={34}
        shadow-camera-bottom={-34}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      <primitive object={district.root} />
      <CameraRig />
    </>
  );
}

export function DistrictPreview() {
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 1.5]}
      camera={{ fov: 40, near: 0.1, far: 280, position: [5, 4.6, 16] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <DistrictScene />
    </Canvas>
  );
}
