import * as THREE from 'three';

// NOTE: Deterministic RNG so the town layout is the same on every load.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FLOOR_HEIGHT = 3;
const BAY_WIDTH = 3.5;
const STEP_RISE = 0.5;
const STEP_RUN = 0.6;
const STAIR_WIDTH = 1.3;
const CELL = 22;
const GRID = 3;

const WALL_COLORS = [0xb5543c, 0xa84a35, 0xf1e6d2, 0xe8c27a, 0xd98b5f, 0xc9d6c2, 0xe6b8a2];
const KITE_COLORS = [0xe63946, 0xffb703, 0x219ebc, 0x8338ec, 0x2a9d8f, 0xfb5607, 0xff006e, 0x06d6a0];

export const WIND = new THREE.Vector3(1, 0, 0.35).normalize();

// NOTE: One window bay of a Newari-style facade, drawn in greyscale-on-white
// so each house can tint it with its own wall colour.
function createFacadeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 128);
  // brick coursing
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let y = 0; y < 128; y += 8) ctx.fillRect(0, y, 128, 1);
  // carved wooden window frame
  ctx.fillStyle = '#4a2c1a';
  ctx.fillRect(34, 26, 60, 72);
  ctx.fillStyle = '#6b3f22';
  ctx.fillRect(28, 22, 72, 6);
  ctx.fillRect(30, 96, 68, 6);
  // lattice glass
  ctx.fillStyle = '#1d2229';
  ctx.fillRect(40, 32, 22, 60);
  ctx.fillRect(66, 32, 22, 60);
  ctx.strokeStyle = '#5c3a22';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(40, 36 + i * 10);
    ctx.lineTo(88, 36 + i * 10);
    ctx.stroke();
  }
  // floor band
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, 122, 128, 6);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export default class World {
  constructor(scene) {
    this.scene = scene;
    this.rng = mulberry32(2080);
    // NOTE: Axis-aligned boxes the player collides with and can stand on.
    this.colliders = [];
    // NOTE: Meshes the third-person camera must not pass through.
    this.solids = [];
    this.bounds = GRID * CELL + 12;
    this.spawn = new THREE.Vector3(0, 0, 14);
    this.rooftops = [];
    this.kites = [];
    this.clouds = [];

    this.facadeTexture = createFacadeTexture();

    this.buildSky();
    this.buildGround();
    this.buildTown();
    this.buildTemple();
    this.buildTrees();
    this.buildHills();
    this.buildKites();
    this.buildClouds();
  }

  addCollider(minX, minY, minZ, maxX, maxY, maxZ) {
    const box = new THREE.Box3(
      new THREE.Vector3(minX, minY, minZ),
      new THREE.Vector3(maxX, maxY, maxZ)
    );
    this.colliders.push(box);
    return box;
  }

  // NOTE: Adds a solid box mesh centred at (x, z) sitting on height y.
  addBlock(x, y, z, w, h, d, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.solids.push(mesh);
    this.addCollider(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2);
    return mesh;
  }

  buildSky() {
    const skyGeometry = new THREE.SphereGeometry(1200, 32, 16);
    const skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x3d8fd6) },
        horizonColor: { value: new THREE.Color(0xcfe8f7) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPosition;
        void main() {
          vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y;
          gl_FragColor = vec4(mix(horizonColor, topColor, pow(max(h, 0.0), 0.55)), 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(skyGeometry, skyMaterial);
    this.scene.add(this.sky);
    this.scene.fog = new THREE.Fog(0xcfe8f7, 120, 650);
  }

  buildGround() {
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 1400),
      new THREE.MeshLambertMaterial({ color: 0x7f9a52 })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    this.scene.add(grass);

    const size = this.bounds * 2;
    const paving = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshLambertMaterial({ color: 0xb29a7a })
    );
    paving.rotation.x = -Math.PI / 2;
    paving.position.y = 0.01;
    paving.receiveShadow = true;
    this.scene.add(paving);
  }

  buildTown() {
    const rng = this.rng;
    const stepMatrices = [];
    const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x8d8478 });
    const hutMaterial = new THREE.MeshLambertMaterial({ color: 0xd8cfc0 });
    const tankMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });

    for (let i = -GRID; i <= GRID; i++) {
      for (let j = -GRID; j <= GRID; j++) {
        // NOTE: The centre cells are the temple square.
        if (Math.abs(i) <= 1 && Math.abs(j) <= 1) continue;

        const w = 8 + Math.round(rng() * 6);
        const d = 8 + Math.round(rng() * 6);
        const floors = rng() < 0.15 ? 4 : rng() < 0.55 ? 2 : 3;
        const height = floors * FLOOR_HEIGHT;
        const cx = i * CELL + (rng() - 0.5) * 3;
        const cz = j * CELL + (rng() - 0.5) * 3;

        const wallColor = WALL_COLORS[Math.floor(rng() * WALL_COLORS.length)];
        const facade = (along) => {
          const map = this.facadeTexture.clone();
          map.repeat.set(Math.max(1, Math.round(along / BAY_WIDTH)), floors);
          map.needsUpdate = true;
          return new THREE.MeshLambertMaterial({ color: wallColor, map });
        };
        const sideX = facade(d);
        const sideZ = facade(w);
        // NOTE: BoxGeometry material order is +x, -x, +y, -y, +z, -z.
        const house = this.addBlock(cx, 0, cz, w, height, d, [
          sideX, sideX, roofMaterial, roofMaterial, sideZ, sideZ,
        ]);
        house.userData.isHouse = true;

        const roof = { x: cx, y: height, z: cz, w, d };
        this.rooftops.push(roof);

        // NOTE: External staircase up to the roof, along the longer wall,
        // as long as the stairs fit along it.
        const alongX = w >= d;
        const wallLength = alongX ? w : d;
        const steps = Math.round(height / STEP_RISE);
        if (steps * STEP_RUN <= wallLength - 0.5) {
          const side = rng() < 0.5 ? 1 : -1;
          const start = -wallLength / 2 + 0.25;
          for (let k = 0; k < steps; k++) {
            const stepTop = (k + 1) * STEP_RISE;
            const along = start + k * STEP_RUN + STEP_RUN / 2;
            const out = (alongX ? d : w) / 2 + STAIR_WIDTH / 2;
            const sx = alongX ? cx + along : cx + side * out;
            const sz = alongX ? cz + side * out : cz + along;
            const sw = alongX ? STEP_RUN : STAIR_WIDTH;
            const sd = alongX ? STAIR_WIDTH : STEP_RUN;
            stepMatrices.push(
              new THREE.Matrix4().compose(
                new THREE.Vector3(sx, stepTop / 2, sz),
                new THREE.Quaternion(),
                new THREE.Vector3(sw, stepTop, sd)
              )
            );
            this.addCollider(sx - sw / 2, 0, sz - sd / 2, sx + sw / 2, stepTop, sz + sd / 2);
          }
          // NOTE: Where the bottom step is and the yaw that walks up it.
          const foot = start - 1;
          roof.stairs = {
            x: alongX ? cx + foot : cx + side * ((w / 2) + STAIR_WIDTH / 2),
            z: alongX ? cz + side * ((d / 2) + STAIR_WIDTH / 2) : cz + foot,
            yaw: alongX ? -Math.PI / 2 : Math.PI,
          };
        }

        // NOTE: Rooftop clutter: a stairwell hut and the classic black water tank.
        if (rng() < 0.6) {
          const hx = cx + (rng() < 0.5 ? -1 : 1) * (w / 2 - 1.6);
          const hz = cz + (rng() < 0.5 ? -1 : 1) * (d / 2 - 1.6);
          this.addBlock(hx, height, hz, 2.4, 2.3, 2.4, hutMaterial);
          if (rng() < 0.7) {
            const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.2, 12), tankMaterial);
            tank.position.set(hx, height + 2.9, hz);
            tank.castShadow = true;
            this.scene.add(tank);
          }
        }
      }
    }

    const steps = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: 0x9a8f80 }),
      stepMatrices.length
    );
    stepMatrices.forEach((m, idx) => steps.setMatrixAt(idx, m));
    steps.castShadow = true;
    steps.receiveShadow = true;
    this.scene.add(steps);
    this.solids.push(steps);
  }

  // NOTE: A Nyatapola-style pagoda on a stepped plinth you can climb.
  buildTemple() {
    const brick = new THREE.MeshLambertMaterial({ color: 0xa5482f });
    const wood = new THREE.MeshLambertMaterial({ color: 0x5a3220 });
    const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x6e2c1c, flatShading: true });
    const gold = new THREE.MeshStandardMaterial({ color: 0xd4a017, metalness: 0.8, roughness: 0.3 });

    const tiers = 5;
    for (let t = 0; t < tiers; t++) {
      const size = 16 - t * 2.4;
      this.addBlock(0, t * STEP_RISE, -20, size, STEP_RISE, size, brick);
    }
    const base = tiers * STEP_RISE;
    this.addBlock(0, base, -20, 4.5, 3.2, 4.5, wood);

    let y = base + 3.2;
    const roofs = [
      { r: 4.8, h: 1.6, body: 3.4, bodyH: 2.2 },
      { r: 3.8, h: 1.4, body: 2.6, bodyH: 1.9 },
      { r: 2.9, h: 1.8, body: 0, bodyH: 0 },
    ];
    for (const roof of roofs) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(roof.r, roof.h, 4), roofMaterial);
      cone.rotation.y = Math.PI / 4;
      cone.position.set(0, y + roof.h / 2, -20);
      cone.castShadow = true;
      this.scene.add(cone);
      this.solids.push(cone);
      y += roof.h * 0.55;
      if (roof.body) {
        const body = new THREE.Mesh(new THREE.BoxGeometry(roof.body, roof.bodyH, roof.body), wood);
        body.position.set(0, y + roof.bodyH / 2, -20);
        body.castShadow = true;
        this.scene.add(body);
        y += roof.bodyH;
      }
    }
    const finial = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.4, 8), gold);
    finial.position.set(0, y + 1.1, -20);
    this.scene.add(finial);
  }

  buildTrees() {
    const rng = this.rng;
    const positions = [];
    const blocked = (x, z) =>
      this.colliders.some(
        (b) => x > b.min.x - 2.5 && x < b.max.x + 2.5 && z > b.min.z - 2.5 && z < b.max.z + 2.5
      );
    while (positions.length < 90) {
      const angle = rng() * Math.PI * 2;
      // NOTE: Most trees ring the town; a few shade the streets.
      const radius = rng() < 0.25 ? rng() * this.bounds : this.bounds + 8 + rng() * 90;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (!blocked(x, z) && Math.hypot(x - this.spawn.x, z - this.spawn.z) > 6) {
        positions.push([x, z, 0.8 + rng() * 0.7]);
      }
    }

    const trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.25, 0.35, 3, 6),
      new THREE.MeshLambertMaterial({ color: 0x5b4030 }),
      positions.length
    );
    const leaves = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(2.2, 0),
      new THREE.MeshLambertMaterial({ color: 0x3f7d3a, flatShading: true }),
      positions.length
    );
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    positions.forEach(([x, z, s], idx) => {
      m.compose(new THREE.Vector3(x, 1.5 * s, z), q, new THREE.Vector3(s, s, s));
      trunks.setMatrixAt(idx, m);
      m.compose(new THREE.Vector3(x, 3.8 * s, z), q, new THREE.Vector3(s, s * 1.1, s));
      leaves.setMatrixAt(idx, m);
      const r = 0.35 * s;
      this.addCollider(x - r, 0, z - r, x + r, 3 * s, z + r);
    });
    trunks.castShadow = leaves.castShadow = true;
    this.scene.add(trunks, leaves);
  }

  buildHills() {
    const rng = this.rng;
    const hillMaterial = new THREE.MeshLambertMaterial({ color: 0x5f8045, flatShading: true });
    for (let i = 0; i < 26; i++) {
      const angle = (i / 26) * Math.PI * 2 + rng() * 0.2;
      const dist = 230 + rng() * 80;
      const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), hillMaterial);
      hill.scale.set(50 + rng() * 50, 25 + rng() * 45, 50 + rng() * 50);
      hill.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
      this.scene.add(hill);
    }

    // NOTE: The Himalaya on the northern horizon, unaffected by fog so they
    // read as a distant silhouette.
    const rock = new THREE.MeshBasicMaterial({ color: 0x9fb4c9, fog: false });
    const snow = new THREE.MeshBasicMaterial({ color: 0xf4f8fb, fog: false });
    for (let i = 0; i < 16; i++) {
      const x = -700 + i * 95 + (rng() - 0.5) * 50;
      const h = 160 + rng() * 200;
      const r = 90 + rng() * 60;
      const peak = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), rock);
      peak.position.set(x, h / 2 - 10, -900 - rng() * 120);
      peak.rotation.y = rng() * Math.PI;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.38, h * 0.38, 5), snow);
      cap.position.y = h * 0.31 + 0.5;
      peak.add(cap);
      this.scene.add(peak);
    }
  }

  buildKites() {
    const rng = this.rng;
    const anchors = this.rooftops.filter(() => rng() < 0.45);
    anchors.forEach((roof, idx) => {
      const colorA = KITE_COLORS[idx % KITE_COLORS.length];
      const colorB = KITE_COLORS[(idx + 3) % KITE_COLORS.length];

      // NOTE: A two-tone diamond kite (patang) built from two triangles.
      const kite = new THREE.Group();
      const half = (color, sign) => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          'position',
          new THREE.Float32BufferAttribute([0, 1.1, 0, sign * 0.95, 0, 0, 0, -1.3, 0], 3)
        );
        geometry.computeVertexNormals();
        return new THREE.Mesh(
          geometry,
          new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })
        );
      };
      kite.add(half(colorA, -1), half(colorB, 1));
      const tail = new THREE.Mesh(
        new THREE.PlaneGeometry(0.25, 1.2),
        new THREE.MeshLambertMaterial({ color: colorB, side: THREE.DoubleSide })
      );
      tail.position.y = -1.9;
      kite.add(tail);
      kite.scale.setScalar(1.6);
      this.scene.add(kite);

      const anchor = new THREE.Vector3(
        roof.x + (rng() - 0.5) * roof.w * 0.6,
        roof.y + 1.2,
        roof.z + (rng() - 0.5) * roof.d * 0.6
      );
      const segments = 16;
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(new Array(segments + 1).fill(0).map(() => new THREE.Vector3())),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })
      );
      line.frustumCulled = false;
      this.scene.add(line);

      this.kites.push({
        kite,
        line,
        anchor,
        segments,
        length: 40 + rng() * 40,
        elevation: 0.55 + rng() * 0.35,
        heading: (rng() - 0.5) * 0.6,
        phase: rng() * Math.PI * 2,
      });
    });
  }

  buildClouds() {
    const rng = this.rng;
    const material = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    for (let i = 0; i < 14; i++) {
      const cloud = new THREE.Group();
      const puffs = 4 + Math.floor(rng() * 4);
      for (let p = 0; p < puffs; p++) {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(6 + rng() * 6, 1), material);
        puff.position.set(p * 8 - puffs * 4, rng() * 4, (rng() - 0.5) * 8);
        puff.scale.y = 0.6;
        cloud.add(puff);
      }
      cloud.position.set((rng() - 0.5) * 900, 110 + rng() * 60, (rng() - 0.5) * 900);
      this.scene.add(cloud);
      this.clouds.push(cloud);
    }
  }

  update(delta, elapsed) {
    const tmpTarget = new THREE.Vector3();
    const control = new THREE.Vector3();
    const curve = new THREE.QuadraticBezierCurve3();

    for (const k of this.kites) {
      // NOTE: Kites hang downwind of their roof and dance in the gusts.
      const gust = Math.sin(elapsed * 0.7 + k.phase) * 0.12 + Math.sin(elapsed * 2.3 + k.phase) * 0.04;
      const heading = Math.atan2(WIND.z, WIND.x) + k.heading + gust;
      const elevation = k.elevation + Math.sin(elapsed * 0.9 + k.phase * 2) * 0.08;
      tmpTarget.set(
        Math.cos(heading) * Math.cos(elevation),
        Math.sin(elevation),
        Math.sin(heading) * Math.cos(elevation)
      ).multiplyScalar(k.length).add(k.anchor);
      k.kite.position.copy(tmpTarget);
      k.kite.lookAt(k.anchor.x, tmpTarget.y, k.anchor.z);
      k.kite.rotateZ(Math.sin(elapsed * 1.7 + k.phase) * 0.35);
      k.kite.rotateX(-0.35);

      // NOTE: The string sags towards the ground between roof and kite.
      control.copy(k.anchor).lerp(tmpTarget, 0.5);
      control.y -= k.length * 0.12;
      curve.v0.copy(k.anchor);
      curve.v1.copy(control);
      curve.v2.copy(tmpTarget);
      const positions = k.line.geometry.attributes.position;
      for (let s = 0; s <= k.segments; s++) {
        curve.getPoint(s / k.segments, tmpTarget);
        positions.setXYZ(s, tmpTarget.x, tmpTarget.y, tmpTarget.z);
      }
      positions.needsUpdate = true;
    }

    for (const cloud of this.clouds) {
      cloud.position.addScaledVector(WIND, delta * 2);
      if (cloud.position.x > 500) cloud.position.x -= 1000;
      if (cloud.position.z > 500) cloud.position.z -= 1000;
    }
  }
}
