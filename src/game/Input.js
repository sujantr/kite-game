// NOTE: Keyboard + mouse state. Mouse look uses pointer lock when available,
// and falls back to click-and-drag (e.g. inside iframes that block it).
export default class Input {
  constructor(element, { onToggleView, onZoom, onLockChange, onInteract }) {
    this.element = element;
    this.keys = new Set();
    this.buttons = new Set();
    this.lookX = 0;
    this.lookY = 0;
    this.dragging = false;
    this.locked = false;
    this.onToggleView = onToggleView;
    this.onZoom = onZoom;
    this.onLockChange = onLockChange;
    this.onInteract = onInteract;

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    this.handleLockChange = this.handleLockChange.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.handleContextMenu = (e) => e.preventDefault();

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    element.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    element.addEventListener('wheel', this.handleWheel, { passive: false });
    element.addEventListener('contextmenu', this.handleContextMenu);
    document.addEventListener('pointerlockchange', this.handleLockChange);
  }

  requestLock() {
    const request = this.element.requestPointerLock?.();
    // NOTE: Newer browsers return a promise that rejects if lock is refused.
    if (request && request.catch) request.catch(() => {});
  }

  handleKeyDown(e) {
    if (e.code === 'KeyV' && !e.repeat) this.onToggleView();
    if (e.code === 'KeyE' && !e.repeat) this.onInteract();
    if (e.code === 'Space') e.preventDefault();
    this.keys.add(e.code);
  }

  handleKeyUp(e) {
    this.keys.delete(e.code);
  }

  handleBlur() {
    this.keys.clear();
    this.buttons.clear();
    this.dragging = false;
  }

  handleMouseDown(e) {
    // NOTE: The click that captures the mouse shouldn't also tug the kite.
    if (this.locked) this.buttons.add(e.button);
    if (e.button !== 0) return;
    this.dragging = true;
    if (!this.locked) this.requestLock();
  }

  handleMouseUp(e) {
    this.buttons.delete(e.button);
    if (e.button === 0) this.dragging = false;
  }

  handleMouseMove(e) {
    if (!this.locked && !this.dragging) return;
    this.lookX += e.movementX;
    this.lookY += e.movementY;
  }

  handleWheel(e) {
    e.preventDefault();
    this.onZoom(Math.sign(e.deltaY));
  }

  handleLockChange() {
    this.locked = document.pointerLockElement === this.element;
    if (!this.locked) this.buttons.clear();
    this.onLockChange(this.locked);
  }

  // NOTE: Returns and resets the mouse movement accumulated since last frame.
  consumeLook() {
    const look = { x: this.lookX, y: this.lookY };
    this.lookX = 0;
    this.lookY = 0;
    return look;
  }

  get state() {
    const k = this.keys;
    const axis = (pos, neg) => (pos.some((c) => k.has(c)) ? 1 : 0) - (neg.some((c) => k.has(c)) ? 1 : 0);
    return {
      forward: axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']),
      right: axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']),
      sprint: k.has('ShiftLeft') || k.has('ShiftRight'),
      jump: k.has('Space'),
      // NOTE: Kite string: pull in (tanne) and let out (dheel).
      pull: this.buttons.has(0) || k.has('KeyF'),
      release: this.buttons.has(2) || k.has('KeyR'),
    };
  }

  dispose() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    this.element.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    this.element.removeEventListener('wheel', this.handleWheel);
    this.element.removeEventListener('contextmenu', this.handleContextMenu);
    document.removeEventListener('pointerlockchange', this.handleLockChange);
    if (this.locked) document.exitPointerLock();
  }
}
