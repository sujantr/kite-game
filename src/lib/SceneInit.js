import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module';

export default class SceneInit {
  constructor(canvas) {
    // NOTE: Core components to initialize Three.js app.
    this.canvas = canvas;
    this.scene = undefined;
    this.camera = undefined;
    this.renderer = undefined;

    // NOTE: Camera params.
    this.fov = 70;
    this.nearPlane = 0.1;
    this.farPlane = 1500;

    // NOTE: Additional components.
    this.clock = undefined;
    this.stats = undefined;
    this.updaters = [];
    this.frameId = undefined;

    // NOTE: Lighting is basically required.
    this.hemisphereLight = undefined;
    this.sunLight = undefined;

    this.onWindowResize = this.onWindowResize.bind(this);
    this.animate = this.animate.bind(this);
  }

  initialize() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      this.fov,
      window.innerWidth / window.innerHeight,
      this.nearPlane,
      this.farPlane
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      // NOTE: Anti-aliasing smooths out the edges.
      antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.clock = new THREE.Clock();
    if (import.meta.env.DEV) {
      this.stats = Stats();
      document.body.appendChild(this.stats.dom);
    }

    // sky/ground light which is for the whole scene
    this.hemisphereLight = new THREE.HemisphereLight(0xcfe8ff, 0x6b5a3e, 0.75);
    this.scene.add(this.hemisphereLight);

    // directional light - parallel sun rays, follows the player so the
    // shadow map only has to cover the area around them
    this.sunLight = new THREE.DirectionalLight(0xfff1d6, 1.1);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.left = -60;
    this.sunLight.shadow.camera.right = 60;
    this.sunLight.shadow.camera.top = 60;
    this.sunLight.shadow.camera.bottom = -60;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 250;
    this.sunLight.shadow.bias = -0.0005;
    this.sunOffset = new THREE.Vector3(60, 100, 40);
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // if window resizes
    window.addEventListener('resize', this.onWindowResize, false);
  }

  // NOTE: Register a function called every frame with (deltaSeconds, elapsedSeconds).
  onUpdate(fn) {
    this.updaters.push(fn);
  }

  // NOTE: Keep the shadow-casting sun centred on a point of interest.
  followSun(position) {
    this.sunLight.target.position.copy(position);
    this.sunLight.position.copy(position).add(this.sunOffset);
  }

  animate() {
    this.frameId = window.requestAnimationFrame(this.animate);
    // NOTE: Clamp delta so a backgrounded tab doesn't teleport the player.
    const delta = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;
    for (const fn of this.updaters) fn(delta, elapsed);
    this.render();
    if (this.stats) this.stats.update();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  dispose() {
    window.cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.onWindowResize, false);
    if (this.stats) this.stats.dom.remove();
    this.scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.forEach((m) => {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      }
    });
    this.renderer.dispose();
    this.updaters = [];
  }
}
