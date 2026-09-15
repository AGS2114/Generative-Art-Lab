# Generative Art Lab

A growing collection of generative art & creative-coding experiments, built
with Next.js and Canvas/SVG - no external animation frameworks, just pixels
and math.

Each sketch lives under `/experiments/<slug>` and shares a small common
scaffold (`app/experiments/_lib/`) for the animation loop, canvas resizing,
noise, and control panels, so new sketches can focus on the interesting part
rather than rebuilding plumbing each time.

## Getting started

```bash
npm install
npm run dev
```

Then visit `http://localhost:3000` for the landing screen, or
`http://localhost:3000/experiments` for the full index.

## Shared scaffold (`app/experiments/_lib/`)

| File                   | Purpose                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `useCanvasLoop.ts`     | rAF animation loop hook with clamped delta-time, so a backgrounded tab or dropped frame never causes a visible pop/jump |
| `useResizeObserver.ts` | Keeps a canvas's backing-store size in sync with its CSS size and device pixel ratio                                    |
| `noise.ts`             | Re-export of `simplex-noise` plus a `mulberry32` seeded PRNG for reproducible/shareable seeds                           |
| `ControlPanel.tsx`     | Generic slider/toggle/select panel so sketches can declare their controls instead of rebuilding panel chrome            |

## Original spec

The project started from a single brief covering seven areas of generative
art and creative coding:

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
> **1.6 Mycelium / Space Colonization** - Branching growth algorithm:
> scattered attraction points pull nearby branch nodes toward them, new
> nodes spawn along the accumulated direction, and consumed attraction
> points are removed, producing an organic branching structure over time.
>
> **1.7 Procedural Flower Growth (L-system)** - A classic L-system engine
> (string rewriting + turtle-graphics drawing) with progressive growth
> animation (revealing the string character-by-character) and a bloom
> particle effect once growth completes.

## Progress checklist

- [x] **Shared scaffold** - `useCanvasLoop`, `useResizeObserver`, `noise.ts`, `ControlPanel`
- [x] **1.3(a) - Ripple / Interference** - single-source colour interference ripples, 5 gradient presets (sunset, aegean, dusk, citrus, ice)
- [x] **1.3(a) - Ripple / Interference (multi-source)** - multiple summed ripple sources producing braided rings, lattice moiré, and caustic cusps; live controls for source count, frequency, speed, ripple strength, caustic brightness, and grain; all 8 palettes (adds coral, pastel, flame)
- [x] **1.3(a) - Ripple / Interference (WebGL shader)** - raw WebGL2 fragment-shader rewrite of the multi-source ripple field: per-pixel `sin(dist * frequency - t * speed)` summed across up to 8 sources, coloured via an Inigo Quilez cosine palette (`a + b*cos(2π(c*t+d))`) instead of gradient stops, so hues wash continuously rather than stepping between fixed stops; same caustic/grain/vignette finishing pass as the CPU version, but evaluated at full resolution every frame since each pixel is independent on the GPU; own route with sliders for source position/frequency/speed/amplitude, ripple strength, and palette; reimplements the shared scaffold's dt-clamp locally since this sketch drives a WebGL2 context rather than the 2D context `useCanvasLoop` expects
- [ ] **1.3(b) - Reaction-diffusion** - Gray-Scott organic growth variant
- [ ] **1.1 - ASCII Art Suite** - image-to-ASCII converter + ASCII orb
- [ ] **1.2 - Generative Wave / Particle Field**
- [ ] **1.4 - Recursive Box/Grid Art**
- [ ] **1.5 - Radial print**
- [ ] **1.6 - Mycelium / Space Colonization**
- [ ] **1.7 - Procedural Flower Growth (L-system)**

## Experiments index

Visiting `/experiments` shows every sketch above with a READY/TODO status
badge - new sketches just need a route folder under `app/experiments/` and
an entry added to the list in `app/experiments/page.tsx`.

## Tech

- [Next.js](https://nextjs.org/) (App Router) + React + TypeScript
- Canvas 2D for pixel-level sketches, SVG for the radial piece
- [`simplex-noise`](https://www.npmjs.com/package/simplex-noise) for organic irregularity
- No animation or rendering framework beyond the above - everything is hand-rolled math and `requestAnimationFrame`
