import * as THREE from 'three';
import SceneInit from '../lib/SceneInit';
import World from './World';
import Player from './Player';
import CameraRig from './CameraRig';
import Input from './Input';
import KiteFlyer, { createLattai, polylineDistance } from './Kite';
import { windStrength } from './Wind';

const PICKUP_RANGE = 1.8;
const STATE_INTERVAL = 0.1;
// NOTE: Strings closer than this are tangled together in a pecha (kite fight).
const TANGLE_DISTANCE = 1.2;
const PECHA_WIN = 2;

const MESSAGES = {
  pickedUp: 'Got a lattai! Hold left mouse (or F) to launch the kite.',
  dropped: 'Lattai dropped.',
  launched: 'Up it goes! Pull to climb, right mouse (or R) to let out string.',
  crashed: 'Your kite came down. Hold left mouse to launch it again.',
  snagged: 'Your kite snagged on a building! Hold left mouse to relaunch.',
  newKite: 'New kite tied on. Hold left mouse to launch.',
  won: 'Chet! You cut their kite!',
  lost: 'Your kite was cut! Tying on a new one…',
};

export default class Game {
  constructor(canvas, { onStateChange }) {
    this.onStateChange = onStateChange;

    this.engine = new SceneInit(canvas);
    this.engine.initialize();

    this.world = new World(this.engine.scene);
    this.player = new Player(this.engine.scene, this.world);
    this.rig = new CameraRig(this.engine.camera, this.player, this.world);
    this.flyer = new KiteFlyer(this.engine.scene, (event) => this.showMessage(MESSAGES[event]));
    this.input = new Input(canvas, {
      onToggleView: () => {
        this.rig.toggleView();
        this.emitState();
      },
      onZoom: (direction) => {
        this.rig.zoom(direction);
        this.emitState();
      },
      onLockChange: () => this.emitState(),
      onInteract: () => this.interact(),
    });

    // NOTE: First-person lattai, held at the bottom right of the view.
    this.viewLattai = createLattai();
    this.viewLattai.position.set(0.3, -0.27, -0.7);
    this.viewLattai.rotation.set(0.35, -0.3, 0);
    this.viewLattai.scale.setScalar(0.5);
    this.viewLattai.visible = false;
    this.engine.camera.add(this.viewLattai);

    this.holding = false;
    this.nearPickup = null;
    this.score = 0;
    this.pecha = null;
    this.message = null;
    this.messageTimer = 0;
    this.stateTimer = 0;
    this.elapsed = 0;
    this.hand = new THREE.Vector3();

    this.engine.onUpdate((delta, elapsed) => this.update(delta, elapsed));
    this.engine.animate();
    this.emitState();

    // NOTE: Handy for poking at the game from the browser console.
    if (import.meta.env.DEV) window.game = this;
  }

  // NOTE: E picks up the nearest lattai, or drops the one being held.
  interact() {
    if (this.holding) {
      this.holding = false;
      this.endPecha();
      this.flyer.drop();
      this.player.setHolding(false);
      this.viewLattai.visible = false;
      const spot = this.player.position.clone();
      spot.x += -Math.sin(this.player.facing) * 0.8;
      spot.z += -Math.cos(this.player.facing) * 0.8;
      this.world.addPickup(spot);
      this.showMessage(MESSAGES.dropped);
    } else if (this.nearPickup) {
      this.world.removePickup(this.nearPickup);
      this.nearPickup = null;
      this.holding = true;
      this.player.setHolding(true);
      this.flyer.pickUp();
      this.showMessage(MESSAGES.pickedUp);
    }
    this.emitState();
  }

  showMessage(text, seconds = 3.5) {
    this.message = text;
    this.messageTimer = seconds;
    this.emitState();
  }

  update(delta, elapsed) {
    this.elapsed = elapsed;
    const look = this.input.consumeLook();
    const controls = this.input.state;
    this.rig.look(look.x, look.y);
    this.player.update(delta, controls, this.rig.yaw, this.rig.firstPerson);
    this.rig.update(delta);
    this.world.update(delta, elapsed);

    if (this.holding) this.updateKite(delta, elapsed, controls);
    else this.nearPickup = this.world.nearestPickup(this.player.position, PICKUP_RANGE);

    this.engine.followSun(this.player.position);

    if (this.messageTimer > 0) {
      this.messageTimer -= delta;
      if (this.messageTimer <= 0) this.message = null;
    }
    this.stateTimer += delta;
    if (this.stateTimer >= STATE_INTERVAL) this.emitState();
  }

  updateKite(delta, elapsed, controls) {
    // NOTE: The string leaves from whichever lattai is on screen.
    const firstPerson = !this.player.upperBody.visible;
    this.viewLattai.visible = firstPerson;
    const source = firstPerson ? this.viewLattai : this.player.lattai;
    source.updateWorldMatrix(true, false);
    source.getWorldPosition(this.hand);

    this.flyer.update(delta, elapsed, controls, this.hand, this.rig.yaw, this.player.position.y);
    if (this.flyer.flying && this.world.colliders.some((box) => box.containsPoint(this.flyer.position))) {
      this.flyer.crash('snagged');
    }

    const spin = this.flyer.spin;
    this.player.lattai.userData.spool.rotation.x = spin;
    this.viewLattai.userData.spool.rotation.x = spin;

    this.updatePecha(delta, elapsed, controls);
  }

  // NOTE: When strings cross they hook together and both flyers saw at each
  // other until one string is cut. Actively pulling (tanne) or letting out
  // (dheel) builds your side faster than holding still.
  updatePecha(delta, elapsed, controls) {
    if (!this.flyer.flying) {
      this.endPecha();
      return;
    }

    if (!this.pecha) {
      for (const k of this.world.kites) {
        if (k.cut) continue;
        const { distance, index } = polylineDistance(this.flyer.points, k.points);
        if (distance < TANGLE_DISTANCE) {
          this.pecha = { kite: k, index, you: 0, them: 0 };
          k.hook = new THREE.Vector3();
          break;
        }
      }
      if (!this.pecha) return;
    }

    const p = this.pecha;
    p.kite.hook.copy(this.flyer.points[p.index]);
    const wind = windStrength(elapsed);
    const effort = controls.pull ? 1.1 : controls.release ? 0.95 : 0.25;
    p.you += effort * (0.8 + 0.4 * wind) * delta;
    p.them += p.kite.strength * (0.8 + 0.4 * Math.sin(elapsed * 3 + p.kite.phase)) * delta;

    if (p.you >= PECHA_WIN) {
      this.world.cutKite(p.kite);
      this.score++;
      this.pecha = null;
      this.showMessage(MESSAGES.won);
    } else if (p.them >= PECHA_WIN) {
      this.endPecha();
      this.flyer.cut();
      this.showMessage(MESSAGES.lost);
    }
  }

  endPecha() {
    if (!this.pecha) return;
    this.pecha.kite.hook = null;
    this.pecha = null;
  }

  emitState() {
    this.stateTimer = 0;
    this.onStateChange({
      view: this.rig.firstPerson ? 'first' : 'third',
      locked: this.input.locked,
      holding: this.holding,
      nearPickup: !this.holding && !!this.nearPickup,
      kite: this.holding
        ? {
            state: this.flyer.state,
            line: Math.round(this.flyer.length),
            height: Math.round(this.flyer.height),
          }
        : null,
      wind: Math.round(windStrength(this.elapsed) * 8),
      score: this.score,
      pecha: this.pecha
        ? { you: Math.min(this.pecha.you / PECHA_WIN, 1), them: Math.min(this.pecha.them / PECHA_WIN, 1) }
        : null,
      message: this.message,
    });
  }

  dispose() {
    this.input.dispose();
    this.engine.dispose();
    if (window.game === this) delete window.game;
  }
}
