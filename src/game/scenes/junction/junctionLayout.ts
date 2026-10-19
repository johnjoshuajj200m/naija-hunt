import * as THREE from "three";

/**
 * Palm Mile hero junction. Metres, y up. The main avenue runs along -z and the camera looks down it;
 * a cross street runs along x. The camera stands on the avenue just short of the junction.
 */

/** Direction from the ground towards the sun: low golden-hour light from behind the camera's right. */
export const SUN_DIRECTION = new THREE.Vector3(0.72, 0.41, 0.56).normalize();
/** atan2(z, x) of the sun direction. The HDRI is turned so its own sun sits at this azimuth. */
export const SUN_AZIMUTH = Math.atan2(SUN_DIRECTION.z, SUN_DIRECTION.x);

export const ROAD_HALF = 6; // avenue x in [-6, 6]
export const CROSS_NEAR_Z = -18; // cross street z in [-30, -18]
export const CROSS_FAR_Z = -30;
export const AVENUE_START_Z = 26;
export const AVENUE_END_Z = -130;
export const CROSS_HALF_LENGTH = 70;

export const KERB_HEIGHT = 0.15;
export const SIDEWALK_WIDTH = 5;

/** Median island on the far avenue, with palms. */
export const MEDIAN_HALF = 0.9;

export const FLYOVER_Z = -72;
export const FLYOVER_DECK_BOTTOM = 6.2;
export const FLYOVER_DECK_THICKNESS = 1.1;
export const FLYOVER_DEPTH = 10;

/** Fog matches the haze at the horizon so distant boxes melt into it. */
export const HAZE_FAR = 175;
