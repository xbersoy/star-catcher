# Star Catcher — learn PixiJS core concepts by playing

A small arcade game built with **PixiJS v8** that uses (and explains, in comments)
each core concept you need. No build step: one HTML page, one `main.js`, one SVG.

## Run it

ES modules and asset loading need a local web server (opening the file directly
with `file://` won't work). From this folder:

```bash
npx serve .            # or
python3 -m http.server 8080
```

Then open the printed URL (e.g. http://localhost:8080). PixiJS loads from the
jsDelivr CDN, so you need an internet connection.

**Controls:** mouse / touch / ← → / A D to move · click stars for bonus · P or Esc to pause.

## Concept map

Search `CONCEPT n` in `main.js` to jump to each lesson.

| # | Concept | Where you see it in the game |
|---|---------|------------------------------|
| 1 | `Application` — renderer, stage, ticker, async `init()` | The whole canvas |
| 2 | `Assets` — aliases, loading, caching, progress | The ship SVG |
| 3 | `Graphics` + `generateTexture` — draw vectors, bake to textures | Stars, meteors, flame, particles |
| 4 | Scene graph — `Container`, draw order, `sortableChildren`/`zIndex` | Background / world / HUD / menu layers |
| 5 | `TilingSprite` — `tilePosition` scrolling, parallax | Two starfield layers |
| 6 | `Sprite` transforms — position, rotation, scale, `anchor`, `tint`, alpha | Ship tilt, spinning coloured stars |
| 7 | `AnimatedSprite` — flip-book frames | Engine flame |
| 8 | Local vs global coords — `toGlobal` / `toLocal` | Orb orbiting the ship; collision |
| 9 | `Text` / `TextStyle` — only update text when it changes | Score, title, "+1" popups |
| 10 | Masks | Energy bar (the mask is scaled, not the bar) |
| 11 | Events — `eventMode`, `hitArea`, pointer events, keyboard | Moving, clickable stars, buttons |
| 12 | `ParticleContainer` + `Particle` + `blendMode: 'add'` | Explosion bursts |
| 13 | Filters — `BlurFilter`, `ColorMatrixFilter` | Pause / menu / game-over backdrop |
| 14 | `Ticker` — game loop, `deltaTime` vs `deltaMS` | Everything that moves |
| 15 | Resize — `resizeTo`, `app.screen`, `renderer.on('resize')` | Resize the browser window |
| 16 | Cleanup — `destroy()`, shared textures, object pooling | Removing stars/meteors, reusing particles |

## Suggested exercises

1. **Transforms:** make the ship grow slightly (`scale`) every 10 points. — *Done: search `EXERCISE 1` in main.js. Collision radii scale with the ship too.*
2. **Graphics:** add a new collectible — a heart drawn with `Graphics` that restores 25 energy. — *Done: search `EXERCISE 2` in main.js. Hearts only spawn while energy is below 100.*
3. **Assets:** replace `assets/ship.svg` with your own PNG (just change the `src`). — *Done: search `EXERCISE 3` in main.js. Uses `assets/ship@2x.png`; add `?ship=svg` to the URL for the SVG.*
4. **Events:** make meteors draggable (`pointerdown` → track `pointermove` → `pointerup`).
5. **Filters:** add a brief `BlurFilter` on the world when the ship is hit.
6. **Scene graph:** add a second orb to `orbit` at `x = -62`.
7. **Performance:** pool stars and meteors the same way particles are pooled.
8. **Renderer:** set `preference: 'webgpu'` in `app.init` and compare.

Tip: install the **PixiJS DevTools** browser extension — `main.js` exposes
`__PIXI_APP__` so you can inspect the live scene tree.
