import * as THREE from 'three';
import { EYE_HEIGHT } from './Player';

const MOUSE_SENSITIVITY = 0.0025;
const MIN_DISTANCE = 2;
const MAX_DISTANCE = 12;
const SHOULDER_OFFSET = 0.55;
const CAMERA_PADDING = 0.3;
const BOOM_RETURN_RATE = 4;
const MIN_CAMERA_HEIGHT = 0.3;

// NOTE: One rig for both views. First person is just third person with the
// boom shortened to zero, so switching views animates smoothly between them.
export default class CameraRig {
  constructor(camera, player, world) {
    this.camera = camera;
    this.player = player;
    this.world = world;
    this.yaw = Math.PI;
    this.pitch = -0.15;
    this.firstPerson = false;
    this.thirdPersonDistance = 5;
    this.distance = this.thirdPersonDistance;
    this.boom = this.distance;
    this.raycaster = new THREE.Raycaster();
    this.pivot = new THREE.Vector3();
    this.forward = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.desired = new THREE.Vector3();
    this.camera.rotation.order = 'YXZ';
  }

  toggleView() {
    this.firstPerson = !this.firstPerson;
  }

  // NOTE: Scrolling in past the closest zoom enters first person, scrolling
  // out of first person returns to third.
  zoom(direction) {
    if (this.firstPerson) {
      if (direction > 0) {
        this.firstPerson = false;
        this.thirdPersonDistance = MIN_DISTANCE;
      }
      return;
    }
    if (direction < 0 && this.thirdPersonDistance <= MIN_DISTANCE) {
      this.firstPerson = true;
      return;
    }
    this.thirdPersonDistance = THREE.MathUtils.clamp(
      this.thirdPersonDistance + direction * 1,
      MIN_DISTANCE,
      MAX_DISTANCE
    );
  }

  look(dx, dy) {
    this.yaw -= dx * MOUSE_SENSITIVITY;
    this.pitch -= dy * MOUSE_SENSITIVITY;
    const maxUp = this.firstPerson ? 1.5 : 1.1;
    const maxDown = this.firstPerson ? -1.5 : -1.25;
    this.pitch = THREE.MathUtils.clamp(this.pitch, maxDown, maxUp);
  }

  update(delta) {
    const target = this.firstPerson ? 0 : this.thirdPersonDistance;
    this.distance += (target - this.distance) * (1 - Math.exp(-10 * delta));
    if (!this.firstPerson) this.pitch = Math.min(this.pitch, 1.1);

    const p = this.player.position;
    // NOTE: Ride the walk bob in first person so movement feels grounded.
    this.pivot.set(p.x, p.y + EYE_HEIGHT + this.player.body.position.y, p.z);

    const cosPitch = Math.cos(this.pitch);
    this.forward.set(
      -Math.sin(this.yaw) * cosPitch,
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * cosPitch
    );
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    // NOTE: Over-the-shoulder offset fades in with the boom length.
    const shoulder = SHOULDER_OFFSET * Math.min(this.distance / MIN_DISTANCE, 1);
    const origin = this.pivot.clone().addScaledVector(this.right, shoulder);
    let limit = this.distance;

    // NOTE: Pull the camera in if a wall or roof is between it and the player.
    if (limit > 0.05) {
      this.raycaster.set(origin, this.forward.clone().negate());
      this.raycaster.far = limit + CAMERA_PADDING;
      const hit = this.raycaster.intersectObjects(this.world.solids, false)[0];
      if (hit) limit = Math.max(0, hit.distance - CAMERA_PADDING);
      // NOTE: Looking up swings the camera down; keep it above the ground.
      if (this.forward.y > 0) {
        limit = Math.min(limit, Math.max(0, (origin.y - MIN_CAMERA_HEIGHT) / this.forward.y));
      }
    }

    // NOTE: Snap in at once so walls are never seen through, but ease back
    // out once they're clear so passing obstacles don't make the view pop.
    if (limit < this.boom) this.boom = limit;
    else this.boom += (limit - this.boom) * (1 - Math.exp(-BOOM_RETURN_RATE * delta));
    const boom = this.boom;

    if (boom < 0.05) {
      // NOTE: Push the eye slightly forward so the shoulders stay out of view.
      this.desired.copy(this.pivot);
      this.desired.x += -Math.sin(this.yaw) * 0.12;
      this.desired.z += -Math.cos(this.yaw) * 0.12;
    } else {
      this.desired.copy(origin).addScaledVector(this.forward, -boom);
    }

    this.camera.position.copy(this.desired);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.player.setUpperBodyVisible(boom > 0.6);
  }
}
