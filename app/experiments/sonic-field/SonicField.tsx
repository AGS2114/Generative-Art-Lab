"use client";

import { useEffect, useRef } from "react";
import { useResizeObserver } from "../_lib/useResizeObserver";

export interface SonicFieldParams {
  gridDensity: number;
  glow: number;
  notchSize: number;
  trail: number;
  tint: number;
  hueShift: number;
  /** 0 = geometric, 1 = rings, 2 = crosses, 3 = organic (soft wobbled blobs). */
  glyphSet: number;
  /** "glyphs" = current grid-of-shapes look; "soft" = blurred luminance field, calmer/atmospheric. */
  renderMode: "glyphs" | "soft";
}

export interface NoteEvent {
  /** 0..1 pitch position, low pitch = 0 (center-ish), high pitch = 1 (outer) */
  pitch: number;
  /** 0..1 loudness, scales pluck strength and ripple radius */
  velocity: number;
  /** 0..1 stereo-ish angle bias, used to place the pluck around the ring */
  pan: number;
  /**
   * Which part of the piece produced this note - lets the display colour
   * each pluck by its source (lead melody, chord tone, bass, or a manual
   * user pluck) rather than every ripple sharing one global hue. Optional
   * so existing callers that don't care about voice colouring still work;
   * defaults to "lead" if omitted.
   */
  voice?: "lead" | "chord" | "bass" | "manual";
}

interface SonicFieldProps {
  params?: Partial<SonicFieldParams>;
  waveSpeed: number;
  damping: number;
  stepsPerFrame: number;
  /** Called by the parent each animation frame to pull queued note events. */
  drainNotes: () => NoteEvent[];
  /** Continuous 0..1 audio energy (e.g. low-band RMS) applied as ambient shimmer. */
  getAmbientEnergy: () => number;
  /**
   * Called when the user clicks/drags on the field, with the pluck's
   * normalized position (0..1 sim UV space) and a 0..1 strength. Layering
   * user plucks on top of the generative ones is what turns this from
   * "watch a generator" into "play alongside it" - the parent can choose
   * to also sound a note for the click (see page.tsx) so the visual and
   * audio stay in sync for user-driven plucks too.
   */
  onManualPluck?: (x: number, y: number, strength: number) => void;
}

const DEFAULT_PARAMS: SonicFieldParams = {
  gridDensity: 64,
  glow: 0.09,
  notchSize: 0.26,
  trail: 0.42,
  tint: 0.6,
  hueShift: 0,
  glyphSet: 0,
  renderMode: "glyphs",
};

const SIM_SIZE = 256;

const VERTEX_SRC = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const SIM_FRAGMENT_SRC = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uState;
uniform vec2 uTexel;
uniform float uWaveSpeed;
uniform float uDamping;
uniform float uDt;

vec2 sampleState(vec2 uv) {
  return texture(uState, fract(uv)).rg;
}

void main() {
  vec4 full = texture(uState, vUv);
  float h = full.r;
  float vel = full.g;
  float hue = full.b;

  float nR = sampleState(vUv + vec2(uTexel.x, 0.0)).r;
  float nL = sampleState(vUv - vec2(uTexel.x, 0.0)).r;
  float nU = sampleState(vUv + vec2(0.0, uTexel.y)).r;
  float nD = sampleState(vUv - vec2(0.0, uTexel.y)).r;

  float lap = nR + nL + nU + nD - 4.0 * h;

  float accel = uWaveSpeed * uWaveSpeed * lap;
  vel += accel * uDt;
  vel *= (1.0 - uDamping);
  vel = clamp(vel, -4.0, 4.0);
  h += vel * uDt;
  h = clamp(h, -1.0, 1.0);

  // Hue simply rides along with the cell - it only changes when a pluck
  // writes a new value, so it doesn't need its own dynamics here.
  fragColor = vec4(h, vel, hue, 1.0);
}
`;

const PLUCK_FRAGMENT_SRC = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uState;
uniform vec2 uPluckPos;
uniform float uPluckStrength;
uniform float uPluckRadius;
uniform float uPluckHue;

void main() {
  vec4 c = texture(uState, vUv);
  float d = distance(vUv, uPluckPos);
  float blob = smoothstep(uPluckRadius, 0.0, d) * uPluckStrength;
  float h = clamp(c.r + blob, -1.0, 1.0);
  // Blend toward this pluck's hue in proportion to how much it actually
  // disturbed this cell, so a strong nearby pluck overwrites old colour
  // here while distant cells keep whatever hue they already had.
  float hue = mix(c.b, uPluckHue, clamp(blob, 0.0, 1.0));
  fragColor = vec4(h, c.g, hue, 1.0);
}
`;

const AMBIENT_FRAGMENT_SRC = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uState;
uniform float uAmbient;
uniform float uTime;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453123);
}

void main() {
  vec4 c = texture(uState, vUv);
  vec2 center = vec2(0.5);
  float d = distance(vUv, center);
  // Oscillates around zero (not 0..1) so it can push velocity both ways -
  // a one-directional lift here would slowly saturate the whole field
  // toward +1 over time regardless of damping, since damping only decays
  // velocity, not a direct height injection.
  float ring = sin(d * 40.0 - uTime * 1.4);
  float grain = hash(vUv * 512.0 + uTime * 0.1);
  float lift = uAmbient * ring * (0.6 + grain * 0.4) * 0.015;
  // Perturb velocity rather than height directly, so the sim's own
  // damping term actually opposes this over time instead of it being a
  // pure accumulator.
  float vel = c.g + lift;
  fragColor = vec4(c.r, vel, c.b, 1.0);
}
`;

const CLEAR_WAVES_FRAGMENT_SRC = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

void main() {
  fragColor = vec4(0.0, 0.0, 0.0, 1.0);
}
`;

const DISPLAY_GLYPHS_FRAGMENT_SRC = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSimState;
uniform sampler2D uPrevFrame;
uniform vec2 uResolution;
uniform float uGridDensity;
uniform float uGlow;
uniform float uNotchSize;
uniform float uTrail;
uniform float uTint;
uniform float uHueShift;
uniform int uGlyphSet;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float sdCircle(vec2 p, float r) {
  return length(p) - r;
}

float sdCross(vec2 p, float barLen, float barW) {
  float h = sdRoundBox(p, vec2(barLen, barW), barW * 0.4);
  float vv = sdRoundBox(p, vec2(barW, barLen), barW * 0.4);
  return min(h, vv);
}

float sdRing(vec2 p, float r, float thickness) {
  return abs(length(p) - r) - thickness;
}

float sdHexagon(vec2 p, float r) {
  vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

// Soft, wobbled blob - a circle whose radius is perturbed by a few sine
// harmonics of its angle, so it reads as organic/cell-like rather than a
// perfect geometric primitive. cellId seeds a per-cell phase so neighbouring
// glyphs don't all wobble in lockstep.
float sdBlob(vec2 p, float r, vec2 cellId) {
  float a = atan(p.y, p.x);
  float seed = hash(cellId * 3.1) * 6.2831;
  float wobble =
    sin(a * 3.0 + seed) * 0.14 + sin(a * 5.0 - seed * 1.7) * 0.08;
  return length(p) - r * (1.0 + wobble);
}

float fillWithGlow(float d, float glowAmt) {
  float core = 1.0 - smoothstep(-glowAmt * 0.4, glowAmt * 0.4, d);
  float halo = 1.0 - smoothstep(0.0, glowAmt * 2.2, max(d, 0.0));
  return clamp(core + halo * 0.35, 0.0, 1.0);
}

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec3 hueRotate(vec3 col, float shift) {
  vec3 hsv = rgb2hsv(col);
  hsv.x = fract(hsv.x + shift);
  return hsv2rgb(hsv);
}

void main() {
  vec2 fragUv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;

  vec2 gridUv = fragUv;
  gridUv.x *= aspect;
  float density = uGridDensity;

  vec2 cellF = gridUv * density;
  vec2 cellId = floor(cellF);
  vec2 localUv = fract(cellF) - 0.5;

  vec2 cellCenterGridUv = (cellId + 0.5) / density;
  vec2 cellCenterUv = vec2(cellCenterGridUv.x / aspect, cellCenterGridUv.y);
  vec4 stateHere = texture(uSimState, cellCenterUv);
  float v = abs(stateHere.r);
  float cellHue = stateHere.b;

  float t0 = 0.03;
  float t1 = 0.1;
  float t2 = 0.2;
  float t3 = 0.35;

  float glow = uGlow;
  vec3 col = vec3(0.015, 0.015, 0.022);

  // Background dot only fades in alongside real amplitude, and its floor
  // opacity is much lower - a quiet/resting field should read as dark,
  // not as a fully-lit grid waiting for something to happen.
  float bgPresence = smoothstep(0.0, t0, v);
  float bgDot = sdCircle(localUv, 0.035);
  float bgFill = fillWithGlow(bgDot, glow * 0.5) * 0.05 * (0.3 + bgPresence * 0.7);
  col += vec3(bgFill);

  vec3 coolTint = hueRotate(vec3(0.62, 0.78, 1.0), uHueShift);
  vec3 warmTint = hueRotate(vec3(1.05, 0.75, 0.95), uHueShift);
  vec3 hueMix = mix(coolTint, warmTint, smoothstep(0.0, 0.5, v));
  // Blend in this cell's voice-sourced hue (from whichever pluck last hit
  // it) on top of the amplitude gradient, so colour tracks which voice -
  // lead, chord, bass, or a manual pluck - actually rippled this spot,
  // rather than colour being purely a function of how loud it is.
  vec3 voiceHue = hsv2rgb(vec3(fract(cellHue + uHueShift), 0.55, 1.0));
  vec3 hueFinal = mix(hueMix, voiceHue, 0.5);
  vec3 tintFactor = mix(vec3(1.0), hueFinal, uTint);

  if (v > t0) {
    float shapeMix = smoothstep(t0, t1, v);
    float d;
    if (uGlyphSet == 1) {
      float r = mix(0.05, 0.12, shapeMix);
      d = sdRing(localUv, r, r * 0.35);
    } else if (uGlyphSet == 2) {
      float barLen = mix(0.04, 0.09, shapeMix);
      d = sdCross(localUv, barLen, barLen * 0.32);
    } else if (uGlyphSet == 3) {
      d = sdBlob(localUv, mix(0.045, 0.1, shapeMix), cellId);
    } else {
      d = sdCircle(localUv, mix(0.045, 0.11, shapeMix));
    }
    float fill = fillWithGlow(d, glow);
    col = mix(col, vec3(0.6, 0.68, 0.74) * tintFactor, fill);
  }

  if (v > t1) {
    float shapeMix = smoothstep(t1, t2, v);
    float d;
    if (uGlyphSet == 1) {
      float r = mix(0.08, 0.15, shapeMix);
      d = sdHexagon(localUv, r);
    } else if (uGlyphSet == 2) {
      float barLen = mix(0.08, 0.14, shapeMix);
      d = sdCross(localUv, barLen, barLen * 0.28);
    } else if (uGlyphSet == 3) {
      d = sdBlob(localUv, mix(0.08, 0.14, shapeMix), cellId + 5.0);
    } else {
      float size = mix(0.1, 0.18, shapeMix);
      d = sdRoundBox(localUv, vec2(size), size * 0.18);
    }
    float fill = fillWithGlow(d, glow);
    col = mix(col, vec3(0.7, 0.74, 0.78) * tintFactor, fill);
  }

  if (v > t2) {
    float shapeMix = smoothstep(t2, t3, v);
    float d;
    if (uGlyphSet == 3) {
      d = sdBlob(localUv, mix(0.11, 0.19, shapeMix), cellId + 11.0);
    } else {
      float barLen = mix(0.11, 0.22, shapeMix);
      d = sdCross(localUv, barLen, barLen * 0.3);
    }
    float fill = fillWithGlow(d, glow);
    col = mix(col, vec3(0.84, 0.86, 0.9) * tintFactor, fill);
  }

  if (v > t3) {
    float shapeMix = smoothstep(t3, 1.0, v);
    float size = mix(0.2, 0.32, shapeMix);
    float d = uGlyphSet == 3
      ? sdBlob(localUv, size, cellId + 17.0)
      : sdRoundBox(localUv, vec2(size), size * 0.12);
    float fill = fillWithGlow(d, glow);
    vec3 solid = vec3(0.96, 0.97, 0.99) * tintFactor;

    float notchHash = hash(cellId + 11.7);
    float notchOffsetHash = hash(cellId * 1.37 + 4.2);
    vec2 notchOffset = (vec2(
      fract(notchOffsetHash * 7.0),
      fract(notchOffsetHash * 13.0)
    ) - 0.5) * size * 0.5;
    float notchR = uNotchSize * size * (0.5 + notchHash * 0.7);
    float notchD = sdRoundBox(localUv - notchOffset, vec2(notchR), notchR * 0.3);
    float notchFill = 1.0 - smoothstep(-glow * 0.3, glow * 0.3, notchD);

    float notchGate = step(0.4, notchHash);
    vec3 withNotch = mix(solid, col, notchFill * notchGate);
    col = mix(col, withNotch, fill);
  }

  vec3 prevCol = texture(uPrevFrame, fragUv).rgb;
  vec3 decayed = prevCol * (0.86 * uTrail);
  col = max(col, decayed);

  // Soft vignette: darkens toward the edges so the field reads as a
  // framed piece rather than a flat grid cut off by a hard border.
  vec2 vignetteUv = fragUv - 0.5;
  float vignette = 1.0 - dot(vignetteUv, vignetteUv) * 0.9;
  col *= clamp(vignette, 0.55, 1.0);

  fragColor = vec4(col, 1.0);
}
`;

const DISPLAY_SOFT_FRAGMENT_SRC = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSimState;
uniform sampler2D uPrevFrame;
uniform vec2 uResolution;
uniform float uGlow;
uniform float uTrail;
uniform float uTint;
uniform float uHueShift;

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec3 hueRotate(vec3 col, float shift) {
  vec3 hsv = rgb2hsv(col);
  hsv.x = fract(hsv.x + shift);
  return hsv2rgb(hsv);
}

// Soft, blurred luminance field: no grid, no glyphs - the raw wave height
// sampled with a small multi-tap blur and mapped straight to a smooth glow.
// Reads as light through water/glass rather than a lit-up display panel.
void main() {
  vec2 fragUv = gl_FragCoord.xy / uResolution;
  vec2 texel = 1.0 / uResolution * 2.5;

  float h = 0.0;
  float hueAccum = 0.0;
  float wsum = 0.0;
  const int R = 2;
  for (int dx = -R; dx <= R; dx++) {
    for (int dy = -R; dy <= R; dy++) {
      vec2 offset = vec2(float(dx), float(dy)) * texel;
      float w = 1.0 / (1.0 + float(dx * dx + dy * dy));
      vec4 s = texture(uSimState, fragUv + offset);
      h += abs(s.r) * w;
      hueAccum += s.b * w;
      wsum += w;
    }
  }
  h /= wsum;
  float cellHue = hueAccum / wsum;

  float lum = smoothstep(0.0, 0.5, h);
  lum = pow(lum, 0.7 + (1.0 - uGlow * 4.0) * 0.3);

  vec3 coolTint = hueRotate(vec3(0.55, 0.7, 1.0), uHueShift);
  vec3 warmTint = hueRotate(vec3(1.05, 0.7, 0.9), uHueShift);
  vec3 hueMix = mix(coolTint, warmTint, smoothstep(0.15, 0.6, h));
  vec3 voiceHue = hsv2rgb(vec3(fract(cellHue + uHueShift), 0.55, 1.0));
  vec3 hueFinal = mix(hueMix, voiceHue, 0.5);
  vec3 tintFactor = mix(vec3(1.0), hueFinal, uTint);

  vec3 base = vec3(0.01, 0.01, 0.016);
  vec3 col = base + lum * tintFactor * 0.9;

  vec3 prevCol = texture(uPrevFrame, fragUv).rgb;
  vec3 decayed = prevCol * (0.9 * uTrail);
  col = max(col, decayed);

  vec2 vignetteUv = fragUv - 0.5;
  float vignette = 1.0 - dot(vignetteUv, vignetteUv) * 0.9;
  col *= clamp(vignette, 0.55, 1.0);

  fragColor = vec4(col, 1.0);
}
`;

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vsSrc: string,
  fsSrc: string,
): WebGLProgram | null {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

function createSimTexture(
  gl: WebGL2RenderingContext,
  size: number,
): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA16F,
    size,
    size,
    0,
    gl.RGBA,
    gl.HALF_FLOAT,
    null,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

function createFrameTexture(
  gl: WebGL2RenderingContext,
  w: number,
  h: number,
): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA8,
    w,
    h,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

/**
 * SonicField - the same wave-interference / glyph-rendering engine as GlyphField, but with pointer-plucking and obstacle
 * walls stripped out. Plucks are driven entirely by `drainNotes()`, called once per animation frame by the parent, which
 * hands back any note events queued since the previous frame from the Web Audio scheduler. `getAmbientEnergy()` supplies
 * a continuous 0..1 value (e.g. smoothed RMS of the audio bus) that adds a faint traveling shimmer independent of discrete notes.
 */
export default function SonicField({
  params: paramOverrides,
  waveSpeed,
  damping,
  stepsPerFrame,
  drainNotes,
  getAmbientEnergy,
  onManualPluck,
}: SonicFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const sizeRef = useRef({ w: 1, h: 1 });

  const onManualPluckRef = useRef(onManualPluck);
  onManualPluckRef.current = onManualPluck;

  const pointerRef = useRef<{
    down: boolean;
    x: number;
    y: number;
    pending: boolean;
  }>({ down: false, x: 0.5, y: 0.5, pending: false });

  const paramsRef = useRef<SonicFieldParams>({
    ...DEFAULT_PARAMS,
    ...paramOverrides,
  });
  paramsRef.current = { ...DEFAULT_PARAMS, ...paramOverrides };

  const simParamsRef = useRef({ waveSpeed, damping, stepsPerFrame });
  simParamsRef.current = { waveSpeed, damping, stepsPerFrame };

  const drainNotesRef = useRef(drainNotes);
  drainNotesRef.current = drainNotes;
  const getAmbientEnergyRef = useRef(getAmbientEnergy);
  getAmbientEnergyRef.current = getAmbientEnergy;

  useResizeObserver(canvasRef, (w, h) => {
    sizeRef.current = { w, h };
    const gl = glRef.current;
    if (gl) gl.viewport(0, 0, w, h);
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function setFromEvent(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1 - (e.clientY - rect.top) / rect.height;
      pointerRef.current.x = Math.min(1, Math.max(0, x));
      pointerRef.current.y = Math.min(1, Math.max(0, y));
      pointerRef.current.pending = true;
    }

    function onDown(e: PointerEvent) {
      pointerRef.current.down = true;
      setFromEvent(e);
    }
    function onMove(e: PointerEvent) {
      if (pointerRef.current.down) setFromEvent(e);
    }
    function onUp() {
      pointerRef.current.down = false;
    }

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    canvas.style.cursor = "crosshair";

    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", { antialias: false });
    if (!gl) {
      console.error("WebGL2 is not available in this browser.");
      return;
    }
    glRef.current = gl;
    const glc = gl;

    const ext = glc.getExtension("EXT_color_buffer_float");
    if (!ext) {
      console.error("EXT_color_buffer_float is not supported.");
      return;
    }

    const simProgram = createProgram(gl, VERTEX_SRC, SIM_FRAGMENT_SRC);
    const pluckProgram = createProgram(gl, VERTEX_SRC, PLUCK_FRAGMENT_SRC);
    const ambientProgram = createProgram(gl, VERTEX_SRC, AMBIENT_FRAGMENT_SRC);
    const clearWavesProgram = createProgram(
      gl,
      VERTEX_SRC,
      CLEAR_WAVES_FRAGMENT_SRC,
    );
    const displayGlyphsProgram = createProgram(
      gl,
      VERTEX_SRC,
      DISPLAY_GLYPHS_FRAGMENT_SRC,
    );
    const displaySoftProgram = createProgram(
      gl,
      VERTEX_SRC,
      DISPLAY_SOFT_FRAGMENT_SRC,
    );
    if (
      !simProgram ||
      !pluckProgram ||
      !ambientProgram ||
      !clearWavesProgram ||
      !displayGlyphsProgram ||
      !displaySoftProgram
    )
      return;

    const vbo = glc.createBuffer();
    glc.bindBuffer(glc.ARRAY_BUFFER, vbo);
    glc.bufferData(
      glc.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      glc.STATIC_DRAW,
    );

    function bindPosAttrib(program: WebGLProgram) {
      const loc = glc.getAttribLocation(program, "aPos");
      glc.enableVertexAttribArray(loc);
      glc.vertexAttribPointer(loc, 2, glc.FLOAT, false, 0, 0);
    }

    let texA = createSimTexture(gl, SIM_SIZE);
    let texB = createSimTexture(gl, SIM_SIZE);
    const fboA = glc.createFramebuffer();
    const fboB = glc.createFramebuffer();

    function attachTex(fbo: WebGLFramebuffer, tex: WebGLTexture) {
      glc.bindFramebuffer(glc.FRAMEBUFFER, fbo);
      glc.framebufferTexture2D(
        glc.FRAMEBUFFER,
        glc.COLOR_ATTACHMENT0,
        glc.TEXTURE_2D,
        tex,
        0,
      );
    }
    attachTex(fboA!, texA);
    attachTex(fboB!, texB);

    let readTex = texA;
    let readFbo = fboA!;
    let writeTex = texB;
    let writeFbo = fboB!;

    function stepSim(waveSpeed: number, damping: number) {
      glc.useProgram(simProgram);
      glc.bindFramebuffer(glc.FRAMEBUFFER, writeFbo);
      glc.viewport(0, 0, SIM_SIZE, SIM_SIZE);
      bindPosAttrib(simProgram!);

      glc.activeTexture(glc.TEXTURE0);
      glc.bindTexture(glc.TEXTURE_2D, readTex);
      glc.uniform1i(glc.getUniformLocation(simProgram!, "uState"), 0);
      glc.uniform2f(
        glc.getUniformLocation(simProgram!, "uTexel"),
        1 / SIM_SIZE,
        1 / SIM_SIZE,
      );
      glc.uniform1f(
        glc.getUniformLocation(simProgram!, "uWaveSpeed"),
        waveSpeed,
      );
      glc.uniform1f(glc.getUniformLocation(simProgram!, "uDamping"), damping);
      glc.uniform1f(glc.getUniformLocation(simProgram!, "uDt"), 1.0);

      glc.drawArrays(glc.TRIANGLES, 0, 3);

      [readTex, writeTex] = [writeTex, readTex];
      [readFbo, writeFbo] = [writeFbo, readFbo];
    }

    function pluck(
      x: number,
      y: number,
      strength: number,
      radius: number,
      hue: number,
    ) {
      glc.useProgram(pluckProgram);
      glc.bindFramebuffer(glc.FRAMEBUFFER, writeFbo);
      glc.viewport(0, 0, SIM_SIZE, SIM_SIZE);
      bindPosAttrib(pluckProgram!);
      glc.activeTexture(glc.TEXTURE0);
      glc.bindTexture(glc.TEXTURE_2D, readTex);
      glc.uniform1i(glc.getUniformLocation(pluckProgram!, "uState"), 0);
      glc.uniform2f(glc.getUniformLocation(pluckProgram!, "uPluckPos"), x, y);
      glc.uniform1f(
        glc.getUniformLocation(pluckProgram!, "uPluckStrength"),
        strength,
      );
      glc.uniform1f(
        glc.getUniformLocation(pluckProgram!, "uPluckRadius"),
        radius,
      );
      glc.uniform1f(glc.getUniformLocation(pluckProgram!, "uPluckHue"), hue);
      glc.drawArrays(glc.TRIANGLES, 0, 3);

      [readTex, writeTex] = [writeTex, readTex];
      [readFbo, writeFbo] = [writeFbo, readFbo];
    }

    function applyAmbient(ambient: number, time: number) {
      if (ambient <= 0.001) return;
      glc.useProgram(ambientProgram);
      glc.bindFramebuffer(glc.FRAMEBUFFER, writeFbo);
      glc.viewport(0, 0, SIM_SIZE, SIM_SIZE);
      bindPosAttrib(ambientProgram!);
      glc.activeTexture(glc.TEXTURE0);
      glc.bindTexture(glc.TEXTURE_2D, readTex);
      glc.uniform1i(glc.getUniformLocation(ambientProgram!, "uState"), 0);
      glc.uniform1f(
        glc.getUniformLocation(ambientProgram!, "uAmbient"),
        ambient,
      );
      glc.uniform1f(glc.getUniformLocation(ambientProgram!, "uTime"), time);
      glc.drawArrays(glc.TRIANGLES, 0, 3);

      [readTex, writeTex] = [writeTex, readTex];
      [readFbo, writeFbo] = [writeFbo, readFbo];
    }

    function clearWaves() {
      glc.useProgram(clearWavesProgram);
      glc.bindFramebuffer(glc.FRAMEBUFFER, writeFbo);
      glc.viewport(0, 0, SIM_SIZE, SIM_SIZE);
      bindPosAttrib(clearWavesProgram!);
      glc.drawArrays(glc.TRIANGLES, 0, 3);
      [readTex, writeTex] = [writeTex, readTex];
      [readFbo, writeFbo] = [writeFbo, readFbo];
    }
    // Start from a flat field - the music is the only source of motion.
    clearWaves();

    const displayGlyphsUniforms = {
      uSimState: glc.getUniformLocation(displayGlyphsProgram, "uSimState"),
      uPrevFrame: glc.getUniformLocation(displayGlyphsProgram, "uPrevFrame"),
      uResolution: glc.getUniformLocation(displayGlyphsProgram, "uResolution"),
      uGridDensity: glc.getUniformLocation(
        displayGlyphsProgram,
        "uGridDensity",
      ),
      uGlow: glc.getUniformLocation(displayGlyphsProgram, "uGlow"),
      uNotchSize: glc.getUniformLocation(displayGlyphsProgram, "uNotchSize"),
      uTrail: glc.getUniformLocation(displayGlyphsProgram, "uTrail"),
      uTint: glc.getUniformLocation(displayGlyphsProgram, "uTint"),
      uHueShift: glc.getUniformLocation(displayGlyphsProgram, "uHueShift"),
      uGlyphSet: glc.getUniformLocation(displayGlyphsProgram, "uGlyphSet"),
    };

    const displaySoftUniforms = {
      uSimState: glc.getUniformLocation(displaySoftProgram, "uSimState"),
      uPrevFrame: glc.getUniformLocation(displaySoftProgram, "uPrevFrame"),
      uResolution: glc.getUniformLocation(displaySoftProgram, "uResolution"),
      uGlow: glc.getUniformLocation(displaySoftProgram, "uGlow"),
      uTrail: glc.getUniformLocation(displaySoftProgram, "uTrail"),
      uTint: glc.getUniformLocation(displaySoftProgram, "uTint"),
      uHueShift: glc.getUniformLocation(displaySoftProgram, "uHueShift"),
    };

    let frameTexA = createFrameTexture(glc, 1, 1);
    let frameTexB = createFrameTexture(glc, 1, 1);
    const frameFboA = glc.createFramebuffer()!;
    const frameFboB = glc.createFramebuffer()!;
    attachTex(frameFboA, frameTexA);
    attachTex(frameFboB, frameTexB);
    let frameReadTex = frameTexA;
    let frameReadFbo = frameFboA;
    let frameWriteTex = frameTexB;
    let frameWriteFbo = frameFboB;
    let frameTexW = 1;
    let frameTexH = 1;

    function resizeFrameTexIfNeeded(w: number, h: number) {
      if (w === frameTexW && h === frameTexH) return;
      frameTexW = w;
      frameTexH = h;
      glc.deleteTexture(frameTexA);
      glc.deleteTexture(frameTexB);
      frameTexA = createFrameTexture(glc, w, h);
      frameTexB = createFrameTexture(glc, w, h);
      attachTex(frameFboA, frameTexA);
      attachTex(frameFboB, frameTexB);
      frameReadTex = frameTexA;
      frameReadFbo = frameFboA;
      frameWriteTex = frameTexB;
      frameWriteFbo = frameFboB;
    }

    let rafId = 0;
    let cancelled = false;
    let last = performance.now();
    let elapsed = 0;

    // Base hue (0..1, hue-wheel fraction) per voice, before the global
    // uHueShift rotation the display shader applies on top. Distinct lanes
    // per voice are what let colour visibly track *which part of the
    // music* rippled a given region, instead of colour being one global
    // constant unrelated to what's actually playing.
    const VOICE_HUE: Record<string, number> = {
      lead: 0.58, // cool blue
      chord: 0.78, // violet
      bass: 0.02, // warm red
      manual: 0.33, // green, so user plucks read as visually distinct too
    };

    function frame(now: number) {
      if (cancelled) return;
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      elapsed += dt;

      const notes = drainNotesRef.current();
      for (const n of notes) {
        // Map pitch to radius from center (low notes stay inward, high notes
        // ring further out) and pan to angle around the field.
        const angle = n.pan * Math.PI * 2;
        const radius = 0.08 + n.pitch * 0.34;
        const x = 0.5 + Math.cos(angle) * radius;
        const y = 0.5 + Math.sin(angle) * radius;
        const strength = 0.35 + n.velocity * 0.65;
        const pluckRadius = 0.03 + n.velocity * 0.03;
        const hue = VOICE_HUE[n.voice ?? "lead"];
        pluck(x, y, strength, pluckRadius, hue);
      }

      // Manual (pointer) plucks: layered on top of the generative ones so
      // playing along with the piece and the piece's own notes ripple the
      // same field through the same pluck() call - one visual language,
      // two sources. Only fires once per pointer-move event rather than
      // every frame while held, so a drag doesn't flood the field.
      if (pointerRef.current.pending) {
        pointerRef.current.pending = false;
        const { x, y } = pointerRef.current;
        const strength = 0.55;
        pluck(x, y, strength, 0.045, VOICE_HUE.manual);
        onManualPluckRef.current?.(x, y, strength);
      }

      const ambient = getAmbientEnergyRef.current();
      applyAmbient(ambient, elapsed);

      const { waveSpeed, damping, stepsPerFrame } = simParamsRef.current;
      for (let i = 0; i < stepsPerFrame; i++) {
        stepSim(waveSpeed, damping);
      }

      const { w, h } = sizeRef.current;
      resizeFrameTexIfNeeded(w, h);

      const p = paramsRef.current;
      const useSoft = p.renderMode === "soft";
      const activeProgram = useSoft ? displaySoftProgram : displayGlyphsProgram;
      const u = useSoft ? displaySoftUniforms : displayGlyphsUniforms;

      glc.bindFramebuffer(glc.FRAMEBUFFER, frameWriteFbo);
      glc.viewport(0, 0, w, h);
      glc.useProgram(activeProgram);
      bindPosAttrib(activeProgram!);

      glc.activeTexture(glc.TEXTURE0);
      glc.bindTexture(glc.TEXTURE_2D, readTex);
      glc.uniform1i(u.uSimState, 0);

      glc.activeTexture(glc.TEXTURE1);
      glc.bindTexture(glc.TEXTURE_2D, frameReadTex);
      glc.uniform1i(u.uPrevFrame, 1);

      glc.uniform2f(u.uResolution, w, h);
      glc.uniform1f(u.uGlow, p.glow);
      glc.uniform1f(u.uTrail, p.trail);
      glc.uniform1f(u.uTint, p.tint);
      glc.uniform1f(u.uHueShift, p.hueShift);
      if (!useSoft) {
        const gu = u as typeof displayGlyphsUniforms;
        glc.uniform1f(gu.uGridDensity, p.gridDensity);
        glc.uniform1f(gu.uNotchSize, p.notchSize);
        glc.uniform1i(gu.uGlyphSet, Math.round(p.glyphSet));
      }

      glc.drawArrays(glc.TRIANGLES, 0, 3);

      glc.bindFramebuffer(glc.READ_FRAMEBUFFER, frameWriteFbo);
      glc.bindFramebuffer(glc.DRAW_FRAMEBUFFER, null);
      glc.blitFramebuffer(
        0,
        0,
        w,
        h,
        0,
        0,
        w,
        h,
        glc.COLOR_BUFFER_BIT,
        glc.NEAREST,
      );

      [frameReadTex, frameWriteTex] = [frameWriteTex, frameReadTex];
      [frameReadFbo, frameWriteFbo] = [frameWriteFbo, frameReadFbo];

      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      glc.deleteProgram(simProgram);
      glc.deleteProgram(pluckProgram);
      glc.deleteProgram(ambientProgram);
      glc.deleteProgram(clearWavesProgram);
      glc.deleteProgram(displayGlyphsProgram);
      glc.deleteProgram(displaySoftProgram);
      glc.deleteTexture(texA);
      glc.deleteTexture(texB);
      glc.deleteTexture(frameTexA);
      glc.deleteTexture(frameTexB);
      glc.deleteFramebuffer(fboA);
      glc.deleteFramebuffer(fboB);
      glc.deleteFramebuffer(frameFboA);
      glc.deleteFramebuffer(frameFboB);
      glc.deleteBuffer(vbo);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block" }}
      aria-hidden
    />
  );
}
