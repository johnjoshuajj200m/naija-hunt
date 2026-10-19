import * as THREE from "three";

import { AMBIENT, tagOwner } from "../explore/spaces";
import { addMesh } from "./sceneHelpers";

/** Warm haze colour. The scene fog uses the same value so distant towers melt into the horizon. */
export const HAZE_COLOR = "#e9c28a";

/** Golden-hour sky dome. It goes through the same tone mapping as the scene so the colours match. */
export function addSky(parent: THREE.Group): void {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenith: { value: new THREE.Color("#6d95a4") },
      mid: { value: new THREE.Color("#d9b98f") },
      haze: { value: new THREE.Color(HAZE_COLOR) },
    },
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 zenith;
      uniform vec3 mid;
      uniform vec3 haze;
      varying vec3 vDirection;
      void main() {
        float h = vDirection.y;
        vec3 color = mix(haze, mid, smoothstep(0.0, 0.2, h));
        color = mix(color, zenith, smoothstep(0.1, 0.7, h));
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  // The dome is distant and belongs to no street or room, so it is drawn wherever the camera is.
  tagOwner(
    addMesh(parent, new THREE.SphereGeometry(150, 24, 14), material, [0, 0, -40], {
      cast: false,
      receive: false,
      name: "sky",
    }),
    AMBIENT,
  );
}
