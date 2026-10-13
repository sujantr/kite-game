import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module';

// NOTE: Owns the renderer, scene, camera, lights and the frame loop.
// Register per-frame logic with onUpdate(fn) and call dispose() on teardown.
export default class SceneInit {
  constructor(canvas) {
    this.canvas = canvas;
    this.fov = 60;
    this.nearPlane = 0.1;
    this.farPlane = 1000;

    this.scene = undefined;
    this.camera = undefined;
    this.renderer = undefined;
    this.clock = undefined;
    this.stats = undefined;
    this.updaters = [];
    this.frameId = undefined;

    this.onWindowResize = this.onWindowResize.bind(this);
    this.animate = this.animate.bind(this);
  }

  initialize() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9fd3f5);

    this.camera = new THREE.PerspectiveCamera(
      this.fov,
      window.innerWidth / window.innerHeight,
      this.nearPlane,
      this.farPlane
    );
    this.camera.position.set(0, 5, 12);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;

    this.clock = new THREE.Clock();
    if (import.meta.env.DEV) {
      this.stats = Stats();
      document.body.appendChild(this.stats.dom);
    }

    // sky/ground light for the whole scene, plus a sun that casts shadows
    this.scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x6b5a3e, 0.8));
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1);
    this.sunLight.position.set(20, 40, 20);
    this.sunLight.castShadow = true;
    this.scene.add(this.sunLight);

    window.addEventListener('resize', this.onWindowResize);
  }

  // NOTE: fn is called every frame with (deltaSeconds, elapsedSeconds).
  onUpdate(fn) {
    this.updaters.push(fn);
  }

  animate() {
    this.frameId = window.requestAnimationFrame(this.animate);
    // NOTE: Clamp delta so a backgrounded tab doesn't cause a huge jump.
    const delta = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;
    for (const fn of this.updaters) fn(delta, elapsed);
    this.renderer.render(this.scene, this.camera);
    if (this.stats) this.stats.update();
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  dispose() {
    window.cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.onWindowResize);
    if (this.stats) this.stats.dom.remove();
    this.scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.forEach((m) => m.dispose());
      }
    });
    this.renderer.dispose();
    this.updaters = [];
  }
}
