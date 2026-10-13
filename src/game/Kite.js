import * as THREE from 'three';
import { WIND, WIND_HEADING, windStrength } from './Wind';

export const KITE_COLORS = [0xe63946, 0xffb703, 0x219ebc, 0x8338ec, 0x2a9d8f, 0xfb5607, 0xff006e, 0x06d6a0];

const MIN_LINE = 5;
const MAX_LINE = 160;
const LET_OUT_SPEED = 9;
const REEL_SPEED = 2;
const LAUNCH_HOLD = 0.25;
const NEW_KITE_DELAY = 3;
const SEGMENTS = 24;
const MAX_AZIMUTH = 1.15;

// NOTE: A two-tone diamond kite (patang) built from two triangles plus a tail.
export function createKiteMesh(colorA, colorB) {
  const kite = new THREE.Group();
  const half = (color, sign) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 1.1, 0, sign * 0.95, 0, 0, 0, -1.3, 0], 3)
    );
    geometry.computeVertexNormals();
    return new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
  };
  kite.add(half(colorA, -1), half(colorB, 1));
  const tail = new THREE.Mesh(
    new THREE.PlaneGeometry(0.25, 1.2),
    new THREE.MeshLambertMaterial({ color: colorB, side: THREE.DoubleSide })
  );
  tail.position.y = -1.9;
  kite.add(tail);
  return kite;
}

// NOTE: The lattai (string spool): a wooden drum wound with manja between two
// end discs, on an axle that sticks out both sides as handles. Axle runs along x.
export function createLattai(threadColor = 0xff4d8d) {
  const wood = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
  const lattai = new THREE.Group();
  const spool = new THREE.Group();
  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.2, 12),
    new THREE.MeshLambertMaterial({ color: threadColor })
  );
  drum.rotation.z = Math.PI / 2;
  spool.add(drum);
  for (const side of [-1, 1]) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 8), wood);
    disc.rotation.z = Math.PI / 2;
    disc.position.x = side * 0.11;
    spool.add(disc);
    // NOTE: Cross-spokes on each disc so the spool visibly turns.
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.24, 0.02), wood);
    spoke.position.x = side * 0.125;
    spool.add(spoke);
  }
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.5, 6), wood);
  axle.rotation.z = Math.PI / 2;
  lattai.add(spool, axle);
  lattai.traverse((o) => { o.castShadow = true; });
  lattai.userData.spool = spool;
  return lattai;
}

// NOTE: Distance between segments p1-q1 and p2-q2 (Ericson, Real-Time Collision Detection).
const d1 = new THREE.Vector3();
const d2 = new THREE.Vector3();
const r = new THREE.Vector3();
const c1 = new THREE.Vector3();
const c2 = new THREE.Vector3();
function segmentDistance(p1, q1, p2, q2) {
  d1.subVectors(q1, p1);
  d2.subVectors(q2, p2);
  r.subVectors(p1, p2);
  const a = d1.dot(d1);
  const e = d2.dot(d2);
  const f = d2.dot(r);
  let s;
  let t;
  if (a <= 1e-9 && e <= 1e-9) return p1.distanceTo(p2);
  if (a <= 1e-9) {
    s = 0;
    t = THREE.MathUtils.clamp(f / e, 0, 1);
  } else {
    const c = d1.dot(r);
    if (e <= 1e-9) {
      t = 0;
      s = THREE.MathUtils.clamp(-c / a, 0, 1);
    } else {
      const b = d1.dot(d2);
      const denom = a * e - b * b;
      s = denom > 1e-9 ? THREE.MathUtils.clamp((b * f - c * e) / denom, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = THREE.MathUtils.clamp(-c / a, 0, 1);
      } else if (t > 1) {
        t = 1;
        s = THREE.MathUtils.clamp((b - c) / a, 0, 1);
      }
    }
  }
  c1.copy(p1).addScaledVector(d1, s);
  c2.copy(p2).addScaledVector(d2, t);
  return c1.distanceTo(c2);
}

// NOTE: Closest approach between two strings, and which segment of `a` it is on.
export function polylineDistance(a, b) {
  let distance = Infinity;
  let index = 0;
  for (let i = 0; i < a.length - 1; i++) {
    for (let j = 0; j < b.length - 1; j++) {
      const d = segmentDistance(a[i], a[i + 1], b[j], b[j + 1]);
      if (d < distance) {
        distance = d;
        index = i;
      }
    }
  }
  return { distance, index };
}

// NOTE: Writes a sagging string from `from` to `to` into `points` and the line
// geometry. If `through` is given the string is bent to pass through it instead.
const curve = new THREE.QuadraticBezierCurve3();
export function layString(line, points, from, to, sag, through = null) {
  curve.v0.copy(from);
  curve.v2.copy(to);
  if (through) {
    curve.v1.copy(through).multiplyScalar(2).addScaledVector(from, -0.5).addScaledVector(to, -0.5);
  } else {
    curve.v1.copy(from).lerp(to, 0.5);
    curve.v1.y -= from.distanceTo(to) * sag;
  }
  const positions = line.geometry.attributes.position;
  for (let s = 0; s < points.length; s++) {
    curve.getPoint(s / (points.length - 1), points[s]);
    positions.setXYZ(s, points[s].x, points[s].y, points[s].z);
  }
  positions.needsUpdate = true;
}

export function createString(segments, color, opacity) {
  const points = new Array(segments + 1).fill(0).map(() => new THREE.Vector3());
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  );
  line.frustumCulled = false;
  return { line, points };
}

/**
 * The player's own kite. Arcade model: the kite sits on a sphere of radius
 * `length` around the lattai, at an `elevation` and an `azimuth` measured
 * from straight downwind. Pulling climbs and reels in, letting out pays out
 * string and lets the kite sink downwind, and the camera direction steers.
 */
export default class KiteFlyer {
  constructor(scene, onEvent) {
    this.scene = scene;
    this.onEvent = onEvent;
    this.state = 'none';
    this.kite = null;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.length = MIN_LINE;
    this.elevation = 0;
    this.azimuth = 0;
    this.sag = 0.1;
    this.spin = 0;
    this.launchHold = 0;
    this.newKiteTimer = 0;
    this.colorIndex = 0;

    const { line, points } = createString(SEGMENTS, 0xfff3b0, 0.9);
    this.line = line;
    this.points = points;
    this.line.visible = false;
    scene.add(this.line);
  }

  get flying() {
    return this.state === 'flying';
  }

  // NOTE: Ties a fresh kite to the lattai; it lies on the ground until launched.
  tieNewKite() {
    if (this.kite) this.scene.remove(this.kite);
    const a = KITE_COLORS[this.colorIndex % KITE_COLORS.length];
    const b = KITE_COLORS[(this.colorIndex + 5) % KITE_COLORS.length];
    this.colorIndex++;
    this.kite = createKiteMesh(a, b);
    this.kite.scale.setScalar(1.3);
    this.scene.add(this.kite);
    this.state = 'grounded';
    this.length = MIN_LINE;
    this.elevation = 0;
    this.azimuth = 0;
    this.launchHold = 0;
    this.line.visible = true;
  }

  pickUp() {
    this.tieNewKite();
  }

  drop() {
    if (this.kite) this.scene.remove(this.kite);
    this.kite = null;
    this.state = 'none';
    this.line.visible = false;
  }

  // NOTE: The kite hit something; it drops and is reeled back in.
  crash(reason = 'crashed') {
    this.state = 'grounded';
    this.length = MIN_LINE;
    this.launchHold = 0;
    this.onEvent(reason);
  }

  cut() {
    this.state = 'cut';
    this.newKiteTimer = NEW_KITE_DELAY;
    this.velocity.copy(WIND).multiplyScalar(6);
    this.velocity.y = 1.5;
  }

  get height() {
    return this.state === 'flying' ? Math.max(0, this.position.y) : 0;
  }

  /**
   * @param {{pull:boolean, release:boolean}} controls
   * @param {THREE.Vector3} hand world position of the lattai
   * @param {number} viewYaw camera yaw, used to steer
   * @param {number} feetY height the player stands on
   */
  update(delta, elapsed, controls, hand, viewYaw, feetY) {
    if (this.state === 'none') return;
    const wind = windStrength(elapsed);
    const previousLength = this.length;

    if (this.state === 'grounded') {
      // NOTE: Kite lies a few metres downwind until the player pulls it up.
      this.position.set(
        hand.x + Math.cos(WIND_HEADING) * 2.5,
        feetY + 0.08,
        hand.z + Math.sin(WIND_HEADING) * 2.5
      );
      this.kite.rotation.set(-Math.PI / 2, 0, -WIND_HEADING - Math.PI / 2);
      this.launchHold = controls.pull ? this.launchHold + delta : 0;
      if (this.launchHold >= LAUNCH_HOLD) {
        this.state = 'flying';
        this.length = Math.max(this.length, 6);
        this.elevation = 0.25;
        this.onEvent('launched');
      }
      layString(this.line, this.points, hand, this.position, 0.05);
    } else if (this.state === 'flying') {
      this.fly(delta, elapsed, wind, controls, hand, viewYaw);
    } else if (this.state === 'cut') {
      // NOTE: A cut kite drifts off downwind, slowly falling, string trailing.
      this.velocity.addScaledVector(WIND, wind * 2 * delta);
      this.velocity.y = Math.max(this.velocity.y - 1.2 * delta, -2.5);
      this.position.addScaledVector(this.velocity, delta);
      this.kite.rotateZ(delta * 3);
      for (let s = 0; s < this.points.length; s++) {
        const k = s / (this.points.length - 1);
        this.points[s].copy(this.position).addScaledVector(WIND, -k * 6);
        this.points[s].y -= k * 10;
      }
      const positions = this.line.geometry.attributes.position;
      this.points.forEach((pt, s) => positions.setXYZ(s, pt.x, pt.y, pt.z));
      positions.needsUpdate = true;
      this.newKiteTimer -= delta;
      if (this.newKiteTimer <= 0) {
        this.tieNewKite();
        this.onEvent('newKite');
      }
    }

    // NOTE: Turn the spool as string goes out or comes in.
    this.spin += (this.length - previousLength) * 6;
    if (this.kite) this.kite.position.copy(this.position);
  }

  fly(delta, elapsed, wind, controls, hand, viewYaw) {
    const { pull, release } = controls;

    if (release) this.length += LET_OUT_SPEED * wind * delta;
    else if (pull) this.length -= REEL_SPEED * delta;
    this.length = THREE.MathUtils.clamp(this.length, MIN_LINE, MAX_LINE);

    // NOTE: Steer toward where the camera looks, within the wind window.
    const lookHeading = Math.atan2(-Math.cos(viewYaw), -Math.sin(viewYaw));
    let target = lookHeading - WIND_HEADING;
    target = THREE.MathUtils.clamp(Math.atan2(Math.sin(target), Math.cos(target)), -MAX_AZIMUTH, MAX_AZIMUTH);
    this.azimuth += (target - this.azimuth) * (1 - Math.exp(-(pull ? 1.6 : 0.5) * delta));

    // NOTE: The kite rests at a wind-dependent angle, flies lower at the edges
    // of the wind window, climbs when pulled and sinks while string pays out.
    const edge = Math.cos(this.azimuth);
    const rest = (0.4 + 0.35 * wind) * edge;
    let rate;
    if (pull) rate = 0.6 * wind;
    else if (release) rate = (0.3 - this.elevation) * 0.25 - 0.02;
    else rate = (rest - this.elevation) * 0.4 - 0.04 * (1.1 - wind);
    this.elevation = Math.min(this.elevation + rate * delta, 1.3 * edge);

    const sagTarget = pull ? 0.02 : release ? 0.14 : 0.07;
    this.sag += (sagTarget - this.sag) * (1 - Math.exp(-4 * delta));

    const e = this.elevation + Math.sin(elapsed * 2.1) * 0.02 * wind;
    const heading = WIND_HEADING + this.azimuth;
    this.position.set(
      Math.cos(heading) * Math.cos(e),
      Math.sin(e),
      Math.sin(heading) * Math.cos(e)
    ).multiplyScalar(this.length).add(hand);

    if (this.elevation < 0.03 || this.position.y < 0.5) {
      this.crash();
      return;
    }

    this.kite.position.copy(this.position);
    this.kite.lookAt(hand.x, this.position.y, hand.z);
    this.kite.rotateZ(-this.azimuth * 0.6 + Math.sin(elapsed * 1.7) * 0.25 * wind);
    this.kite.rotateX(-0.35);
    layString(this.line, this.points, hand, this.position, this.sag);
  }
}
