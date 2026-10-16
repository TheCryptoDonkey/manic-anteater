# Manic Anteater

A Manic Miner-style platformer for the browser. You are an anteater: slurp up every ant hill in the room, and the portal opens to the next one. Ten rooms, then the game loops with faster beasts.

**Play:** https://thecryptodonkey.github.io/manic-anteater/

## Controls

| Action | Keyboard | Phone |
|---|---|---|
| Walk | ← → or A D | ◀ ▶ |
| Jump | Space, ↑ or W | JUMP (hold ◀ or ▶ to jump sideways) |
| Start | Enter | Tap the screen or JUMP |
| Pause | P | Pause |
| Music | M | Music on/off |

On the title screen, ← → picks the starting level. On a phone, play in landscape.

## Rules

- Jumps are committed arcs; walking off a ledge drops you straight down.
- Falling more than eight tiles is fatal.
- Energy drains constantly; what's left at the portal is added to your score.
- Crumbling floors give way, conveyors carry you, and every guardian is deadly.
- An extra life every 10,000 points.

## Project layout

```
index.html          the whole game, built from src/ (this is what GitHub Pages serves)
src/core.js         level maps and physics (no DOM, so it runs in Node)
src/ui.js           rendering, sound, input and the game state machine
src/page.html       page markup and styles
tools/build.js      assembles index.html; --check fails if it is stale
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
