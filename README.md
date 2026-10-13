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
| `E` | Pick up a lattai (look for the glowing rings) / drop it |

### Flying a kite

| Key | Action |
| --- | --- |
| Left mouse / `F` | Pull the string (tanne): launches the kite and makes it climb |
| Right mouse / `R` | Let out string (dheel): the kite rises further away and drifts downwind |
| Look around | Steer the kite across the wind |

Cross your string with another kite's to start a pecha. Keep pulling or
letting out to cut their string before they cut yours. Kites that fly into
buildings snag and come down.

## Layout

- `src/lib/SceneInit.js` – renderer, camera, lights and the frame loop
- `src/game/World.js` – the town: houses with rooftop stairs, temple square, trees, hills, Himalaya, rooftop kites and lattai pickups
- `src/game/Player.js` – character model, movement, jumping and collision
- `src/game/Kite.js` – kite and lattai models, the player's kite flying, string geometry
- `src/game/Wind.js` – wind direction and gusts
- `src/game/CameraRig.js` – first/third-person camera with wall avoidance
- `src/game/Input.js` – keyboard and mouse-look handling
- `src/game/Game.js` – wires everything together
