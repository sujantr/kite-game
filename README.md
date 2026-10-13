# kite-game

A kite flying game for dashain. Hope to create a great one!

## Running

```sh
npm install
npm run dev
```

## Controls

| Key | Action |
| --- | --- |
| Click | Capture the mouse to look around (`Esc` releases it) |
| `W` `A` `S` `D` / arrows | Move |
| `Shift` | Run |
| `Space` | Jump |
| `V` | Switch between third and first person |
| Mouse wheel | Zoom the third-person camera; scroll all the way in for first person |

## Layout

- `src/lib/SceneInit.js` – renderer, camera, lights and the frame loop
- `src/game/World.js` – the town: houses with rooftop stairs, temple square, trees, hills, Himalaya and kites
- `src/game/Player.js` – character model, movement, jumping and collision
- `src/game/CameraRig.js` – first/third-person camera with wall avoidance
- `src/game/Input.js` – keyboard and mouse-look handling
- `src/game/Game.js` – wires everything together
