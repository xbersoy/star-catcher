// ============================================================================
//  STAR CATCHER — a tiny PixiJS v8 game that tours the core concepts.
//
//  Catch falling stars with your ship (+1), click/tap them for a bonus (+3),
//  and let your orbiting shield orb smash meteors. Meteors that hit the ship
//  drain energy. Move: mouse / touch / arrow keys / A-D.  Pause: P or Esc.
//
//  Every lesson is marked "CONCEPT n" — the numbers match README.md.
// ============================================================================

import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  AnimatedSprite,
  TilingSprite,
  Text,
  TextStyle,
  ParticleContainer,
  Particle,
  BlurFilter,
  ColorMatrixFilter,
  Rectangle,
  Circle,
} from 'https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.min.mjs';

// Small helpers used throughout
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// ---------------------------------------------------------------------------
// CONCEPT 1 — Application
// The Application bundles three things:
//   • app.renderer – draws everything (WebGL, or WebGPU if you ask for it)
//   • app.stage    – the root Container; anything added here gets drawn
//   • app.ticker   – a requestAnimationFrame loop that re-renders every frame
// In v8, setup is async: create it, then `await app.init(options)`.
// ---------------------------------------------------------------------------
const app = new Application();
await app.init({
  background: '#070b1a',
  resizeTo: window,          // canvas follows the window size automatically
  antialias: true,
  autoDensity: true,         // keeps CSS size correct on retina screens
  resolution: Math.min(window.devicePixelRatio, 2),
  // preference: 'webgpu',   // try this to opt into the WebGPU renderer
});
document.body.appendChild(app.canvas);
globalThis.__PIXI_APP__ = app; // lets the "PixiJS DevTools" browser extension inspect the scene

// ---------------------------------------------------------------------------
// CONCEPT 2 — Assets
// `Assets` is Pixi's loader + cache. Register a file under an alias, then
// load it. The result is a Texture (GPU image) you can give to Sprites.
// Loading the same alias twice returns the cached texture — no re-download.
// ---------------------------------------------------------------------------
const loadingEl = document.getElementById('loading');
Assets.add({ alias: 'ship', src: './assets/ship.svg', data: { resolution: 2 } });
const loaded = await Assets.load(['ship'], (progress) => {
  loadingEl.textContent = `Loading… ${Math.round(progress * 100)}%`;
});
loadingEl.remove();
const shipTexture = loaded.ship;

// ---------------------------------------------------------------------------
// CONCEPT 3 — Graphics & generateTexture
// Graphics draws vector shapes with a chainable API: shape → fill/stroke.
// A Graphics object can be shown directly, BUT if you need many copies it is
// much faster to "bake" it once into a Texture and use cheap Sprites.
// We draw everything white so we can colour copies later with `tint`.
// ---------------------------------------------------------------------------
function bake(graphics, frame) {
  const texture = app.renderer.generateTexture(frame ? { target: graphics, frame } : graphics);
  graphics.destroy(); // the Graphics is no longer needed once baked
  return texture;
}

const starTexture = bake(
  new Graphics()
    .star(0, 0, 5, 18, 8)          // x, y, points, outer radius, inner radius
    .fill(0xffffff)
    .stroke({ width: 2, color: 0xffffff, alpha: 0.5 })
);

function makeMeteorTexture() {
  const g = new Graphics();
  const points = [];
  const corners = 10;
  for (let i = 0; i < corners; i++) {
    const angle = (i / corners) * Math.PI * 2;
    const radius = rand(20, 28);
    points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  g.poly(points).fill(0x8d6e63).stroke({ width: 3, color: 0x5d4037 });
  g.circle(-8, -5, 5).fill(0x6d4c41);  // craters
  g.circle(7, 6, 4).fill(0x6d4c41);
  g.circle(4, -11, 3).fill(0x6d4c41);
  return bake(g);
}
const meteorTextures = [makeMeteorTexture(), makeMeteorTexture(), makeMeteorTexture()];

// A soft round glow for particles: stacked circles with rising alpha.
const particleTexture = bake(
  new Graphics()
    .circle(0, 0, 8).fill({ color: 0xffffff, alpha: 0.15 })
    .circle(0, 0, 5).fill({ color: 0xffffff, alpha: 0.4 })
    .circle(0, 0, 2.5).fill({ color: 0xffffff, alpha: 1 })
);

// EXERCISE 2 — a heart built from simple shapes in ONE Graphics object:
// two circles + a triangle, each filled with the same colour.
const HEART_COLOR = 0xff4d6d;
const heartTexture = bake(
  new Graphics()
    .circle(-7, -3, 8).fill(HEART_COLOR)
    .circle(7, -3, 8).fill(HEART_COLOR)
    .poly([-14.6, -1, 14.6, -1, 0, 17]).fill(HEART_COLOR)
    .circle(-9, -6, 2.5).fill({ color: 0xffffff, alpha: 0.7 }) // shine
);

// A square tile of random dots. We pass an explicit `frame` so the texture is
// exactly 512×512 — important for seamless tiling (CONCEPT 5).
function makeStarfieldTexture(size, count, maxRadius) {
  const g = new Graphics();
  for (let i = 0; i < count; i++) {
    g.circle(rand(0, size), rand(0, size), rand(0.4, maxRadius))
      .fill({ color: 0xffffff, alpha: rand(0.3, 1) });
  }
  return bake(g, new Rectangle(0, 0, size, size));
}

// Four flame shapes of different lengths → frames for an AnimatedSprite.
// Same frame rectangle for each so they line up perfectly.
const flameFrames = [16, 26, 20, 30].map((len) =>
  bake(
    new Graphics()
      .poly([-8, 0, 8, 0, 0, len]).fill(0xffb703)
      .poly([-4, 0, 4, 0, 0, len * 0.6]).fill(0xfff3b0),
    new Rectangle(-8, 0, 16, 32)
  )
);

// ---------------------------------------------------------------------------
// CONCEPT 4 — The scene graph (Containers, draw order, zIndex)
// Containers group children. A child's position/rotation/scale/alpha are
// RELATIVE to its parent, so moving a parent moves all its children.
// Children draw in the order they were added (later = on top), unless the
// parent has `sortableChildren = true`, in which case `zIndex` decides.
// ---------------------------------------------------------------------------
const background = new Container();   // starfield
const world = new Container();        // ship, stars, meteors, particles
const hud = new Container();          // score + energy bar
const menu = new Container();         // title / pause / game-over overlay
world.sortableChildren = true;
app.stage.addChild(background, world, hud, menu); // bottom → top

// ---------------------------------------------------------------------------
// CONCEPT 5 — TilingSprite
// Repeats a texture across an area. Changing `tilePosition` scrolls the
// pattern without moving the sprite — perfect for endless backgrounds.
// Two layers moving at different speeds = cheap parallax depth.
// ---------------------------------------------------------------------------
const farStars = new TilingSprite({
  texture: makeStarfieldTexture(512, 140, 1.2),
  width: app.screen.width,
  height: app.screen.height,
});
farStars.alpha = 0.55;
const nearStars = new TilingSprite({
  texture: makeStarfieldTexture(512, 35, 2.2),
  width: app.screen.width,
  height: app.screen.height,
});
background.addChild(farStars, nearStars);

// ---------------------------------------------------------------------------
// CONCEPT 6 — Sprites and transforms
// A Sprite shows a Texture. Key properties shared by every display object:
//   position (x, y) · rotation (radians) · scale · alpha · visible · tint
// `anchor` (Sprites only) is the texture's origin as a 0–1 fraction:
//   (0,0) = top-left, (0.5,0.5) = centre. Rotation spins around the anchor.
// `pivot` does the same for Containers, but in pixels.
// ---------------------------------------------------------------------------
const ship = new Container();
ship.zIndex = 10;

const shipBody = new Sprite(shipTexture);
shipBody.anchor.set(0.5); // centre of the 64×80 SVG

// ---------------------------------------------------------------------------
// CONCEPT 7 — AnimatedSprite
// A Sprite that flips through an array of textures (a flip-book).
// animationSpeed is frames-per-tick: 0.4 ≈ 24 fps at 60 fps.
// ---------------------------------------------------------------------------
const flame = new AnimatedSprite(flameFrames);
flame.anchor.set(0.5, 0);
flame.y = 26;               // just below the nozzle
flame.animationSpeed = 0.4;
flame.blendMode = 'add';    // additive blending makes it glow (see CONCEPT 12)
flame.play();

// ---------------------------------------------------------------------------
// CONCEPT 8 — Local vs global coordinates
// The orb lives inside `orbit`, which lives inside `ship`. We only ever set
// orb.x = 62 and spin `orbit` — the scene graph combines the transforms, so
// the orb circles the ship AND follows it. To know where the orb really is
// (for collisions) we convert: orb local → global (screen) → world local.
// ---------------------------------------------------------------------------
const orbit = new Container();
const orb = new Graphics()             // a Graphics can also be displayed directly
  .circle(0, 0, 15).fill({ color: 0x4cc9f0, alpha: 0.25 })
  .circle(0, 0, 9).fill(0x4cc9f0);
orb.x = 62;
orbit.addChild(orb);

ship.addChild(flame, shipBody, orbit); // flame first → drawn behind the body
world.addChild(ship);

function orbPositionInWorld() {
  const global = orb.toGlobal({ x: 0, y: 0 }); // orb's centre in screen space
  return world.toLocal(global);                // …expressed in world space
}

// ---------------------------------------------------------------------------
// CONCEPT 9 — Text & TextStyle
// Text renders a string to a texture. Changing `.text` re-renders it, so only
// update it when the value actually changes (never blindly every frame).
// Reuse one TextStyle for many Text objects.
// ---------------------------------------------------------------------------
const hudStyle = new TextStyle({
  fontFamily: 'Arial, sans-serif',
  fontSize: 26,
  fontWeight: 'bold',
  fill: '#ffffff',
  stroke: { color: '#1b1f4a', width: 4 },
});
const scoreText = new Text({ text: 'Score: 0', style: hudStyle });
scoreText.position.set(20, 14);

const bestStyle = hudStyle.clone(); // derive a variant from an existing style
bestStyle.fontSize = 18;
bestStyle.fill = '#ffd166';
const bestText = new Text({ text: 'Best: 0', style: bestStyle });
bestText.position.set(22, 46);

// ---------------------------------------------------------------------------
// CONCEPT 10 — Masks
// A mask limits what is visible. The bar below is always fully drawn
// (red→yellow→green); a white rectangle masks it, and we just scale the
// mask horizontally to reveal more or less. The mask must be on the stage.
// ---------------------------------------------------------------------------
const BAR_W = 200;
const BAR_H = 16;
const energyBar = new Container();
energyBar.position.set(20, 76);

const barBack = new Graphics()
  .roundRect(-2, -2, BAR_W + 4, BAR_H + 4, 10)
  .fill({ color: 0x000000, alpha: 0.5 })
  .stroke({ width: 2, color: 0xffffff, alpha: 0.6 });
const barFill = new Graphics()
  .rect(0, 0, BAR_W / 3, BAR_H).fill(0xef233c)
  .rect(BAR_W / 3, 0, BAR_W / 3, BAR_H).fill(0xffb703)
  .rect((BAR_W * 2) / 3, 0, BAR_W / 3, BAR_H).fill(0x06d6a0);
const barMask = new Graphics().roundRect(0, 0, BAR_W, BAR_H, 8).fill(0xffffff);
barFill.mask = barMask;
energyBar.addChild(barBack, barFill, barMask);

hud.addChild(scoreText, bestText, energyBar);

// ---------------------------------------------------------------------------
// CONCEPT 12 — ParticleContainer + blend modes
// ParticleContainer is a super-fast batch for thousands of light-weight
// `Particle` objects that share ONE texture. You declare which properties
// change every frame in `dynamicProperties` so Pixi only uploads those.
// blendMode 'add' sums colours — overlapping particles glow brighter.
// (Concept 11 — events — is further below, near the input code.)
// ---------------------------------------------------------------------------
const particles = new ParticleContainer({
  texture: particleTexture,
  dynamicProperties: { position: true, vertex: true, color: true, rotation: false },
});
particles.blendMode = 'add';
particles.zIndex = 20;
world.addChild(particles);

// CONCEPT 16 (preview) — pooling: reuse dead particles instead of creating new ones.
const liveParticles = [];
const freeParticles = [];

function burst(x, y, tint, count = 18) {
  for (let i = 0; i < count; i++) {
    const p = freeParticles.pop() ?? new Particle({ texture: particleTexture, anchorX: 0.5, anchorY: 0.5 });
    const angle = rand(0, Math.PI * 2);
    const speed = rand(1.5, 6);
    p.x = x;
    p.y = y;
    p.tint = tint;
    p.alpha = 1;
    p.scaleX = p.scaleY = rand(0.6, 1.4);
    p.vx = Math.cos(angle) * speed;   // our own custom fields
    p.vy = Math.sin(angle) * speed;
    p.life = p.maxLife = rand(25, 50);
    particles.addParticle(p);
    liveParticles.push(p);
  }
}

function updateParticles(dt) {
  for (let i = liveParticles.length - 1; i >= 0; i--) {
    const p = liveParticles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy = p.vy * 0.96 + 0.06 * dt; // a little gravity
    p.life -= dt;
    p.alpha = Math.max(0, p.life / p.maxLife);
    if (p.life <= 0) {
      particles.removeParticle(p);
      liveParticles.splice(i, 1);
      freeParticles.push(p);
    }
  }
}

// Floating "+1" labels
const popupStyle = new TextStyle({
  fontFamily: 'Arial, sans-serif',
  fontSize: 22,
  fontWeight: 'bold',
  fill: '#ffffff',
  stroke: { color: '#000000', width: 3 },
});
const popups = [];
function popup(label, x, y, tint = 0xffffff) {
  const t = new Text({ text: label, style: popupStyle });
  t.anchor.set(0.5);
  t.position.set(x, y);
  t.tint = tint;
  t.zIndex = 30;
  world.addChild(t);
  popups.push(t);
}

// ---------------------------------------------------------------------------
// CONCEPT 13 — Filters
// Filters are GPU post-effects applied to a whole Container. They're powerful
// but cost performance, so switch them on only when needed (here: overlays).
// ---------------------------------------------------------------------------
const blurFilter = new BlurFilter({ strength: 6 });
const grayFilter = new ColorMatrixFilter();
grayFilter.desaturate();

function setBackdropFilters(on) {
  const list = on ? [blurFilter, grayFilter] : null;
  world.filters = list;
  background.filters = list;
}

// ---------------------------------------------------------------------------
// Menu overlay (title / pause / game over) — a reusable button made from a
// Container holding a Graphics + Text, which is how most Pixi UI is built.
// ---------------------------------------------------------------------------
const dim = new Graphics();
const titleText = new Text({
  text: 'STAR CATCHER',
  style: {
    fontFamily: 'Arial Black, Arial, sans-serif',
    fontSize: 64,
    fontWeight: '900',
    fill: '#ffd166',
    stroke: { color: '#3a0ca3', width: 8 },
    dropShadow: { color: '#000000', blur: 6, distance: 6, angle: Math.PI / 3, alpha: 0.6 },
  },
});
titleText.anchor.set(0.5);
titleText.y = -110;

const subtitleText = new Text({
  text: '',
  style: {
    fontFamily: 'Arial, sans-serif',
    fontSize: 20,
    fill: '#cdd6ff',
    align: 'center',
    lineHeight: 30,
    wordWrap: true,
    wordWrapWidth: 520,
  },
});
subtitleText.anchor.set(0.5);
subtitleText.y = -10;

function createButton(label, onClick) {
  const button = new Container();
  const bg = new Graphics()
    .roundRect(-110, -30, 220, 60, 16)
    .fill(0x4361ee)
    .stroke({ width: 3, color: 0xffffff, alpha: 0.85 });
  const text = new Text({ text: label, style: { fontFamily: 'Arial', fontSize: 26, fontWeight: 'bold', fill: '#ffffff' } });
  text.anchor.set(0.5);
  button.addChild(bg, text);

  // CONCEPT 11 (preview) — making something interactive: set eventMode + listen.
  button.eventMode = 'static';
  button.cursor = 'pointer';
  button.on('pointerover', () => button.scale.set(1.08));
  button.on('pointerout', () => button.scale.set(1));
  button.on('pointertap', onClick);
  button.caption = text; // keep a reference so we can change it later
  // (don't use `label` — in v8 that's Container's built-in name string)
  return button;
}
const menuButton = createButton('PLAY', () => onMenuAction());
menuButton.y = 90;

menu.addChild(dim, titleText, subtitleText, menuButton);

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------
let state = 'menu'; // 'menu' | 'play' | 'paused' | 'over'
const game = { score: 0, best: 0, energy: 100, elapsed: 0, starTimer: 0, meteorTimer: 1, heartTimer: 8, shake: 0, hitFlash: 0 };
const stars = [];
const meteors = [];
const hearts = [];
let targetX = app.screen.width / 2;
const keys = new Set();

function showMenu(mode) {
  menu.visible = true;
  setBackdropFilters(true);
  if (mode === 'menu') {
    titleText.text = 'STAR CATCHER';
    subtitleText.text =
      'Catch stars with your ship (+1) or click them (+3).\nYour orbiting orb smashes meteors. Don\'t get hit!\nMouse / touch / ← → or A D  ·  P to pause';
    menuButton.caption.text = 'PLAY';
  } else if (mode === 'paused') {
    titleText.text = 'PAUSED';
    subtitleText.text = 'Blur + grayscale filters are applied to the game world.\nPress P or click Resume.';
    menuButton.caption.text = 'RESUME';
  } else if (mode === 'over') {
    titleText.text = 'GAME OVER';
    subtitleText.text = `Score: ${game.score}    Best: ${game.best}`;
    menuButton.caption.text = 'PLAY AGAIN';
  }
}

function hideMenu() {
  menu.visible = false;
  setBackdropFilters(false);
}

function onMenuAction() {
  if (state === 'paused') resume();
  else if (state === 'menu' || state === 'over') startGame();
}

function setScore(value) {
  game.score = value;
  scoreText.text = `Score: ${value}`; // only called when the score changes

  // EXERCISE 1 — Transforms: the ship grows 5% every 10 points (max +50%).
  // Scaling the parent Container scales everything inside it — body, flame
  // and the orb (even the orbit radius grows, because it's a child too).
  ship.scale.set(1 + Math.min(Math.floor(value / 10) * 0.05, 0.5));
}

function startGame() {
  // CONCEPT 16 — clean up everything from the previous round
  for (const s of stars) s.destroy();
  for (const m of meteors) m.destroy();
  for (const t of popups) t.destroy();
  for (const h of hearts) h.destroy();
  stars.length = meteors.length = popups.length = hearts.length = 0;

  setScore(0);
  game.energy = 100;
  game.elapsed = 0;
  game.starTimer = 0;
  game.meteorTimer = 1.5;
  game.heartTimer = 8;
  state = 'play';
  hideMenu();
}

function pause() {
  if (state !== 'play') return;
  state = 'paused';
  showMenu('paused');
}
function resume() {
  if (state !== 'paused') return;
  state = 'play';
  hideMenu();
}

function gameOver() {
  state = 'over';
  game.best = Math.max(game.best, game.score);
  bestText.text = `Best: ${game.best}`;
  burst(ship.x, ship.y, 0xff6b6b, 60);
  showMenu('over');
}

// ---------------------------------------------------------------------------
// Spawning
// ---------------------------------------------------------------------------
const STAR_COLORS = [0xffd166, 0x4cc9f0, 0xf72585, 0x80ffdb, 0xffffff];

function spawnStar() {
  const star = new Sprite(starTexture); // many Sprites share ONE texture: cheap
  star.anchor.set(0.5);
  star.position.set(rand(30, app.screen.width - 30), -30);
  star.tint = pick(STAR_COLORS);        // colour a white texture per sprite
  star.scale.set(rand(0.8, 1.25));
  star.zIndex = 5;
  star.vy = rand(2, 3.5);               // custom fields for our own logic
  star.spin = rand(-0.08, 0.08);

  // CONCEPT 11 — per-object events. `hitArea` makes it easier to click.
  star.eventMode = 'static';
  star.cursor = 'pointer';
  star.hitArea = new Circle(0, 0, 30);
  star.on('pointerdown', () => {
    if (state === 'play') collectStar(star, 3);
  });

  world.addChild(star);
  stars.push(star);
}

function spawnMeteor(difficulty) {
  const meteor = new Sprite(pick(meteorTextures));
  meteor.anchor.set(0.5);
  const scale = rand(0.8, 1.5);
  meteor.scale.set(scale);
  meteor.position.set(rand(30, app.screen.width - 30), -40);
  meteor.zIndex = 6;
  meteor.vx = rand(-0.8, 0.8);
  meteor.vy = rand(2.5, 4) * Math.min(difficulty, 2.5);
  meteor.spin = rand(-0.05, 0.05);
  meteor.radius = 22 * scale;
  world.addChild(meteor);
  meteors.push(meteor);
}

// EXERCISE 2 — a rare heart that restores 25 energy
function spawnHeart() {
  const heart = new Sprite(heartTexture);
  heart.anchor.set(0.5);
  heart.position.set(rand(40, app.screen.width - 40), -30);
  heart.zIndex = 5;
  heart.vy = 2.2;
  heart.age = 0;
  world.addChild(heart);
  hearts.push(heart);
}

function removeFrom(list, obj) {
  const i = list.indexOf(obj);
  if (i !== -1) list.splice(i, 1);
  // CONCEPT 16 — destroy() removes it from its parent and frees its resources.
  // The shared texture is NOT destroyed (that's the default), so others keep it.
  obj.destroy();
}

function collectStar(star, points) {
  setScore(game.score + points);
  burst(star.x, star.y, star.tint, points > 1 ? 30 : 18);
  popup(`+${points}`, star.x, star.y - 10, star.tint);
  removeFrom(stars, star);
}

const hits = (ax, ay, ar, bx, by, br) => (ax - bx) ** 2 + (ay - by) ** 2 < (ar + br) ** 2;

// ---------------------------------------------------------------------------
// CONCEPT 11 — Events (input)
// Pixi's event system works like the DOM: pointer events cover mouse, touch
// and pen. An object only receives events if its eventMode is 'static' (or
// 'dynamic'). The stage has no size of its own, so we give it a hitArea equal
// to the screen to receive pointermove everywhere.
// Keyboard input isn't Pixi's job — use normal window listeners.
// ---------------------------------------------------------------------------
app.stage.eventMode = 'static';
app.stage.hitArea = app.screen;
app.stage.on('pointermove', (e) => {
  targetX = e.global.x; // e.global = pointer position in screen/stage space
});

const normKey = (e) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
window.addEventListener('keydown', (e) => {
  const key = normKey(e);
  keys.add(key);
  if (key === 'p' || key === 'Escape') state === 'play' ? pause() : resume();
  if ((key === ' ' || key === 'Enter') && menu.visible) onMenuAction();
});
window.addEventListener('keyup', (e) => keys.delete(normKey(e)));
document.addEventListener('visibilitychange', () => document.hidden && pause()); // auto-pause on tab switch

// ---------------------------------------------------------------------------
// CONCEPT 14 — The Ticker (game loop)
// app.ticker calls our function once per frame, before rendering.
// ticker.deltaTime ≈ 1 at 60 fps, ≈ 0.5 at 120 fps, ≈ 2 at 30 fps.
// Multiply every movement by it so speed is the same on every screen.
// ticker.deltaMS gives real milliseconds — handy for timers.
// ---------------------------------------------------------------------------
app.ticker.add((ticker) => {
  const dt = ticker.deltaTime;
  const seconds = ticker.deltaMS / 1000;

  // Background scrolls in every state except pause
  if (state !== 'paused') {
    const speedUp = state === 'play' ? 1 + game.elapsed / 40 : 1;
    farStars.tilePosition.y += 0.6 * dt * speedUp;
    nearStars.tilePosition.y += 1.8 * dt * speedUp;
  }

  if (menu.visible) {
    titleText.scale.set(1 + Math.sin(performance.now() / 300) * 0.03); // gentle pulse
  }

  if (state === 'paused') return; // freeze the world

  updateShip(dt);
  updateParticles(dt);
  updatePopups(dt);

  if (state !== 'play') return;

  // Difficulty ramps up over time
  game.elapsed += seconds;
  const difficulty = 1 + game.elapsed / 25;

  game.starTimer -= seconds;
  if (game.starTimer <= 0) {
    spawnStar();
    game.starTimer = 0.9 / Math.sqrt(difficulty);
  }
  game.meteorTimer -= seconds;
  if (game.meteorTimer <= 0) {
    spawnMeteor(difficulty);
    game.meteorTimer = 1.6 / difficulty + rand(0, 0.5);
  }

  game.heartTimer -= seconds;
  if (game.heartTimer <= 0) {
    if (game.energy < 100) spawnHeart(); // only when you actually need it
    game.heartTimer = rand(8, 12);
  }

  updateStars(dt);
  updateMeteors(dt);
  updateHearts(dt);

  // Energy bar: scale the MASK, not the bar (CONCEPT 10)
  barMask.scale.x = clamp(game.energy / 100, 0, 1);
  if (game.energy <= 0) gameOver();
});

function updateShip(dt) {
  const keySpeed = 12;
  if (keys.has('ArrowLeft') || keys.has('a')) targetX -= keySpeed * dt;
  if (keys.has('ArrowRight') || keys.has('d')) targetX += keySpeed * dt;
  targetX = clamp(targetX, 40, app.screen.width - 40);

  // Ease toward the target, and tilt in the direction of travel
  const dx = targetX - ship.x;
  ship.x += dx * Math.min(1, 0.15 * dt);
  ship.rotation = clamp(dx * 0.004, -0.4, 0.4);

  // Spin the orbit container — the orb child follows (CONCEPT 8)
  orbit.rotation += 0.06 * dt;

  // Tint flash when hit
  if (game.hitFlash > 0) {
    game.hitFlash -= dt;
    shipBody.tint = Math.floor(game.hitFlash / 3) % 2 ? 0xff4d6d : 0xffffff;
  } else {
    shipBody.tint = 0xffffff;
  }

  // Screen shake: jiggle the whole world container
  world.position.set(rand(-1, 1) * game.shake, rand(-1, 1) * game.shake);
  game.shake *= 0.88;
}

function updateStars(dt) {
  for (let i = stars.length - 1; i >= 0; i--) {
    const star = stars[i];
    star.y += star.vy * dt;
    star.rotation += star.spin * dt;
    if (hits(star.x, star.y, 18, ship.x, ship.y, 32 * ship.scale.x)) {
      collectStar(star, 1);
    } else if (star.y > app.screen.height + 40) {
      removeFrom(stars, star);
    }
  }
}

function updateMeteors(dt) {
  const orbPos = orbPositionInWorld();
  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i];
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    m.rotation += m.spin * dt;

    if (hits(m.x, m.y, m.radius, orbPos.x, orbPos.y, 14 * ship.scale.x)) {
      burst(m.x, m.y, 0xffa94d, 26);
      popup('SMASH +1', m.x, m.y, 0xffa94d);
      setScore(game.score + 1);
      removeFrom(meteors, m);
    } else if (hits(m.x, m.y, m.radius, ship.x, ship.y, 26 * ship.scale.x)) {
      game.energy -= 25;
      game.shake = 14;
      game.hitFlash = 24;
      burst(m.x, m.y, 0xff4d6d, 30);
      removeFrom(meteors, m);
    } else if (m.y > app.screen.height + 60) {
      removeFrom(meteors, m);
    }
  }
}

function updateHearts(dt) {
  for (let i = hearts.length - 1; i >= 0; i--) {
    const h = hearts[i];
    h.y += h.vy * dt;
    h.age += dt;
    h.scale.set(1 + Math.sin(h.age * 0.15) * 0.12); // heartbeat pulse
    if (hits(h.x, h.y, 16, ship.x, ship.y, 32 * ship.scale.x)) {
      game.energy = Math.min(100, game.energy + 25);
      burst(h.x, h.y, HEART_COLOR, 24);
      popup('+25 ENERGY', h.x, h.y - 10, 0xff8fa3);
      removeFrom(hearts, h);
    } else if (h.y > app.screen.height + 40) {
      removeFrom(hearts, h);
    }
  }
}

function updatePopups(dt) {
  for (let i = popups.length - 1; i >= 0; i--) {
    const t = popups[i];
    t.y -= 1.2 * dt;
    t.alpha -= 0.02 * dt;
    if (t.alpha <= 0) removeFrom(popups, t);
  }
}

// ---------------------------------------------------------------------------
// CONCEPT 15 — Resize / layout
// With `resizeTo: window`, the renderer resizes itself and emits 'resize'.
// app.screen always holds the current size; we re-position things from it.
// ---------------------------------------------------------------------------
function layout() {
  const { width, height } = app.screen;
  farStars.width = nearStars.width = width;
  farStars.height = nearStars.height = height;
  ship.y = height - 110;
  // ParticleContainer skips bounds math for speed, so tell it its area
  // (otherwise filters applied to `world` could clip the particles).
  particles.boundsArea = new Rectangle(0, 0, width, height);
  menu.position.set(width / 2, height / 2);
  dim.clear().rect(-width / 2, -height / 2, width, height).fill({ color: 0x000000, alpha: 0.35 });
  const fit = Math.min(1, width / 700); // shrink the overlay on phones
  menu.scale.set(fit);
  dim.scale.set(1 / fit);               // …but keep the dim layer full-screen
}
app.renderer.on('resize', layout);
layout();

ship.x = targetX;
showMenu('menu');
