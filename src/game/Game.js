import SceneInit from '../lib/SceneInit';
import World from './World';
import Player from './Player';
import CameraRig from './CameraRig';
import Input from './Input';

export default class Game {
  constructor(canvas, { onStateChange }) {
    this.onStateChange = onStateChange;

    this.engine = new SceneInit(canvas);
    this.engine.initialize();

    this.world = new World(this.engine.scene);
    this.player = new Player(this.engine.scene, this.world);
    this.rig = new CameraRig(this.engine.camera, this.player, this.world);
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
    });

    this.engine.onUpdate((delta, elapsed) => this.update(delta, elapsed));
    this.engine.animate();
    this.emitState();

    // NOTE: Handy for poking at the game from the browser console.
    if (import.meta.env.DEV) window.game = this;
  }

  update(delta, elapsed) {
    const look = this.input.consumeLook();
    this.rig.look(look.x, look.y);
    this.player.update(delta, this.input.state, this.rig.yaw, this.rig.firstPerson);
    this.rig.update(delta);
    this.world.update(delta, elapsed);
    this.engine.followSun(this.player.position);
  }

  emitState() {
    this.onStateChange({
      view: this.rig.firstPerson ? 'first' : 'third',
      locked: this.input.locked,
    });
  }

  dispose() {
    this.input.dispose();
    this.engine.dispose();
    if (window.game === this) delete window.game;
  }
}
