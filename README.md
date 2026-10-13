# kite-game

A kite flying game for dashain. Hope to create a great one!

## Running

```sh
npm install
npm run dev
```

Then open http://localhost:5173.

## Layout

- `src/lib/SceneInit.js` – renderer, scene, camera, lights and the frame loop
  (`onUpdate(fn)` for per-frame logic, `dispose()` for teardown)
- `src/App.jsx` – mounts the canvas and sets up the scene
