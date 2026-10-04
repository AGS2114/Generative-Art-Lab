# Generative Art Lab

A growing collection of generative art & creative-coding experiments, built
with Next.js and Canvas/SVG - no external animation frameworks, just pixels
and math.

Each sketch lives under `/experiments/<slug>` and shares a common scaffold
(`app/experiments/_lib/`) for the animation loop, canvas resizing, noise,
control panels, the experiment registry, and a classic-Mac "desktop" shell
(menu bar, draggable windows, dialogs, wallpaper), so new sketches can focus
on the interesting part rather than rebuilding plumbing each time.

## Getting started

```bash
npm install
npm run dev
```

Then visit `http://localhost:3000` for the landing screen, or
`http://localhost:3000/experiments` for the full index.

## Shared scaffold (`app/experiments/_lib/`)

```
_lib/
├── useCanvasLoop.ts
├── useResizeObserver.ts
├── noise.ts
├── ControlPanel.tsx
├── experiments.ts
├── chrome.ts
├── Wallpaper.tsx
└── mac/
    ├── MenuBar.tsx
    ├── Window.tsx
    ├── Dialog.tsx
    └── icons.tsx
```

### Sketch plumbing

| File                   | Purpose                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `useCanvasLoop.ts`     | rAF animation loop hook with clamped delta-time, so a backgrounded tab or dropped frame never causes a visible pop/jump   |
| `useResizeObserver.ts` | Keeps a canvas's backing-store size in sync with its CSS size and device pixel ratio                                      |
| `noise.ts`             | Re-export of `simplex-noise` plus a `mulberry32` seeded PRNG for reproducible/shareable seeds                             |
| `ControlPanel.tsx`     | Shared control surface: sketches declare controls as data and get a draggable Mac-style window (see below)                |
| `experiments.ts`       | Single registry (`EXPERIMENTS`) of every sketch: `slug`, `name`, `status` (`done`/`todo`), `blurb`, optional `hideUi`     |
| `chrome.ts`            | Shared styling: `BACKDROP` (`var(--wp-base, #060b14)`), plus the `backLink` and `pill` style objects used by sketch pages |

**`ControlPanel`** supports six control types: `slider`, `toggle`, `select`, `color`, `buttonGroup`, and collapsible `group` (which can nest other controls, optionally `defaultOpen`). It renders inside `MacWindow`: drag the title bar, double-click it to roll the window up, and use the close box to hide it (a "Control Panel" button brings it back).

**`experiments.ts`** drives both the menu bar's Experiments menu (entries with `status: "todo"` are disabled) and the View → Hide UI item (enabled only when a sketch sets `hideUi: true`).

### Desktop shell (`_lib/mac/` + `Wallpaper.tsx`)

A System 7-style desktop that wraps the experiments.

| File              | Purpose                                                                                                                                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mac/MenuBar.tsx` | Top menu bar with Apple, File, Experiments, View and Special menus; live clock; click-away/Esc to close; `Esc` returns from a sketch to the index; View → Full Screen targets `.mac-stage main`; Special → CRT Scanlines (persisted in `localStorage`) |
| `mac/Window.tsx`  | `MacWindow`: draggable window with a title bar, close box, double-click "windowshade" and click-to-raise stacking                                                                                                                                      |
| `mac/Dialog.tsx`  | `MacDialog` modal alert (Enter = default button, Esc = close) and the `AboutContent` body for the About box                                                                                                                                            |
| `mac/icons.tsx`   | Line icons: the temple/ripple mark (`TempleMark`, aliased `RippleMark`), a per-sketch `ExperimentIcon` keyed by slug, plus `DiskIcon` and `TrashIcon`                                                                                                  |
| `Wallpaper.tsx`   | Animated desktop wallpaper: two blurred colour glows drifting over a tinted near-black base, with vignette and film grain; transform-only animation, so no canvas and no per-frame JS                                                                  |

**Wallpaper settings** (`WallpaperSettings`): `palette`, `custom` colours, `speed` (0 pauses), `intensity`, `size`, `softness`, `vignette` and `grain`. They're saved to `localStorage` (`wallpaper-settings`) with validation, falling back to defaults for anything missing or corrupt. Eight presets ship: **aegean** (default), **oxblood**, **limestone**, **rosewood**, **taupe**, **salty**, **peach**, **cyprus**.

**Matching the desktop from a sketch:** `applyWallpaperVars()` publishes the active palette as CSS variables on `<html>` (`--wp-base`, `--wp-a`, `--wp-b`). `MenuBar` calls it on mount, so any sketch can use `var(--wp-base)` (or `BACKDROP` from `chrome.ts`) and stay in step with the user's chosen wallpaper.

## Original spec

The project started from a single brief covering seven areas of generative
art and creative coding. One additional experiment (Sonic Field) was added
later, outside this original spec, and 1.2 (Wave Field) grew substantially
past its own original scope into a small wave-physics simulation - see the
progress checklist below.

> **1.1 ASCII Art Suite** - Image → ASCII converter (brightness-to-character
> mapping, adjustable grid resolution, colour mode, export) plus an ASCII
> orb: a fake-lit sphere rendered entirely in monospace characters, with
> simplex noise added on top of the lighting for a mottled, rotating surface.
>
> **1.2 Generative Wave / Particle Field** - A grid of points animated with
> `sin(x * frequency + t * speed)` plus a simplex-noise term for organic
> irregularity, with a distance-from-peak opacity falloff for a trailing
> crest look.
>
> **1.3 Ripple / Interference** - Two variants: (a) colour interference
> ripples, where concentric sine waves from one or more sources are summed
> and mapped to colour via a palette function, producing warped rings,
> braided patterns, and bright cusp/caustic streaks where waves reinforce;
> (b) Gray-Scott reaction-diffusion, simulating two virtual chemicals to
> produce organic spot/worm/maze patterns depending on feed/kill parameters.
> _(1.3(b) was later replaced with a wave-interference glyph field - see
> the progress checklist below.)_
>
> **1.4 Recursive Box/Grid Art** - Randomised recursive subdivision of a
> rectangle along its longer axis, with a registry of fill styles (solid,
> dots, hatch, rings) applied per leaf rectangle, and SVG export support.
>
> **1.5 Radial "Gift of Time" style piece** - An SVG piece built in layers:
> a background grid pattern, concentric dashed rings, a rotated "keyboard
> band" of alternating rects, and scattered markers constrained to an
> annulus - framed as a print, with a documented design process.
>
> **1.6 Mycelium / Space Colonisation** - Branching growth algorithm:
> scattered attraction points pull nearby branch nodes toward them, new
> nodes spawn along the accumulated direction, and consumed attraction
> points are removed, producing an organic branching structure over time.
>
> **1.7 Procedural Flower Growth (L-system)** - A classic L-system engine
> (string rewriting + turtle-graphics drawing) with progressive growth
> animation (revealing the string character-by-character) and a bloom
> particle effect once growth completes.

## Progress checklist

### At a glance

- [x] **Shared scaffold** - loop, resize, noise, controls, registry, desktop shell
- [ ] **1.1 ASCII Art Suite** - image-to-ASCII converter + ASCII orb
- [x] **1.2 Generative Wave / Particle Field** (`wave-field`)
- [x] **1.3(a) Ripple / Interference** - single source
- [x] **1.3(a) Ripple / Interference, multi-source** (`ripple-interference-multi`)
- [x] **1.3(a) Ripple / Interference, WebGL shader** (`ripple-interference-shader`)
- [x] **1.3(b) Glyph Field** (`glyph-field`) - replaced reaction-diffusion
- [x] **1.3(b) Sonic Field** (`sonic-field`) - new, outside the original spec
- [ ] **1.4 Recursive Box/Grid Art**
- [ ] **1.5 Radial print**
- [x] **1.6 Mycelium / Space Colonisation** (`mycelium`)
- [ ] **1.7 Procedural Flower Growth (L-system)**

### Details

#### Shared scaffold

`useCanvasLoop`, `useResizeObserver`, `noise.ts`, `ControlPanel`, `chrome.ts`, `experiments.ts`, `Wallpaper.tsx`, and the `mac/` folder (`Dialog.tsx`, `icons.tsx`, `MenuBar.tsx`, `Window.tsx`). See [Shared scaffold](#shared-scaffold-appexperiments_lib) above.

#### 1.2 Generative Wave / Particle Field

- **Core:** a grid of 2D travelling plane-wave bands. Not just parallel `sin(x*freq + t*speed)`: each band has its own wave vector within a controllable angle spread, so bands cross and produce genuine interference beats.
- **Texture:** simplex-noise mottling (domain-warped FBM, matching the ripple sketches' turbulence approach) and a distance-from-crest power-curve falloff for the trailing crest look the spec calls for.
- **Beyond the brief:**
  - **Dispersion:** a full finite-depth relation (`omega^2 = g*k*tanh(k*h)`) drives the bands.
  - **Shoaling / refraction:** a per-pixel depth field makes wavelength shrink and amplitude grow in "shallow" regions, and wavefronts bend to arrive parallel to depth contours.
  - **Wave packets:** a group-velocity envelope (`groupiness`) so packets visibly form, travel, and disperse at half the phase speed.
  - **Point source:** an optional circular term (`pointSourceMix`) summed with the plane waves for stone-dropped-in-water texture.
  - **Lighting:** analytic per-pixel `shading` using a finite-difference surface normal, lit with a Lambertian + Blinn-Phong-style specular term, so crests read as a lit surface rather than a flat brightness map.
- **Controls:** angle spread, point-source mix, groupiness, shoaling and shading are live sliders in a dedicated "Physics" group, alongside the two render modes (glyphs/dots), character ramps, flicker, and 5 palettes carried over from the wave-band control set.

#### 1.3(a) Ripple / Interference

| Variant       | What it adds                                                                                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Single source | Colour interference ripples; 5 gradient presets (sunset, aegean, dusk, citrus, ice)                                                                                                                          |
| Multi-source  | Summed sources produce braided rings, lattice moiré and caustic cusps. Live controls: source count, frequency, speed, ripple strength, caustic brightness, grain. All 8 palettes (adds coral, pastel, flame) |
| WebGL shader  | See below                                                                                                                                                                                                    |

**WebGL shader variant**

- Raw WebGL2 fragment-shader rewrite of the multi-source field: per-pixel `sin(dist * frequency - t * speed)` summed across up to 8 sources.
- Coloured with an Inigo Quilez cosine palette (`a + b*cos(2π(c*t+d))`) instead of gradient stops, so hues wash continuously rather than stepping between fixed stops.
- Same caustic/grain/vignette finishing pass as the CPU version, but evaluated at full resolution every frame since each pixel is independent on the GPU.
- Own route, with sliders for source position/frequency/speed/amplitude, ripple strength, and palette.
- Reimplements the scaffold's dt-clamp locally, since it drives a WebGL2 context rather than the 2D context `useCanvasLoop` expects.

#### 1.3(b) Glyph Field (replaced reaction-diffusion)

- The Gray-Scott implementation was built and worked, but its patterns were noticeably less compelling than a second experiment built alongside it. Glyph Field takes this slot and the Gray-Scott version was retired.
- **Sim:** 2D scalar wave equation on the GPU, using ping-pong framebuffers.
- **Render:** a live grid of glyphs whose shape/size respond to local wave amplitude.
- **Interaction:** pointer plucking, obstacle walls, and preset wall patterns (spiral, double-slit, rings, labyrinth).

#### 1.3(b) Sonic Field (new, outside the original spec)

- **Concept:** a second wave-interference field, driven by an original Web Audio synth instead of pointer input.
- **Generator:** a tempo/key/scale/mood picker feeds a generative sequencer. Chord progression, phrase-length rhythm cell and a chord-tone-aware melody walk are all derived from a single reproducible seed.
- **Voices:** lead, chord and bass each pluck the shared field via a `NoteEvent` queue.
- **Behaviour:**
  - Phrases evolve in density/loudness across repeats rather than looping identically.
  - A seed can be copied and reloaded to reproduce a specific passage.
  - Pointer plucks go into the same queue, so a user can play alongside the generator.
- **Render modes:** a glyph grid (reusing Glyph Field's approach) and a blurred soft-luminance field.
- **Colour:** a hue-shift/tint/glow palette system with named presets, and four glyph sets (geometric, rings, crosses, organic wobbled blobs). A hue channel is carried in the sim state itself, so colour tracks _which voice_ (lead, chord, bass or manual pluck) last rippled a point, not just how loud it is.

#### 1.6 Mycelium / Space Colonisation

Tuned to recreate a "microorganism spreading" reel rather than a plain branching tree.

- **Algorithm**
  - Attraction points are scattered on a jittered grid (random but without big holes); each votes for its nearest growing tip within `maxInfluenceDist`.
  - Tips step along the averaged pull, blended with heading inertia and a little wander.
  - Points within `killDist` of any new node are consumed.
  - Tips slide along the canvas walls instead of dying on them.
- **Beyond the plain algorithm**
  - Tips keep an even spacing: they fork sideways only into genuinely free space, and the later of two colliding tips retires.
  - Growth starts from pre-grown arcs of tips fanned out from two opposite corners (or four corners / centre / bottom).
  - Every node tracks how many tip lineages pass through it, which drives rope-like trunk thickening.
- **Rendering** (persistent + live layers)
  - A trail canvas accumulates staggered, gently wiggling dotted fibres behind each tip, plus beaded trunks.
  - Heads (soft round beads packed along the colony edge) are redrawn live each frame: a head stays at the front while it grows, lingers briefly as the front passes, and only a sparse few persist afterwards as lone beads.
  - All sizes are in reference pixels (a 720px-wide canvas), so the look is identical at any container size or device pixel ratio. Growth is delta-time based.
- **Runs**
  - Every load and regrow takes a fresh random seed, so each colony takes different paths.
  - Growth runs until the food is gone, until you press stop, or until a set share of the field is consumed.
  - Lives in a contained portrait stage (fullscreen applies to the stage); `Mycelium` is a self-contained component that fills its parent.
- **Controls**
  - Run: pause / stop-resume / reset defaults / regrow, seed layout, stop point.
  - Growth: speed, branching, tip and food spacing, influence/kill/step, inertia, wander, node budget.
  - "Look" group: head size, fibres per tip, spread, dot size, brightness, trunk thickness, lone heads, grain, 5 palettes.
- **Keyboard:** `Space` pause, `S` stop, `R` regrow, `H` hide UI, `F` fullscreen.
- **Files:** `engine.ts` (pure simulation), `renderer.ts` (canvas drawing), `Mycelium.tsx` (thin React wrapper).

#### Still to do

- **1.1 ASCII Art Suite:** image-to-ASCII converter + ASCII orb
- **1.4 Recursive Box/Grid Art**
- **1.5 Radial print**
- **1.7 Procedural Flower Growth (L-system)**

## Experiments index

Visiting `/experiments` shows every sketch above with a READY/TODO status
badge - new sketches just need a route folder under `app/experiments/` and
an entry added to `EXPERIMENTS` in `app/experiments/_lib/experiments.ts`
(which the menu bar reads too).

## Tech

- [Next.js](https://nextjs.org/) (App Router) + React + TypeScript
- Canvas 2D for pixel-level sketches, WebGL2 for shader sketches, Web Audio for Sonic Field, SVG for the radial piece and the desktop icons
- [`simplex-noise`](https://www.npmjs.com/package/simplex-noise) for organic irregularity
- No animation or rendering framework beyond the above - everything is hand-rolled math and `requestAnimationFrame`
