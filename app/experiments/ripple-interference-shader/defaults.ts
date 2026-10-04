import type {
  FieldMode,
  IQPalette,
  RippleSource,
} from "./RippleInterferenceShader";

/**
 * Single source of truth for the ripple shader's default look. Imported by the
 * experiment page and by the welcome screen, so the two can't drift apart.
 */

export const PALETTES: Record<string, IQPalette> = {
  coral: {
    a: [0.02, 0.523, 1.0],
    b: [1.0, 0.337, 0.682],
    c: [0.264, 0.838, 0.429],
    d: [0.941, 0.986, 0.276],
  },
  pastel: {
    a: [0.887, 0.88, 0.879],
    b: [0.08, 0.078, 0.096],
    c: [1.008, 0.932, 0.579],
    d: [0.938, 0.2, 0.787],
  },
  flame: {
    a: [0.862, 0.704, 1.0],
    b: [0.142, 0.589, 0.879],
    c: [0.394, 0.279, 0.33],
    d: [0.945, 0.178, 0.284],
  },
  sunset: {
    a: [0.298, 0.451, 0.0],
    b: [0.611, 0.226, 0.36],
    c: [0.599, 0.853, 0.263],
    d: [0.641, 0.43, 0.856],
  },
  aegean: {
    a: [0.254, 0.315, 0.287],
    b: [0.266, 0.245, 0.202],
    c: [1.357, 1.216, 0.932],
    d: [0.28, 0.368, 0.551],
  },
  dusk: {
    a: [0.518, 0.333, 0.278],
    b: [0.405, 0.263, 0.247],
    c: [0.882, 0.973, 0.718],
    d: [0.468, 0.373, 0.664],
  },
  citrus: {
    a: [0.527, 0.459, 0.154],
    b: [0.456, 0.353, 0.142],
    c: [0.801, 0.805, 0.669],
    d: [0.518, 0.634, 0.672],
  },
  ice: {
    a: [0.331, 0.465, 0.509],
    b: [0.284, 0.331, 0.342],
    c: [1.149, 1.019, 0.899],
    d: [0.368, 0.456, 0.528],
  },
  mono: {
    a: [0.479, 0.433, 0.429],
    b: [0.374, 0.314, 0.321],
    c: [0.953, 1.112, 1.187],
    d: [0.446, 0.432, 0.423],
  },
  neon: {
    a: [0.475, 0.31, 0.376],
    b: [0.259, 0.36, 0.455],
    c: [1.181, 1.084, 0.515],
    d: [0.493, 0.283, 0.681],
  },
  terracotta: {
    a: [0.507, 0.359, 0.242],
    b: [0.349, 0.215, 0.139],
    c: [0.788, 0.918, 0.931],
    d: [0.558, 0.42, 0.392],
  },
  nebula: {
    a: [0.38, 0.253, 0.397],
    b: [0.379, 0.267, 0.288],
    c: [0.998, 0.898, 0.775],
    d: [0.342, 0.306, 0.464],
  },
};

export const DEFAULT_SOURCES: RippleSource[] = [
  { x: 0.68, y: 0.22, frequency: 0.055, speed: 0.5, amplitude: 1 },
  { x: 0.28, y: 0.86, frequency: 0.048, speed: -0.4, amplitude: 0.85 },
];

export const DEFAULT_PALETTE = "coral";

export interface ShaderDefaults {
  rippleStrength: number;
  driftSpeed: number;
  causticStrength: number;
  grainAmount: number;
  fieldMode: FieldMode;
  axisMix: number;
  contrast: number;
  causticColor: [number, number, number];
  falloff: number;
  timeScale: number;
  vignette: number;
}

export const DEFAULTS: ShaderDefaults = {
  rippleStrength: 0.16,
  driftSpeed: 0.12,
  causticStrength: 0.5,
  grainAmount: 0.06,
  fieldMode: "sine",
  axisMix: 0,
  contrast: 1,
  causticColor: [1, 1, 1],
  falloff: 0.004,
  timeScale: 1,
  vignette: 0,
};
