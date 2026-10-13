import * as THREE from 'three';

export const WIND = new THREE.Vector3(1, 0, 0.35).normalize();
export const WIND_HEADING = Math.atan2(WIND.z, WIND.x);

// NOTE: Gusty wind strength, roughly 0.6 (lull) to 1.1 (gust).
export function windStrength(elapsed) {
  return 0.85 + 0.15 * Math.sin(elapsed * 0.37) + 0.1 * Math.sin(elapsed * 1.3 + 1);
}
