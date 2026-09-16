"use client";

import { useEffect, useRef } from "react";

export interface GradientStop {
  pos: number;
  color: [number, number, number];
}

export interface RippleSource {
  x: number;
  y: number;
  frequency: number;
  speed: number;
  amplitude: number;
}

/**
 * How each source's wave is shaped before summing.
 * - sine - plain sin() - smooth, symmetric rings (the original look)
 * - cosine - quarter-phase shift; rings land differently against the palette
 * - abs - |sin()| - rings only ever brighten, giving harder-edged bands
 * - squared - sin()^2 - similar to abs but with a softer trough and sharper crest
 * - decay - sin() attenuated by 1/(1 + dist*falloff) - waves fade with distance instead of staying full strength to the frame edge
 */
export type FieldMode = "sine" | "cosine" | "abs" | "squared" | "decay";

interface MultiRippleProps {
  stops?: GradientStop[];
  sources?: RippleSource[];
  rippleStrength?: number;
  driftSpeed?: number;
  causticStrength?: number;
  grainAmount?: number;
  fieldMode?: FieldMode;
  axisMix?: number;
  contrast?: number;
  causticColor?: [number, number, number];
  falloff?: number;
  timeScale?: number;
  vignette?: number;
}

const DEFAULT_STOPS: GradientStop[] = [
  { pos: 0.0, color: [12, 38, 46] },
  { pos: 0.16, color: [22, 82, 92] },
  { pos: 0.36, color: [214, 96, 68] },
  { pos: 0.5, color: [232, 158, 96] },
  { pos: 0.66, color: [186, 156, 78] },
  { pos: 0.84, color: [224, 198, 120] },
  { pos: 1.0, color: [46, 40, 20] },
];

const DEFAULT_SOURCES: RippleSource[] = [
  { x: 0.68, y: 0.22, frequency: 0.055, speed: 0.5, amplitude: 1 },
  { x: 0.28, y: 0.86, frequency: 0.048, speed: -0.4, amplitude: 0.85 },
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function sampleGradient(
  stops: GradientStop[],
  t: number,
): [number, number, number] {
  t = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (t >= a.pos && t <= b.pos) {
      const span = Math.max(b.pos - a.pos, 0.0001);
      const local = (t - a.pos) / span;
      const smooth = local * local * (3 - 2 * local);
      return [
        lerp(a.color[0], b.color[0], smooth),
        lerp(a.color[1], b.color[1], smooth),
        lerp(a.color[2], b.color[2], smooth),
      ];
    }
  }
  return stops[stops.length - 1].color;
}

/**
 * MultiRippleInterference: several concentric ripple sources summed together into one displacement field. Overlapping waves reinforce
 * or cancel, warping what would otherwise be perfectly circular rings into the bent/braided/lattice shapes you get from real wave
 * interference. A caustic pass brightens pixels where the summed field's local gradient is steepest (ring-compression zones), which
 * is what produces the bright cusp streaks and small lens-like ellipses. Grain and an optional vignette finish the frame.
 */
export default function MultiRippleInterference({
  stops = DEFAULT_STOPS,
  sources = DEFAULT_SOURCES,
  rippleStrength = 0.16,
  driftSpeed = 0.12,
  causticStrength = 0.5,
  grainAmount = 0.06,
  fieldMode = "sine",
  axisMix = 0,
  contrast = 1,
  causticColor = [255, 255, 255],
  falloff = 0.004,
  timeScale = 1,
  vignette = 0,
}: MultiRippleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const offscreen = document.createElement("canvas");
    const octx = offscreen.getContext("2d");
    if (!octx) return;

    let W = 0;
    let H = 0;
    let imgData: ImageData | null = null;
    let buf: Uint8ClampedArray | null = null;
    let rafId = 0;
    let cancelled = false;

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = canvas!.width = Math.max(1, Math.floor(rect.width * dpr));
      H = canvas!.height = Math.max(1, Math.floor(rect.height * dpr));
      offscreen.width = W;
      offscreen.height = H;
      imgData = octx!.createImageData(W, H);
      buf = imgData.data;
    }

    resize();
    window.addEventListener("resize", resize);

    let lastNow = performance.now();
    let elapsed = 0;

    function shape(phase: number, dist: number): number {
      switch (fieldMode) {
        case "cosine":
          return Math.cos(phase);
        case "abs":
          return Math.abs(Math.sin(phase)) * 2 - 1;
        case "squared": {
          const s = Math.sin(phase);
          return s * s * 2 - 1;
        }
        case "decay":
          return Math.sin(phase) / (1 + dist * falloff);
        case "sine":
        default:
          return Math.sin(phase);
      }
    }

    // Field function - summed ripple contribution from every source at (x, y).
    function field(x: number, y: number, t: number): number {
      let sum = 0;
      for (const s of sources) {
        const dx = x - s.x * W;
        const dy = y - s.y * H;
        const dist = Math.sqrt(dx * dx + dy * dy);
        sum +=
          shape(dist * s.frequency - t * s.speed, dist) * (s.amplitude ?? 1);
      }
      return sum;
    }

    function draw(now: number) {
      if (cancelled || !imgData || !buf) return;

      const delta = Math.min(now - lastNow, 100);
      lastNow = now;
      elapsed += delta * timeScale;
      const t = elapsed / 1000;

      const drift =
        Math.sin(t * driftSpeed) * 0.05 +
        Math.sin(t * driftSpeed * 0.47 + 1.3) * 0.02;

      const maxAmp = sources.reduce((acc, s) => acc + (s.amplitude ?? 1), 0);
      const [cr, cg, cb] = causticColor;

      const step = 2;
      const sampleStep = 3;
      const halfW = W / 2;
      const halfH = H / 2;
      const maxDistFromCentre = Math.sqrt(halfW * halfW + halfH * halfH);

      for (let y = 0; y < H; y += step) {
        for (let x = 0; x < W; x += step) {
          const raw = field(x, y, t);
          const norm = raw / Math.max(maxAmp, 0.0001);

          const eased01 = norm * 0.5 + 0.5;
          let eased = eased01 * eased01 * (3 - 2 * eased01);
          // Contrast as a power curve about the 0.5 midpoint, so the banding can be pushed harder or washed out without shifting hue.
          if (contrast !== 1) {
            const centred = eased - 0.5;
            eased =
              0.5 +
              Math.sign(centred) *
                Math.pow(Math.abs(centred) * 2, contrast) *
                0.5;
          }
          const displacement = (eased - 0.5) * 2 * rippleStrength;
          const baseT = lerp(y / H, x / W, axisMix) + drift;
          const [r, g, b] = sampleGradient(stops, baseT + displacement);
          const fx1 = field(x + sampleStep, y, t);
          const fy1 = field(x, y + sampleStep, t);
          const gradMag = Math.abs(fx1 - raw) + Math.abs(fy1 - raw);
          const caustic = Math.min(1, gradMag * 0.35) * causticStrength;

          let rr = lerp(r, cr, caustic);
          let gg = lerp(g, cg, caustic);
          let bb = lerp(b, cb, caustic);

          if (vignette > 0) {
            const ddx = (x - halfW) / maxDistFromCentre;
            const ddy = (y - halfH) / maxDistFromCentre;
            const d = Math.sqrt(ddx * ddx + ddy * ddy);
            const v = 1 - vignette * d * d;
            rr *= v;
            gg *= v;
            bb *= v;
          }

          if (grainAmount > 0) {
            const n = (Math.random() - 0.5) * 255 * grainAmount;
            rr += n;
            gg += n;
            bb += n;
          }

          rr = Math.min(255, Math.max(0, rr));
          gg = Math.min(255, Math.max(0, gg));
          bb = Math.min(255, Math.max(0, bb));

          for (let yy = 0; yy < step; yy++) {
            for (let xx = 0; xx < step; xx++) {
              const px = x + xx;
              const py = y + yy;
              if (px >= W || py >= H) continue;
              const idx = (py * W + px) * 4;
              buf[idx] = rr;
              buf[idx + 1] = gg;
              buf[idx + 2] = bb;
              buf[idx + 3] = 255;
            }
          }
        }
      }

      octx!.putImageData(imgData, 0, 0);
      ctx!.drawImage(offscreen, 0, 0);

      rafId = requestAnimationFrame(draw);
    }

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, [
    stops,
    sources,
    rippleStrength,
    driftSpeed,
    causticStrength,
    grainAmount,
    fieldMode,
    axisMix,
    contrast,
    causticColor,
    falloff,
    timeScale,
    vignette,
  ]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block" }}
      aria-hidden
    />
  );
}
