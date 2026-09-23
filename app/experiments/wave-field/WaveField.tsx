"use client";

import { useRef } from "react";
import { useCanvasLoop } from "../_lib/useCanvasLoop";
import { useResizeObserver } from "../_lib/useResizeObserver";
import { makeNoise3D, mulberry32 } from "../_lib/noise";

export type RenderMode = "glyphs" | "dots";
export type RampMode = "gradient" | "mixed";

export const GRADIENT_RAMP = " .:-=+*#%@";
export const MIXED_RAMP = " ..,,:;-=+*^!?<>()/\\%#&$@01789XM";
export interface WaveFieldParams {
  bandCount: number;
  frequencyMul: number;
  speedMul: number;
  bandWidth: number;
  noiseAmount: number;
  noiseScale: number;
  cellSize: number;
  rampMode: RampMode;
  flickerRate: number;
  color: [number, number, number];

  // How widely each band's propagation direction can deviate from horizontal, in radians. 0 = old behaviour (pure horizontal bands).
  // Something like 0.4-0.9 gives crossing, angled crests.
  angleSpread?: number;

  // 0 = pure plane waves (directional bands only). 1 = pure point source (circular ripples from a single origin).
  // Values in between blend a "stone dropped in water" ripple in with the directional swell, which is what breaks up periodicity the most
  pointSourceMix?: number;

  // 0 = off (old behaviour: steady, unmodulated bands). >0 = each band's amplitude is modulated by a slow-moving envelope
  // travelling at the group velocity, so distinct wave PACKETS visibly form, travel, and disperse instead of a stationary-looking pattern.
  // 0.4-0.8 is a good range; higher values make packets narrower/more pronounced.

  groupiness?: number;

  // 0 = off (old behaviour: uniform "deep water" everywhere, no bending). >0 = enables a depth field and lets waves refract/shoal as they move
  // into "shallower" regions - wavelength shrinks, amplitude grows, and wavefronts bend to travel more perpendicular to depth contours,
  // exactly like real waves turning to arrive parallel to a shoreline. 0.5-1 is a good range to see the bending clearly.
  shoaling?: number;

  // 0 = flat, unlit brightness (old behaviour: brightness purely from distance-to-crest via the falloff curve).
  // >0 = blends in normal-based lighting, where the local slope of the wave surface (computed analytically from the same sine sum, treated
  // as a height field) is lit from a fixed "sun" direction. Crests facing the light get bright specular-like highlights, faces turned away go
  // darker - reads as an actually-lit surface instead of a brightness map. 0.5-0.8 blends nicely with the falloff shape; 1 is fully
  // lighting-driven.
  shading?: number;
}

interface WaveFieldProps {
  renderMode: RenderMode;
  params: WaveFieldParams;
}

// Fixed internal seed - the field always looks like "the same piece", no
// seed picking exposed to the person using the controls.
const FIELD_SEED = 1337;

// Wave band definitions:
// Each band is now a genuine 2D travelling plane wave: it has a wave VECTOR (kx, ky), not just a scalar frequency along x. The direction of
// that vector is randomised within +/- angleSpread of horizontal, so bands cross each other at shallow angles instead of only ever sliding past
// each other in parallel. That crossing is what produces real interference texture (moire-like beats where crests reinforce or cancel) rather than
// the old "sum of parallel sines" look, which can only ever produce crests that move together.
//
// Each band's angular frequency (omega, i.e. "speed") is derived from its wavenumber via a FULL (not just deep-water) gravity-wave dispersion
// relation - omega^2 = g * k * tanh(k * h)
// where h is local water depth. In the deep-water limit (k*h large, tanh -> 1) this reduces to the familiar omega = sqrt(g*k) used before.
// But now h is a per-PIXEL depth field rather than a constant, so as a wave travels into shallower water its wavenumber must increase to keep
// omega constant along its path (a travelling wave's frequency is fixed by its source; only its wavelength/speed change with depth) - this is
// shoaling. Because the phase speed becomes direction-dependent on depth gradients, wavefronts also bend (refract) to travel more perpendicular
// to depth contours - the classic reason real ocean waves always arrive at a beach roughly parallel to the shoreline regardless of their
// original direction out at sea.

interface WaveBand {
  amplitude: number;

  // Wave vector components, already including the frequency multiplier's effect on wavenumber magnitude (frequencyMul scales k, not omega -
  // omega is then re-derived from k so dispersion stays physical)
  kx: number;
  ky: number;

  // Angular frequency from the dispersion relation, before speedMul. This  is the band's fixed "source frequency" - held constant as depth
  // varies, which is what drives shoaling (k must change with depth to  keep this constant along the wave's path)
  omega: number;
  phase: number;

  // Group velocity magnitude, dOmega/dk, along this band's own direction. For omega = sqrt(g*k), group velocity = 0.5 * phase velocity, which
  // is the textbook deep-water-wave result (wave groups travel at half the speed of the individual crests inside them). Stored as a vector
  // (same direction as k) so the envelope can travel along the band's own propagation axis
  vgx: number;
  vgy: number;

  // Per-band random offset so envelope peaks don't all line up and look synchronised - each band's packets form/disperse out of phase with
  // the others
  envelopeOffset: number;
}

// Gravity constant for the dispersion relation. This is a stylised value tuned for on-screen motion, not literal m/s^2 - what matters is that
// omega grows with sqrt(k) in deep water and the finite-depth correction below has the right qualitative shape.
const GRAVITY = 340;

function makeBands(
  count: number,
  angleSpread: number,
  rand: () => number,
): WaveBand[] {
  const bands: WaveBand[] = [];
  for (let i = 0; i < count; i++) {
    // Base wavenumber magnitude per band - same progression as the old per-band frequency stagger, so bandCount still reads the same way.
    // This is each band's DEEP-water wavenumber; shoaling adjusts the effective k per-pixel from this baseline.
    const kMag = (0.9 + i * 0.35 + rand() * 0.25) * 0.01;

    // Direction: mostly horizontal (angle ~ 0), spread +/- angleSpread. Using (rand()*2-1) rather than a uniform draw over the full range
    // keeps the distribution symmetric around straight-across travel, which reads as "wind-driven swell" rather than waves coming from
    // random directions.
    const angle = (rand() * 2 - 1) * angleSpread;

    const kx = kMag * Math.cos(angle);
    const ky = kMag * Math.sin(angle);

    // Dispersion (deep-water reference value, used as the band's fixed source frequency): omega = sqrt(g * |k|).
    const omega = Math.sqrt(GRAVITY * kMag);

    // Group velocity magnitude along the band's own propagation axis. For deep-water waves, group velocity = 0.5 * phase velocity,
    // which is the textbook result. This is used to advect the amplitude envelope along the band's own axis so distinct wave packets form and travel
    // instead of a stationary-looking pattern.
    const groupSpeed = 0.5 * (omega / kMag);
    const vgx = groupSpeed * Math.cos(angle);
    const vgy = groupSpeed * Math.sin(angle);

    bands.push({
      amplitude: (0.55 + rand() * 0.35) * (1 + 0.15 * (count - i)),
      kx,
      ky,
      omega,
      phase: rand() * Math.PI * 2,
      vgx,
      vgy,
      envelopeOffset: rand() * 1000,
    });
  }
  return bands;
}

// Power-curve falloff: stays close to full brightness through most of the band, then drops off sharply near the edge. This reads as a solid,
// dense wave shape with a defined boundary - matching the reference images/video - rather than a soft gradient glow spreading outward.
const FALLOFF_SHARPNESS = 3.5;
function falloff(dist: number, bandWidth: number): number {
  const x = Math.min(1, Math.abs(dist) / bandWidth);
  const s = 1 - Math.pow(x, FALLOFF_SHARPNESS);
  return Math.max(0, s);
}

// FBM (fractional Brownian motion) + domain warping:
// § 3D FBM is used to generate the "mottling" noise that makes the wave bands look like a real water surface
// rather than a mathematically perfect sine sum. The FBM is also used to generate a slow, large-scale depth field
// for shoaling/refraction, and the first pass of the FBM is used to warp the coordinates of the second pass so the
// mottling pattern itself has a subtle advected-flow feel rather than being a static texture.

function fbm3(
  noise: (x: number, y: number, z: number) => number,
  x: number,
  y: number,
  z: number,
  octaves: number,
): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x * freq, y * freq, z * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

function warpedFbm3(
  noise: (x: number, y: number, z: number) => number,
  x: number,
  y: number,
  z: number,
): number {
  // First pass: cheap 2-octave fbm used purely to displace the coordinates of the second pass. Small warp strength (2.0) keeps it a subtle
  // advected-flow feel rather than dissolving the wave shape entirely.
  const warpX = fbm3(noise, x + 5.2, y + 1.3, z, 2);
  const warpY = fbm3(noise, x + 8.1, y + 3.7, z, 2);
  return fbm3(noise, x + warpX * 2.0, y + warpY * 2.0, z, 3);
}

// Depth field (for shoaling/refraction):
// A stylised static "seabed": deep in the middle of the canvas, shoaling (getting shallower) toward top/bottom edges, plus a slow smooth noise
// perturbation so the depth contours aren't perfectly straight (so refraction bending isn't perfectly uniform either - real coastlines and
// seabeds aren't straight lines). Returns depth in the same abstract units as GRAVITY/kMag are tuned in; only relative variation matters; the
// tanh() in dispersion() naturally clamps how much any of this can affect waves once k*h is reasonably large ("deep enough").

function depthAt(
  noise: (x: number, y: number, z: number) => number,
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  // Normalised distance from the vertical centre, 0 at centre -> 1 at top/bottom edge. Squared falloff keeps the middle of the field
  // uniformly "deep" (matching the existing baseline-centred wave shape) and only shoals noticeably near the edges.
  const ny = Math.abs(y - height * 0.5) / (height * 0.5);
  const edgeShoal = Math.pow(ny, 2.2);

  // Gentle large-scale noise perturbation on the depth contour itself so it reads as an irregular seabed rather than a mathematically perfect
  // band. Sampled at a much lower frequency than the wave-mottling noise
  const contourNoise = noise(x * 0.0012, y * 0.0012, 0) * 0.35;

  // Base depth of 1 (arbitrary units) in "deep water", shoaling down to ~0.08 near the edges - shallow enough for tanh(k*h) to depart
  // noticeably from 1 given the kMag values used above, but never zero (avoids divide-by-zero / degenerate math at the very edge)
  const depth = 1 - edgeShoal * 0.92 + contourNoise * (1 - edgeShoal);
  return Math.max(0.06, depth);
}

// Full finite-depth dispersion relation: omega^2 = g*k*tanh(k*h). Given a fixed omega (each band's constant source frequency) and a local depth h,
// solve for the local wavenumber k. There's no closed-form inverse, so this uses a handful of Newton iterations starting from the deep-water guess
// k0 = omega^2/g, which converges in ~3-4 steps for the depth/frequency ranges used here - cheap enough to call per-pixel per-band
function solveShoaledK(omega: number, depth: number): number {
  const target = omega * omega;
  let k = target / GRAVITY;
  for (let iter = 0; iter < 4; iter++) {
    const kh = k * depth;
    const t = Math.tanh(kh);
    const f = GRAVITY * k * t - target;
    // d/dk [g*k*tanh(k*h)] = g*tanh(kh) + g*k*h*sech^2(kh)
    const sech2 = 1 - t * t;
    const df = GRAVITY * t + GRAVITY * k * depth * sech2;
    if (Math.abs(df) < 1e-9) break;
    k -= f / df;
    if (k < 1e-6) k = 1e-6;
  }
  return k;
}

function pickChar(
  ramp: string,
  brightness: number,
  rand: () => number,
): string {
  if (ramp === GRADIENT_RAMP) {
    const idx = Math.min(ramp.length - 1, Math.floor(brightness * ramp.length));
    return ramp[idx];
  }

  // mixed ramp: bias toward denser glyphs as brightness rises, but keep it noisy/jumbled rather than a clean gradient lookup - this is what gives
  // the reference its "static-like" varied character texture.
  const bias = Math.floor(brightness * (MIXED_RAMP.length - 1));
  const jitter = Math.floor((rand() - 0.5) * 6);
  const idx = Math.max(0, Math.min(MIXED_RAMP.length - 1, bias + jitter));
  return MIXED_RAMP[idx];
}

// WaveField component - draws the wave field to a canvas, using the given render mode and parameters.
// The canvas is automatically resized to fill its container, and the wave field is animated in a loop.
export default function WaveField({ renderMode, params }: WaveFieldProps) {
  const canvasRef = useCanvasLoop((ctx, dt, t) => draw(ctx, t));

  const propsRef = useRef({ renderMode, params });
  propsRef.current = { renderMode, params };

  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });
  useResizeObserver(canvasRef, (width, height, dpr) => {
    sizeRef.current = { width, height, dpr };
  });

  const engineRef = useRef<{
    bands: WaveBand[];
    noise: ReturnType<typeof makeNoise3D>;
    depthNoise: ReturnType<typeof makeNoise3D>;
    rand: () => number;
    bandCount: number;
    angleSpread: number;
  } | null>(null);

  function ensureEngine() {
    const { params: p } = propsRef.current;
    const angleSpread = p.angleSpread ?? 0.5;
    if (
      !engineRef.current ||
      engineRef.current.bandCount !== p.bandCount ||
      engineRef.current.angleSpread !== angleSpread
    ) {
      const rand = mulberry32(FIELD_SEED);
      engineRef.current = {
        bands: makeBands(p.bandCount, angleSpread, rand),
        noise: makeNoise3D(mulberry32(FIELD_SEED + 1)),
        depthNoise: makeNoise3D(mulberry32(FIELD_SEED + 2)),
        rand,
        bandCount: p.bandCount,
        angleSpread,
      };
    }
    return engineRef.current;
  }

  // Per-cell glyph assignment cache, keyed by cell index, re-rolled on a slow interval independent of wave motion (the flicker effect).
  const glyphCacheRef = useRef<{
    cols: number;
    rows: number;
    chars: string[];
    nextReroll: Float32Array;
  } | null>(null);

  function ensureGlyphCache(cols: number, rows: number) {
    const cache = glyphCacheRef.current;
    if (!cache || cache.cols !== cols || cache.rows !== rows) {
      const n = cols * rows;
      glyphCacheRef.current = {
        cols,
        rows,
        chars: new Array<string>(n).fill(" "),
        nextReroll: new Float32Array(n).fill(0),
      };
    }
    return glyphCacheRef.current!;
  }

  function draw(ctx: CanvasRenderingContext2D, t: number) {
    const { width, height, dpr } = sizeRef.current;
    if (width === 0 || height === 0) return;
    const { renderMode: mode, params: p } = propsRef.current;
    const engine = ensureEngine();

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);

    const [r, g, b] = p.color;

    const baseline = height * 0.5;
    const ampScale = height * 0.22;
    const bandWidthPx = ampScale * p.bandWidth;
    const pointMix = Math.max(0, Math.min(1, p.pointSourceMix ?? 0));
    const shoaling = Math.max(0, p.shoaling ?? 0);
    const shading = Math.max(0, Math.min(1, p.shading ?? 0));
    const groupiness = p.groupiness ?? 0;

    // Point source origin: centre of the field, so ripples expand symmetrically outward - the classic "stone dropped in water" case.
    // Its wavenumber magnitude/omega are derived the same way as the plane-wave bands (using the first band's k as a representative
    // scale) so it stays visually consistent with the swell when blended.
    const psK =
      engine.bands.length > 0
        ? Math.hypot(engine.bands[0].kx, engine.bands[0].ky)
        : 0.009;
    const psOmega = Math.sqrt(GRAVITY * psK);
    const originX = width * 0.5;
    const originY = height * 0.5;

    // Evaluates the raw wave sum (before noise mottling) at a point, reused both for the brightness field itself and for the finite-
    // difference slope estimate used by normal-based shading, so the two stay perfectly consistent with each other.
    function waveHeight(x: number, y: number): number {
      let wave = 0;

      if (pointMix < 1) {
        for (const band of engine.bands) {
          let kx = band.kx * p.frequencyMul;
          let ky = band.ky * p.frequencyMul;
          let omega = band.omega * Math.sqrt(p.frequencyMul) * p.speedMul;
          let amp = band.amplitude;

          if (shoaling > 0) {
            // Local depth under this pixel; blended toward "always deep" (depth = 1, i.e. no shoaling effect at all) as `shoaling`
            // approaches 0, so the parameter smoothly fades the whole effect rather than being a hard on/off switch.
            const rawDepth = depthAt(engine.depthNoise, x, y, width, height);
            const depth = rawDepth * shoaling + 1 * (1 - shoaling);

            // Shoaling: as depth decreases, the local wavenumber must increase to keep the band's source frequency constant (omega is fixed
            // by the source, only k changes with depth). Solve the finite-depth dispersion relation for the local k magnitude, then scale the wave vector to that magnitude.
            const kMagDeep = Math.hypot(band.kx, band.ky) * p.frequencyMul;
            const kMagShoaled = solveShoaledK(omega, depth);
            const kScale = kMagShoaled / Math.max(1e-6, kMagDeep);

            // Refraction: bending the wave vector's DIRECTION, not just its magnitude. Real refraction bends wavefronts toward the
            // direction of decreasing depth gradient (waves turn to travel more perpendicular to depth contours). Here we
            // estimate the local depth gradient with a small finite difference and rotate the wave vector a small amount
            // toward -gradient(depth), scaled by how much shoaling has sped up (kScale > 1 = shallower = more bending).
            const eps = 2;
            const dDepthDx =
              (depthAt(engine.depthNoise, x + eps, y, width, height) -
                depthAt(engine.depthNoise, x - eps, y, width, height)) /
              (2 * eps);
            const dDepthDy =
              (depthAt(engine.depthNoise, x, y + eps, width, height) -
                depthAt(engine.depthNoise, x, y - eps, width, height)) /
              (2 * eps);
            const gradMag = Math.hypot(dDepthDx, dDepthDy);
            if (gradMag > 1e-6) {
              const towardShallowX = -dDepthDx / gradMag;
              const towardShallowY = -dDepthDy / gradMag;
              const bendAmount = Math.min(0.6, (kScale - 1) * 0.8) * shoaling;
              const kMagNow = Math.hypot(kx, ky) || 1;
              const dirX = kx / kMagNow;
              const dirY = ky / kMagNow;
              // Rotate the current direction a fraction of the way toward the "toward shallow" direction (simple vector lerp +
              // renormalise - a cheap stand-in for proper ray bending, good enough at this visual scale).
              const bentX =
                dirX * (1 - bendAmount) + towardShallowX * bendAmount;
              const bentY =
                dirY * (1 - bendAmount) + towardShallowY * bendAmount;
              const bentMag = Math.hypot(bentX, bentY) || 1;
              kx = (bentX / bentMag) * kMagShoaled;
              ky = (bentY / bentMag) * kMagShoaled;
            } else {
              kx = (kx / (Math.hypot(kx, ky) || 1)) * kMagShoaled;
              ky = (ky / (Math.hypot(kx, ky) || 1)) * kMagShoaled;
            }

            // Amplitude shoaling: energy flux is conserved, so as group speed drops in shallow water, amplitude must rise to
            // compensate (this is why waves visibly grow taller just before they break near a shore). Approximate with the
            // standard shoaling-coefficient shape, sqrt(deepGroupSpeed / localGroupSpeed), using dOmega/dk = g / (2*omega) *
            // (tanh(kh) + kh*sech^2(kh)) for local group speed
            const kh = kMagShoaled * depth;
            const th = Math.tanh(kh);
            const sech2 = 1 - th * th;
            const localGroupSpeed =
              (GRAVITY * (th + kh * sech2)) / (2 * omega || 1e-6);
            const deepGroupSpeed = 0.5 * (omega / Math.max(1e-6, kMagDeep));
            const shoalCoeff = Math.sqrt(
              Math.max(
                0.2,
                Math.min(3, deepGroupSpeed / Math.max(1e-6, localGroupSpeed)),
              ),
            );
            amp = amp * (shoalCoeff * shoaling + 1 * (1 - shoaling));
          }

          // Groupiness: amplitude modulation by a travelling envelope along the band's own propagation axis, so distinct wave PACKETS form and
          // travel instead of a stationary-looking pattern. Envelope is sin^1.5() to keep it smooth but still have a defined peak.
          if (groupiness > 0) {
            const vgx = band.vgx * Math.sqrt(p.frequencyMul) * p.speedMul;
            const vgy = band.vgy * Math.sqrt(p.frequencyMul) * p.speedMul;
            const vgMag = Math.hypot(vgx, vgy) || 1;
            const dirX = vgx / vgMag;
            const dirY = vgy / vgMag;
            const alongAxis = x * dirX + y * dirY;
            const kMagNow = Math.hypot(kx, ky) || 1;
            const envelopeK = kMagNow / 6;
            const envelopePhase =
              envelopeK * alongAxis -
              envelopeK * vgMag * t +
              band.envelopeOffset;
            const envelope = Math.pow(0.5 + 0.5 * Math.sin(envelopePhase), 1.5);
            amp = amp * (1 - groupiness + groupiness * envelope);
          }

          wave += amp * Math.sin(kx * x + ky * y + omega * t + band.phase);
        }
      }

      if (pointMix > 0) {
        const dx = x - originX;
        const dy = y - originY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const k = psK * p.frequencyMul;
        const omega = psOmega * Math.sqrt(p.frequencyMul) * p.speedMul;
        const decay = 1 / Math.sqrt(1 + dist * 0.01);
        const pointWave = 0.9 * decay * Math.sin(k * dist - omega * t);
        wave = wave * (1 - pointMix) + pointWave * pointMix * 1.6;
      }

      return wave;
    }

    function fieldBrightness(x: number, y: number): number {
      const wave = waveHeight(x, y);
      const crestY = baseline + wave * ampScale;

      const noiseSpaceScale = 0.0025 * p.noiseScale;
      const n = warpedFbm3(
        engine.noise,
        x * noiseSpaceScale,
        y * noiseSpaceScale,
        t * 0.08,
      );

      const d = y - crestY - n * bandWidthPx * p.noiseAmount;
      let bright = falloff(d, bandWidthPx);

      if (shading > 0 && bright > 0.01) {
        const eps = 2;
        const hL = waveHeight(x - eps, y) * ampScale;
        const hR = waveHeight(x + eps, y) * ampScale;
        const hU = waveHeight(x, y - eps) * ampScale;
        const hD = waveHeight(x, y + eps) * ampScale;
        const slopeX = (hR - hL) / (2 * eps);
        const slopeY = (hD - hU) / (2 * eps);

        const nx = -slopeX;
        const ny = -slopeY;
        const nz = 1;
        const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;

        const lx = -0.5;
        const ly = -0.35;
        const lz = 0.79;
        const lLen = Math.sqrt(lx * lx + ly * ly + lz * lz);

        const dot = (nx * lx + ny * ly + nz * lz) / (nLen * lLen);

        const diffuse = Math.max(0, dot);
        const specular = Math.pow(diffuse, 12);
        const lit = diffuse * 0.75 + specular * 0.9;

        bright =
          bright * (1 - shading) + bright * Math.min(1.4, lit + 0.15) * shading;
        bright = Math.max(0, Math.min(1, bright));
      }

      return bright;
    }

    if (mode === "dots") {
      const spacing = Math.max(4, p.cellSize) * dpr;
      const cols = Math.ceil(width / spacing) + 1;
      const rows = Math.ceil(height / spacing) + 1;

      for (let j = 0; j < rows; j++) {
        const y = j * spacing;
        for (let i = 0; i < cols; i++) {
          const x = i * spacing;
          const brightness = fieldBrightness(x, y);
          if (brightness < 0.02) continue;
          const radius = 0.6 + brightness * (spacing * 0.35);
          ctx.beginPath();
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${brightness})`;
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      const cellPx = Math.max(6, p.cellSize) * dpr;
      const cols = Math.ceil(width / cellPx) + 1;
      const rows = Math.ceil(height / cellPx) + 1;
      const cache = ensureGlyphCache(cols, rows);
      const ramp = p.rampMode === "gradient" ? GRADIENT_RAMP : MIXED_RAMP;

      ctx.font = `${cellPx * 0.85}px "JetBrains Mono", monospace`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";

      for (let j = 0; j < rows; j++) {
        const y = j * cellPx + cellPx * 0.5;
        for (let i = 0; i < cols; i++) {
          const x = i * cellPx + cellPx * 0.5;
          const brightness = fieldBrightness(x, y);
          if (brightness < 0.04) continue;

          const idx = j * cols + i;
          if (p.flickerRate > 0 && t >= cache.nextReroll[idx]) {
            cache.chars[idx] = pickChar(ramp, brightness, engine.rand);
            cache.nextReroll[idx] =
              t + (0.2 + engine.rand() * 1.2) / Math.max(0.001, p.flickerRate);
          } else if (!cache.chars[idx] || cache.chars[idx] === " ") {
            cache.chars[idx] = pickChar(ramp, brightness, engine.rand);
          }

          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${brightness})`;
          ctx.fillText(cache.chars[idx], x, y);
        }
      }
    }
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
