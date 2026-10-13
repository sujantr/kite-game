import * as THREE from 'three';
import { createLattai } from './Kite';

export const PLAYER_RADIUS = 0.35;
export const PLAYER_HEIGHT = 1.8;
export const EYE_HEIGHT = 1.62;
const STEP_HEIGHT = 0.55;
const GRAVITY = 26;
const JUMP_SPEED = 8.6;
const WALK_SPEED = 4.5;
const RUN_SPEED = 8.5;
const GROUND_ACCEL = 14;
const AIR_ACCEL = 3;
const COYOTE_TIME = 0.12;

function limb(width, length, depth, material) {
  // NOTE: The pivot sits at the joint so rotating the group swings the limb.
  const pivot = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, length, depth), material);
  mesh.position.y = -length / 2;
  mesh.castShadow = true;
  pivot.add(mesh);
  return pivot;
}

function createTopiTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  const colors = ['#b5172e', '#f2c14e', '#1b4965', '#ffffff', '#2d6a4f', '#e76f51'];
  for (let x = 0; x < 64; x += 4) {
    for (let y = 0; y < 16; y += 4) {
      ctx.fillStyle = colors[(x / 4 + y / 4 * 3) % colors.length];
      ctx.fillRect(x, y, 4, 4);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

export default class Player {
  constructor(scene, world) {
    this.world = world;
    this.position = world.spawn.clone();
    this.velocity = new THREE.Vector3();
    this.facing = Math.PI;
    this.onGround = true;
    this.airTime = 0;
    this.walkPhase = 0;
    this.holding = false;
    this.jumpHeld = false;

    this.buildModel();
    scene.add(this.model);
  }

  buildModel() {
    const skin = new THREE.MeshLambertMaterial({ color: 0xc68e5d });
    const kurta = new THREE.MeshLambertMaterial({ color: 0xf2efe6 });
    const vest = new THREE.MeshLambertMaterial({ color: 0x1f3a5f });
    const trousers = new THREE.MeshLambertMaterial({ color: 0x3b3b3b });
    const shoes = new THREE.MeshLambertMaterial({ color: 0x2a1a10 });

    this.model = new THREE.Group();
    // NOTE: The model faces -Z when facing === 0, matching the camera.
    this.body = new THREE.Group();
    this.model.add(this.body);
    // NOTE: Everything above the waist is hidden in first person so the camera
    // doesn't see the inside of the shoulders; the legs stay visible underfoot.
    this.upperBody = new THREE.Group();
    this.body.add(this.upperBody);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.62, 0.3), kurta);
    torso.position.y = 1.18;
    const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.42, 0.32), vest);
    jacket.position.y = 1.28;
    torso.castShadow = jacket.castShadow = true;
    this.upperBody.add(torso, jacket);

    this.head = new THREE.Group();
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), skin);
    face.position.y = 1.64;
    const topi = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.175, 0.16, 16, 1, false),
      [new THREE.MeshLambertMaterial({ map: createTopiTexture() }), vest, vest]
    );
    topi.position.set(0, 1.79, 0.01);
    topi.rotation.x = -0.12;
    face.castShadow = topi.castShadow = true;
    this.head.add(face, topi);
    this.upperBody.add(this.head);

    this.leftArm = limb(0.14, 0.62, 0.14, kurta);
    this.leftArm.position.set(-0.36, 1.46, 0);
    this.rightArm = limb(0.14, 0.62, 0.14, kurta);
    this.rightArm.position.set(0.36, 1.46, 0);
    const handL = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), skin);
    handL.position.y = -0.66;
    this.leftArm.add(handL);
    const handR = handL.clone();
    this.rightArm.add(handR);

    this.leftLeg = limb(0.2, 0.86, 0.2, trousers);
    this.leftLeg.position.set(-0.14, 0.88, 0);
    this.rightLeg = limb(0.2, 0.86, 0.2, trousers);
    this.rightLeg.position.set(0.14, 0.88, 0);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.32), shoes);
    shoe.position.set(0, -0.86, -0.05);
    this.leftLeg.add(shoe);
    this.rightLeg.add(shoe.clone());

    this.upperBody.add(this.leftArm, this.rightArm);

    // NOTE: Lattai held out in front with a hand on each end of the axle.
    this.lattai = createLattai();
    this.lattai.position.set(0, 1.24, -0.59);
    this.lattai.visible = false;
    this.upperBody.add(this.lattai);
    this.body.add(this.leftLeg, this.rightLeg);
  }

  setHolding(holding) {
    this.holding = holding;
    this.lattai.visible = holding;
  }

  setUpperBodyVisible(visible) {
    this.upperBody.visible = visible;
  }

  /**
   * @param {number} delta seconds
   * @param {{forward:number,right:number,sprint:boolean,jump:boolean}} input
   * @param {number} viewYaw camera yaw, movement is relative to it
   * @param {boolean} firstPerson body always faces the view in first person
   */
  update(delta, input, viewYaw, firstPerson) {
    // NOTE: Desired horizontal velocity relative to where the camera looks.
    const sin = Math.sin(viewYaw);
    const cos = Math.cos(viewYaw);
    let mx = -sin * input.forward + cos * input.right;
    let mz = -cos * input.forward - sin * input.right;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const speed = input.sprint ? RUN_SPEED : WALK_SPEED;
    const accel = this.onGround ? GROUND_ACCEL : AIR_ACCEL;
    const blend = 1 - Math.exp(-accel * delta);
    this.velocity.x += (mx * speed - this.velocity.x) * blend;
    this.velocity.z += (mz * speed - this.velocity.z) * blend;

    // NOTE: Jump on press (not hold), with a little grace after leaving a ledge.
    if (input.jump && !this.jumpHeld && this.airTime < COYOTE_TIME) {
      this.velocity.y = JUMP_SPEED;
      this.airTime = COYOTE_TIME;
      this.onGround = false;
    }
    this.jumpHeld = input.jump;
    this.velocity.y -= GRAVITY * delta;

    this.moveHorizontally(delta);
    this.moveVertically(delta);

    const limit = this.world.bounds;
    this.position.x = THREE.MathUtils.clamp(this.position.x, -limit, limit);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -limit, limit);

    this.animate(delta, len > 0.01, viewYaw, firstPerson, mx, mz);
  }

  moveHorizontally(delta) {
    this.position.x += this.velocity.x * delta;
    this.position.z += this.velocity.z * delta;

    // NOTE: Push the player's circle out of any box that is too tall to step onto.
    const feet = this.position.y;
    for (let pass = 0; pass < 2; pass++) {
      for (const box of this.world.colliders) {
        if (box.max.y <= feet + STEP_HEIGHT || box.min.y >= feet + PLAYER_HEIGHT) continue;
        const cx = THREE.MathUtils.clamp(this.position.x, box.min.x, box.max.x);
        const cz = THREE.MathUtils.clamp(this.position.z, box.min.z, box.max.z);
        const dx = this.position.x - cx;
        const dz = this.position.z - cz;
        const dist2 = dx * dx + dz * dz;
        if (dist2 >= PLAYER_RADIUS * PLAYER_RADIUS) continue;

        if (dist2 > 1e-8) {
          const dist = Math.sqrt(dist2);
          const push = PLAYER_RADIUS - dist;
          this.position.x += (dx / dist) * push;
          this.position.z += (dz / dist) * push;
        } else {
          // NOTE: Centre is inside the box, leave via the nearest face.
          const exits = [
            [box.min.x - PLAYER_RADIUS - this.position.x, 0],
            [box.max.x + PLAYER_RADIUS - this.position.x, 0],
            [0, box.min.z - PLAYER_RADIUS - this.position.z],
            [0, box.max.z + PLAYER_RADIUS - this.position.z],
          ];
          exits.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
          this.position.x += exits[0][0];
          this.position.z += exits[0][1];
        }
      }
    }
  }

  moveVertically(delta) {
    const previousFeet = this.position.y;
    this.position.y += this.velocity.y * delta;

    // NOTE: The floor is the highest surface under the player that they could
    // have stepped onto from where they were; that is also what lets them climb stairs.
    let ground = 0;
    const r = PLAYER_RADIUS * 0.7;
    for (const box of this.world.colliders) {
      if (box.max.y > previousFeet + STEP_HEIGHT || box.max.y <= ground) continue;
      const cx = THREE.MathUtils.clamp(this.position.x, box.min.x, box.max.x);
      const cz = THREE.MathUtils.clamp(this.position.z, box.min.z, box.max.z);
      if ((this.position.x - cx) ** 2 + (this.position.z - cz) ** 2 < r * r) ground = box.max.y;
    }

    // NOTE: Stick to the floor when walking down steps instead of hopping off them.
    const snap = this.onGround && this.velocity.y <= 0 ? STEP_HEIGHT : 0;
    if (this.position.y <= ground + snap && this.velocity.y <= 0) {
      this.position.y = ground;
      this.velocity.y = 0;
      this.onGround = true;
      this.airTime = 0;
    } else {
      this.onGround = false;
      this.airTime += delta;
    }
  }

  animate(delta, moving, viewYaw, firstPerson, mx, mz) {
    if (firstPerson) {
      this.facing = viewYaw;
    } else if (moving) {
      // NOTE: In third person the character turns to face where it walks.
      const target = Math.atan2(-mx, -mz);
      let diff = target - this.facing;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.facing += diff * (1 - Math.exp(-12 * delta));
    }
    this.model.position.copy(this.position);
    this.model.rotation.y = this.facing;

    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.onGround) {
      this.walkPhase += delta * speed * 2.2;
      const swing = Math.sin(this.walkPhase) * Math.min(speed / RUN_SPEED, 1) * 0.9;
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      if (!this.holding) {
        this.leftArm.rotation.x = -swing * 0.8;
        this.rightArm.rotation.x = swing * 0.8;
      }
      this.body.position.y = Math.abs(Math.sin(this.walkPhase)) * Math.min(speed / RUN_SPEED, 1) * 0.06;
    } else {
      // NOTE: Airborne pose: legs tucked, arms up.
      const blend = 1 - Math.exp(-10 * delta);
      this.leftLeg.rotation.x += (-0.5 - this.leftLeg.rotation.x) * blend;
      this.rightLeg.rotation.x += (0.3 - this.rightLeg.rotation.x) * blend;
      if (!this.holding) {
        this.leftArm.rotation.x += (-2.4 - this.leftArm.rotation.x) * blend;
        this.rightArm.rotation.x += (-2.4 - this.rightArm.rotation.x) * blend;
      }
    }

    // NOTE: Arms reach forward and in so both hands grip the lattai handles.
    if (this.holding) {
      this.leftArm.rotation.set(1.2, 0, 0.3);
      this.rightArm.rotation.set(1.2, 0, -0.3);
    } else {
      this.leftArm.rotation.z = 0;
      this.rightArm.rotation.z = 0;
    }
  }
}
