"use client";

/* ───────────────────────── Types ───────────────────────── */

export interface Palette {
  id: string;
  label: string;
  /** Near-black base tinted toward the palette so the glows sit naturally on it. */
  base: string;
  /** Larger glow (top-left), the dominant colour. */
  a: string;
  /** Smaller glow (bottom-right), the accompanying colour. */
  b: string;
  /** Per-glow opacity. Light colours get a low value so they stay ambient. */
  aOp: number;
  bOp: number;
}

/** Colours the user has edited by hand. Opacities are inherited from the palette it was derived from. */
export interface CustomColours {
  base: string;
  a: string;
  b: string;
  aOp: number;
  bOp: number;
}

export interface WallpaperSettings {
  /** A key into PALETTES, or "custom" to use `custom`. */
  palette: string;
  custom: CustomColours;
  /** Drift speed multiplier; 0 pauses the animation. */
  speed: number;
  /** Multiplier on glow opacity. */
  intensity: number;
  /** Multiplier on glow diameter. */
  size: number;
  /** Multiplier on blur radius. */
  softness: number;
  /** Edge darkening, 0 to 1. */
  vignette: number;
  /** Film-grain overlay opacity, 0 to 1. */
  grain: number;
}

/* ───────────────────────── Presets ───────────────────────── */

export const PALETTES: Palette[] = [
  {
    id: "aegean",
    label: "Aegean blue & chalk white",
    base: "#060b14",
    a: "#1d5f94",
    b: "#e8e4d6",
    aOp: 0.55,
    bOp: 0.16,
  },
  {
    id: "oxblood",
    label: "Oxblood red & dusty rose",
    base: "#0e0708",
    a: "#7b1a22",
    b: "#d1a3a4",
    aOp: 0.55,
    bOp: 0.18,
  },
  {
    id: "limestone",
    label: "Limestone & lichen",
    base: "#0b0c09",
    a: "#8f9c63",
    b: "#d6cfbb",
    aOp: 0.42,
    bOp: 0.16,
  },
  {
    id: "rosewood",
    label: "Rosewood & apricot",
    base: "#0e0807",
    a: "#8a3b3a",
    b: "#f1a977",
    aOp: 0.5,
    bOp: 0.24,
  },
  {
    id: "taupe",
    label: "Taupe & oat",
    base: "#0c0b0a",
    a: "#7d6e63",
    b: "#dcd0b4",
    aOp: 0.5,
    bOp: 0.16,
  },
  {
    id: "salty",
    label: "Salty blue & vermillion",
    base: "#070c12",
    a: "#7fa3bd",
    b: "#e34234",
    aOp: 0.38,
    bOp: 0.3,
  },
  {
    id: "peach",
    label: "Soft peach & baby blue",
    base: "#0a0b10",
    a: "#89cff0",
    b: "#f7c3a4",
    aOp: 0.32,
    bOp: 0.24,
  },
  {
    id: "cyprus",
    label: "Cyprus white & Cyprus copper",
    base: "#0c0907",
    a: "#b87333",
    b: "#f1ede4",
    aOp: 0.48,
    bOp: 0.15,
  },
];

export const DEFAULT_PALETTE = "aegean";

export const paletteById = (id: string | null | undefined): Palette =>
  PALETTES.find((p) => p.id === id) ?? PALETTES[0];

export const DEFAULT_WALLPAPER: WallpaperSettings = {
  palette: DEFAULT_PALETTE,
  custom: {
    base: PALETTES[0].base,
    a: PALETTES[0].a,
    b: PALETTES[0].b,
    aOp: PALETTES[0].aOp,
    bOp: PALETTES[0].bOp,
  },
  speed: 1,
  intensity: 1,
  size: 1,
  softness: 1,
  vignette: 0.4,
  grain: 0,
};

/** The palette actually in effect for these settings (preset or custom). */
export function resolvePalette(
  s: Pick<WallpaperSettings, "palette" | "custom">,
): Palette {
  if (s.palette === "custom")
    return { id: "custom", label: "Custom", ...s.custom };
  return paletteById(s.palette);
}

/* ───────────────────────── Persistence ───────────────────────── */

const STORAGE_KEY = "wallpaper-settings";
const LEGACY_PALETTE_KEY = "wallpaper-palette";
const NUM_KEYS = [
  "speed",
  "intensity",
  "size",
  "softness",
  "vignette",
  "grain",
] as const;
const HEX = /^#[0-9a-f]{6}$/i;

/** Reads saved settings (browser only), falling back to defaults for anything missing or invalid. */
export function loadWallpaperSettings(): WallpaperSettings {
  const out: WallpaperSettings = {
    ...DEFAULT_WALLPAPER,
    custom: { ...DEFAULT_WALLPAPER.custom },
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : {};

    const legacy = localStorage.getItem(LEGACY_PALETTE_KEY);
    const id: unknown = saved.palette ?? legacy;
    if (
      typeof id === "string" &&
      (id === "custom" || PALETTES.some((p) => p.id === id))
    ) {
      out.palette = id;
    }
    for (const k of NUM_KEYS) {
      const v = saved[k];
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
    if (saved.custom && typeof saved.custom === "object") {
      for (const k of ["base", "a", "b"] as const) {
        const v = saved.custom[k];
        if (typeof v === "string" && HEX.test(v)) out.custom[k] = v;
      }
      for (const k of ["aOp", "bOp"] as const) {
        const v = saved.custom[k];
        if (typeof v === "number" && Number.isFinite(v)) out.custom[k] = v;
      }
    }
  } catch {
    /* storage unavailable or corrupt: defaults are fine */
  }
  return out;
}

export function saveWallpaperSettings(s: WallpaperSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/**
 * Publishes the active palette as CSS custom properties on <html>, so any
 * experiment can match the desktop: var(--wp-base), var(--wp-a), var(--wp-b).
 * Call it once on mount in an experiment (after loadWallpaperSettings()) to
 * pick up the user's choice on a direct page load.
 */
export function applyWallpaperVars(s: WallpaperSettings) {
  if (typeof document === "undefined") return;
  const p = resolvePalette(s);
  const st = document.documentElement.style;
  st.setProperty("--wp-base", p.base);
  st.setProperty("--wp-a", p.a);
  st.setProperty("--wp-b", p.b);
}

/* ───────────────────────── Component ───────────────────────── */

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>" +
  "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>" +
  "<feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Two large, heavily blurred colour glows drifting slowly over a tinted
 * near-black base, with optional vignette and film grain. No canvas and no
 * per-frame JS: the animation is transform-only, so it runs on the compositor
 * and stays low-contrast enough not to compete with foreground content.
 */
export default function Wallpaper(s: WallpaperSettings) {
  const p = resolvePalette(s);
  const paused = s.speed <= 0.01;
  // Base cycles of 90s / 120s, scaled by the speed setting.
  const k = Math.max(s.speed, 0.1);
  const d1 = `${90 / k}s`;
  const d2 = `${120 / k}s`;
  const state = paused ? "paused" : "running";

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
        background: p.base,
        transition: "background-color 0.6s ease",
      }}
    >
      <style>{`
        @keyframes wp-drift-a {
          0%   { transform: translate3d(-10%, -10%, 0) scale(1); }
          50%  { transform: translate3d(12%, 8%, 0) scale(1.15); }
          100% { transform: translate3d(-10%, -10%, 0) scale(1); }
        }
        @keyframes wp-drift-b {
          0%   { transform: translate3d(10%, 12%, 0) scale(1.1); }
          50%  { transform: translate3d(-12%, -6%, 0) scale(0.95); }
          100% { transform: translate3d(10%, 12%, 0) scale(1.1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .wp-blob { animation: none !important; }
        }
      `}</style>

      <div
        className="wp-blob"
        style={{
          position: "absolute",
          top: "-20%",
          left: "-10%",
          width: `${70 * s.size}vmax`,
          height: `${70 * s.size}vmax`,
          borderRadius: "50%",
          background: `radial-gradient(closest-side, ${p.a}, transparent)`,
          filter: `blur(${50 * s.softness}px)`,
          opacity: clamp01(p.aOp * s.intensity),
          willChange: "transform",
          animationName: "wp-drift-a",
          animationDuration: d1,
          animationTimingFunction: "ease-in-out",
          animationIterationCount: "infinite",
          animationPlayState: state,
        }}
      />
      <div
        className="wp-blob"
        style={{
          position: "absolute",
          bottom: "-25%",
          right: "-15%",
          width: `${60 * s.size}vmax`,
          height: `${60 * s.size}vmax`,
          borderRadius: "50%",
          background: `radial-gradient(closest-side, ${p.b}, transparent)`,
          filter: `blur(${60 * s.softness}px)`,
          opacity: clamp01(p.bOp * s.intensity),
          willChange: "transform",
          animationName: "wp-drift-b",
          animationDuration: d2,
          animationTimingFunction: "ease-in-out",
          animationIterationCount: "infinite",
          animationPlayState: state,
        }}
      />

      {/* Vignette keeps the edges dark so content in the middle stays legible */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${clamp01(s.vignette)}) 100%)`,
        }}
      />

      {s.grain > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: GRAIN,
            opacity: clamp01(s.grain),
          }}
        />
      )}
    </div>
  );
}
