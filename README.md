# Manic Anteater

A Manic Miner-style platformer for the browser. You are an anteater: slurp up every ant hill in the room, and the portal opens to the next one. Ten rooms, then the game loops with faster beasts.

**Play:** https://thecryptodonkey.github.io/manic-anteater/

## Controls

| Action | Keyboard | Phone |
|---|---|---|
| Walk | ← → or A D | Thumb down anywhere on the left half, slide left or right |
| Jump | Space, ↑ or W | Tap the right half, or flick up with the left thumb |
| Start | Enter | Tap the right half |
| Pause | P | Pause button |
| Music | M | Music button |
| Warp to the next level | N, or double-click the level name | Double-tap the level name |

On the title screen, ← → picks the starting level (on a phone, tap the left half). On a phone the whole screen is the controller, so the game can fill the display: the left half is a floating stick that appears under your thumb, and the right half jumps. Hold a direction and tap jump, or flick up, to jump sideways. Gamepads work as well (stick or d-pad to walk, A or B to jump, Start to pause, Select to warp).

## Install as an app

Manic Anteater is a progressive web app: once installed it opens full screen, works offline and keeps your high score.

- **Android (Chrome):** tap **Install** under the game, or use the browser menu's **Install app**.
- **iPhone and iPad (Safari):** tap **Share**, then **Add to Home Screen**.
- **Desktop (Chrome or Edge):** use the install icon in the address bar.

The screen fits itself to the device. Upright, the playfield runs edge to edge across the top and the empty space below is for your thumbs. Sideways, the playfield takes the full height, and the screen switches to a 16:9 layout with a compact status strip whenever that makes the playfield bigger. Wide desktop windows get the same treatment.

## Rules

- Jumps are committed arcs; walking off a ledge drops you straight down.
- Falling more than eight tiles is fatal.
- Energy drains constantly; what's left at the portal is added to your score.
- Crumbling floors give way, conveyors carry you, and every guardian is deadly.
- An extra life every 10,000 points.

## Project layout

```
index.html          the whole game, built from src/ (this is what GitHub Pages serves)
sw.js               offline cache, built from src/sw.js with a version stamped from index.html
manifest.webmanifest, icons/   PWA metadata and home-screen icons
src/core.js         level maps and physics (no DOM, so it runs in Node)
src/ui.js           rendering, sound, input and the game state machine
src/page.html       page markup and styles
src/sw.js           service worker source
tools/build.js      assembles index.html and sw.js; --check fails if either is stale
tools/validate.js   searches every level with the real physics to prove each hill and portal is reachable
```

After editing anything in `src/`, run:

```sh
node tools/validate.js
node tools/build.js
```

There are no dependencies. CI runs both commands on every push.

## Credits

The music is a beeper arrangement of *In the Hall of the Mountain King* by Edvard Grieg (public domain), as a nod to the 1983 original.
