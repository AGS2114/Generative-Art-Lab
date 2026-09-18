"use client";

import { useEffect, useRef } from "react";
import { useResizeObserver } from "../_lib/useResizeObserver";

export interface GlyphFieldParams {
  waveSpeed: number;
  damping: number;
  stepsPerFrame: number;
  gridDensity: number;
  glow: number;
  notchSize: number;
  trail: number;
  tint: number;
  hueShift: number;
  glyphSet: number;
  activityMode: number;
}

interface GlyphFieldProps {
  params?: Partial<GlyphFieldParams>;
  seedToken?: number;
  resetToken?: number;
  clearWavesToken?: number;
  presetObstacleToken?: { id: string; active: boolean; nonce: number };
  autoCycle?: boolean;
}

const DEFAULT_PARAMS: GlyphFieldParams = {
  waveSpeed: 0.5,
  damping: 0.002,
  stepsPerFrame: 2,
  gridDensity: 90,
  glow: 0.08,
  notchSize: 0.28,
  trail: 0.35,
  tint: 0.5,
  hueShift: 0,
  glyphSet: 0,
  activityMode: 0,
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

vec3 sampleState(vec2 uv) {
  return texture(uState, fract(uv)).rgb;
}

float neighborHeight(vec3 neighbor, float centerH) {
  return mix(neighbor.r, centerH, neighbor.b);
}

void main() {
  vec3 c = sampleState(vUv);
  float h = c.r;
  float vel = c.g;
  float obstacle = c.b;

  vec3 nR = sampleState(vUv + vec2(uTexel.x, 0.0));
  vec3 nL = sampleState(vUv - vec2(uTexel.x, 0.0));
  vec3 nU = sampleState(vUv + vec2(0.0, uTexel.y));
  vec3 nD = sampleState(vUv - vec2(0.0, uTexel.y));

  float lap =
    neighborHeight(nR, h) +
    neighborHeight(nL, h) +
    neighborHeight(nU, h) +
    neighborHeight(nD, h) -
    4.0 * h;

  float accel = uWaveSpeed * uWaveSpeed * lap;
  vel += accel * uDt;
  vel *= (1.0 - uDamping);
  h += vel * uDt;

  h = clamp(h, -1.0, 1.0);

  h = mix(h, 0.0, obstacle);
  vel = mix(vel, 0.0, obstacle);

  fragColor = vec4(h, vel, obstacle, 1.0);
}
`;

const SEED_FRAGMENT_SRC = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform float uSeed;
uniform int uActivityMode;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(41.3, 289.1)) + uSeed) * 43758.5453123);
}

void main() {
  float h = 0.0;
  int sourceCount = uActivityMode == 1 ? 14 : 8;
  float blobRadius = uActivityMode == 1 ? 0.09 : 0.05;

  for (int i = 0; i < 14; i++) {
    if (i >= sourceCount) break;
    float fi = float(i);
    float side = step(0.5, hash(vec2(fi, 23.1)));
    float xLocal = hash(vec2(fi, 1.7)) * 0.32;
    float x = mix(0.04 + xLocal, 0.64 + xLocal, side);
    float y = hash(vec2(fi, 9.3));
    vec2 center = vec2(x, y);

    float d = distance(vUv, center);
    float blob = smoothstep(blobRadius, 0.0, d);
    h = max(h, blob);
  }

  fragColor = vec4(h, 0.0, 0.0, 1.0);
}
`;

const CLEAR_OBSTACLES_FRAGMENT_SRC = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uState;

void main() {
  vec3 c = texture(uState, vUv).rgb;
  fragColor = vec4(c.r, c.g, 0.0, 1.0);
}
`;

const CLEAR_WAVES_FRAGMENT_SRC = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uState;

void main() {
  vec3 c = texture(uState, vUv).rgb;
  fragColor = vec4(0.0, 0.0, c.b, 1.0);
}
`;

const OBSTACLE_PRESET_FRAGMENT_SRC = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uState;
uniform int uPresetId;

void main() {
  vec3 c = texture(uState, vUv).rgb;
  vec2 p = vUv - 0.5;
  float r = length(p);
  float ang = atan(p.y, p.x);
  float obs = 0.0;

  if (uPresetId == 1) {
    float spiral = mod(ang - 3.5 * log(r + 0.001), 3.14159 / 2.0);
    float spiralMask = smoothstep(0.12, 0.04, abs(spiral - 0.4));
    float ringBound = step(0.06, r) * step(r, 0.42);
    obs = spiralMask * ringBound;
  } else if (uPresetId == 2) {
    float wallX = smoothstep(0.02, 0.0, abs(p.x));
    float slit1 = step(0.04, abs(p.y - 0.12));
    float slit2 = step(0.04, abs(p.y + 0.12));
    obs = wallX * slit1 * slit2;
  } else if (uPresetId == 3) {
    float rings = abs(sin(r * 32.0));
    float ringMask = smoothstep(0.85, 0.95, rings);
    float gap = step(0.2, abs(sin(ang * 3.0)));
    obs = ringMask * gap * step(r, 0.44);
  } else if (uPresetId == 4) {
    vec2 grid = abs(fract(vUv * 8.0) - 0.5);
    float lines = step(0.42, max(grid.x, grid.y));
    float centerClear = step(0.1, r);
    obs = lines * centerClear;
  }

  float h = mix(c.r, 0.0, step(0.5, obs));
  float vel = mix(c.g, 0.0, step(0.5, obs));
  fragColor = vec4(h, vel, max(c.b, obs), 1.0);
}
`;

const PLUCK_FRAGMENT_SRC = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uState;
uniform vec2 uPluckPos;
uniform float uPluckStrength;

void main() {
  vec3 c = texture(uState, vUv).rgb;
  float d = distance(vUv, uPluckPos);
  float blob = smoothstep(0.045, 0.0, d) * uPluckStrength * (1.0 - c.b);
  float h = clamp(c.r + blob, -1.0, 1.0);
  fragColor = vec4(h, c.g, c.b, 1.0);
}
`;

const OBSTACLE_FRAGMENT_SRC = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uState;
uniform vec2 uObstaclePos;
uniform float uObstacleRadius;

void main() {
  vec3 c = texture(uState, vUv).rgb;
  float d = distance(vUv, uObstaclePos);
  float stamp = smoothstep(uObstacleRadius, uObstacleRadius * 0.7, d);
  float obstacle = max(c.b, stamp);
  float h = mix(c.r, 0.0, stamp);
  float vel = mix(c.g, 0.0, stamp);
  fragColor = vec4(h, vel, obstacle, 1.0);
}
`;

const DISPLAY_FRAGMENT_SRC = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSimState;
uniform sampler2D uPrevFrame;
uniform vec2 uResolution;
uniform float uGridDensity;
uniform float uGlow;
uniform float uNotchSize;
uniform float uTime;
uniform float uTrail;
uniform float uTint;
uniform float uHueShift;
uniform int uGlyphSet;
uniform int uActivityMode;

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

float sdSegment(vec2 p, vec2 a, vec2 b, float w) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - w;
}

float sdGlyphI(vec2 p, float h, float w) {
  float stem = sdSegment(p, vec2(0.0, -h), vec2(0.0, h), w);
  float top = sdSegment(p, vec2(-h * 0.55, h), vec2(h * 0.55, h), w);
  float bot = sdSegment(p, vec2(-h * 0.55, -h), vec2(h * 0.55, -h), w);
  return min(stem, min(top, bot));
}

float sdGlyphT(vec2 p, float h, float w) {
  float top = sdSegment(p, vec2(-h, h), vec2(h, h), w);
  float stem = sdSegment(p, vec2(0.0, h), vec2(0.0, -h), w);
  return min(top, stem);
}

float sdGlyphX(vec2 p, float h, float w) {
  float d1 = sdSegment(p, vec2(-h, -h), vec2(h, h), w);
  float d2 = sdSegment(p, vec2(-h, h), vec2(h, -h), w);
  return min(d1, d2);
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

float fillWithGlow(float d, float glowAmt) {
  float core = 1.0 - smoothstep(-glowAmt * 0.4, glowAmt * 0.4, d);
  float halo = 1.0 - smoothstep(0.0, glowAmt * 2.2, max(d, 0.0));
  return clamp(core + halo * 0.35, 0.0, 1.0);
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
  vec3 stateHere = texture(uSimState, cellCenterUv).rgb;
  float v = abs(stateHere.r);
  float isObstacle = step(0.5, stateHere.b);

  bool busy = uActivityMode == 1;
  float t0 = busy ? 0.012 : 0.035;
  float t1 = busy ? 0.045 : 0.12;
  float t2 = busy ? 0.1 : 0.24;
  float t3 = busy ? 0.18 : 0.4;

  float glow = uGlow;
  vec3 col = vec3(0.02, 0.02, 0.03);

  float bgDot = sdCircle(localUv, busy ? 0.035 : 0.045);
  float bgFill = fillWithGlow(bgDot, glow * (busy ? 0.5 : 0.6)) * (busy ? 0.1 : 0.14);
  col += vec3(bgFill);

  vec3 coolTint = hueRotate(vec3(0.75, 0.85, 1.0), uHueShift);
  vec3 warmTint = hueRotate(vec3(1.05, 0.92, 0.78), uHueShift);
  vec3 hueMix = mix(coolTint, warmTint, smoothstep(0.0, busy ? 0.24 : 0.55, v));
  vec3 tintFactor = mix(vec3(1.0), hueMix, uTint);

  if (v > t0) {
    float shapeMix = smoothstep(t0, t1, v);
    float d;
    if (uGlyphSet == 1) {
      float h = mix(0.05, 0.13, shapeMix);
      d = sdGlyphI(localUv, h, h * 0.22);
    } else if (uGlyphSet == 2) {
      float r = mix(0.05, 0.12, shapeMix);
      d = sdRing(localUv, r, r * 0.35);
    } else if (uGlyphSet == 3) {
      float r = mix(0.055, 0.12, shapeMix);
      vec2 q = abs(localUv);
      d = (q.x + q.y) - r;
    } else {
      d = sdCircle(localUv, mix(0.045, 0.11, shapeMix));
    }
    float fill = fillWithGlow(d, glow);
    col = mix(col, vec3(0.65, 0.7, 0.74) * tintFactor, fill);
  }

  if (v > t1) {
    float shapeMix = smoothstep(t1, t2, v);
    float d;
    if (uGlyphSet == 1) {
      float h = mix(0.08, 0.15, shapeMix);
      d = sdGlyphT(localUv, h, h * 0.22);
    } else if (uGlyphSet == 2) {
      float r = mix(0.08, 0.15, shapeMix);
      d = sdHexagon(localUv, r);
    } else if (uGlyphSet == 3) {
      float len = mix(0.1, 0.2, shapeMix);
      d = sdSegment(localUv, vec2(-len, 0.0), vec2(len, 0.0), len * 0.28);
    } else {
      float size = mix(0.1, 0.18, shapeMix);
      d = sdRoundBox(localUv, vec2(size), size * 0.18);
    }
    float fill = fillWithGlow(d, glow);
    col = mix(col, vec3(0.72, 0.74, 0.76) * tintFactor, fill);
  }

  if (v > t2) {
    float shapeMix = smoothstep(t2, t3, v);
    float d;
    if (uGlyphSet == 1) {
      float h = mix(0.1, 0.19, shapeMix);
      d = sdGlyphX(localUv, h, h * 0.24);
    } else if (uGlyphSet == 2) {
      float baseR = mix(0.1, 0.19, shapeMix);
      float ang = atan(localUv.y, localUv.x);
      float wobble = 1.0 + 0.18 * sin(ang * 5.0 + hash(cellId) * 6.28);
      d = length(localUv) - baseR * wobble;
    } else if (uGlyphSet == 3) {
      float barLen = mix(0.09, 0.16, shapeMix);
      d = sdRoundBox(localUv, vec2(barLen, barLen * 0.4), barLen * 0.15);
    } else {
      float barLen = mix(0.11, 0.22, shapeMix);
      d = sdCross(localUv, barLen, barLen * 0.32);
    }
    float fill = fillWithGlow(d, glow);
    col = mix(col, vec3(0.85, 0.87, 0.88) * tintFactor, fill);
  }

  if (v > t3) {
    float shapeMix = smoothstep(t3, 1.0, v);
    float size = mix(0.2, 0.32, shapeMix);
    float d;
    if (uGlyphSet == 2) {
      d = sdHexagon(localUv, size);
    } else {
      d = sdRoundBox(localUv, vec2(size), size * 0.12);
    }
    float fill = fillWithGlow(d, glow);
    vec3 solid = vec3(0.95, 0.96, 0.97) * tintFactor;

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

  if (isObstacle > 0.5) {
    float wallD = sdRoundBox(localUv, vec2(0.42), 0.06);
    float wallFill = fillWithGlow(wallD, glow * 0.6);
    col = mix(col, vec3(0.18, 0.19, 0.21), wallFill);
  }

  vec3 prevCol = texture(uPrevFrame, fragUv).rgb;
  vec3 decayed = prevCol * (0.86 * uTrail);
  col = max(col, decayed);

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
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
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
    Math.max(1, w),
    Math.max(1, h),
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

const AUTO_CYCLE_WAYPOINTS: Array<{ waveSpeed: number; damping: number }> = [
  { waveSpeed: 0.5, damping: 0.002 },
  { waveSpeed: 0.3, damping: 0.01 },
  { waveSpeed: 0.9, damping: 0.001 },
  { waveSpeed: 0.5, damping: 0.0005 },
];
const AUTO_CYCLE_SECONDS_PER_LEG = 14;

export default function GlyphField({
  params: paramOverrides,
  seedToken = 0,
  resetToken = 0,
  clearWavesToken = 0,
  presetObstacleToken,
  autoCycle = false,
}: GlyphFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const sizeRef = useRef({ w: 1, h: 1 });

  const paramsRef = useRef<GlyphFieldParams>({
    ...DEFAULT_PARAMS,
    ...paramOverrides,
  });
  paramsRef.current = { ...DEFAULT_PARAMS, ...paramOverrides };

  const autoCycleRef = useRef(autoCycle);
  autoCycleRef.current = autoCycle;

  const seedRequestRef = useRef(0);
  useEffect(() => {
    seedRequestRef.current += 1;
  }, [seedToken]);

  const resetRequestRef = useRef(0);
  useEffect(() => {
    resetRequestRef.current += 1;
  }, [resetToken]);

  const clearWavesRequestRef = useRef(0);
  useEffect(() => {
    clearWavesRequestRef.current += 1;
  }, [clearWavesToken]);

  const presetRequestRef = useRef<{
    id: string;
    active: boolean;
    nonce: number;
  } | null>(null);
  useEffect(() => {
    if (presetObstacleToken) {
      presetRequestRef.current = presetObstacleToken;
    }
  }, [presetObstacleToken]);

  const activityModeForEffect =
    paramOverrides?.activityMode ?? DEFAULT_PARAMS.activityMode;
  useEffect(() => {
    seedRequestRef.current += 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityModeForEffect]);

  const pointerRef = useRef<{
    down: boolean;
    x: number;
    y: number;
    pending: boolean;
    placingObstacle: boolean;
  }>({ down: false, x: 0.5, y: 0.5, pending: false, placingObstacle: false });

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
      pointerRef.current.placingObstacle = e.shiftKey;
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
    const seedProgram = createProgram(gl, VERTEX_SRC, SEED_FRAGMENT_SRC);
    const clearObstaclesProgram = createProgram(
      gl,
      VERTEX_SRC,
      CLEAR_OBSTACLES_FRAGMENT_SRC,
    );
    const clearWavesProgram = createProgram(
      gl,
      VERTEX_SRC,
      CLEAR_WAVES_FRAGMENT_SRC,
    );
    const presetProgram = createProgram(
      gl,
      VERTEX_SRC,
      OBSTACLE_PRESET_FRAGMENT_SRC,
    );
    const pluckProgram = createProgram(gl, VERTEX_SRC, PLUCK_FRAGMENT_SRC);
    const obstacleProgram = createProgram(
      gl,
      VERTEX_SRC,
      OBSTACLE_FRAGMENT_SRC,
    );
    const displayProgram = createProgram(gl, VERTEX_SRC, DISPLAY_FRAGMENT_SRC);
    if (
      !simProgram ||
      !seedProgram ||
      !clearObstaclesProgram ||
      !clearWavesProgram ||
      !presetProgram ||
      !pluckProgram ||
      !obstacleProgram ||
      !displayProgram
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

    function seed(seedValue: number) {
      glc.useProgram(seedProgram);
      glc.bindFramebuffer(glc.FRAMEBUFFER, readFbo);
      glc.viewport(0, 0, SIM_SIZE, SIM_SIZE);
      bindPosAttrib(seedProgram!);
      glc.uniform1f(glc.getUniformLocation(seedProgram!, "uSeed"), seedValue);
      glc.uniform1i(
        glc.getUniformLocation(seedProgram!, "uActivityMode"),
        Math.round(paramsRef.current.activityMode),
      );
      glc.drawArrays(glc.TRIANGLES, 0, 3);
    }

    function clearObstacles() {
      glc.useProgram(clearObstaclesProgram);
      glc.bindFramebuffer(glc.FRAMEBUFFER, writeFbo);
      glc.viewport(0, 0, SIM_SIZE, SIM_SIZE);
      bindPosAttrib(clearObstaclesProgram!);

      glc.activeTexture(glc.TEXTURE0);
      glc.bindTexture(glc.TEXTURE_2D, readTex);
      glc.uniform1i(
        glc.getUniformLocation(clearObstaclesProgram!, "uState"),
        0,
      );

      glc.drawArrays(glc.TRIANGLES, 0, 3);

      [readTex, writeTex] = [writeTex, readTex];
      [readFbo, writeFbo] = [writeFbo, readFbo];
    }

    function clearWaves() {
      glc.useProgram(clearWavesProgram);
      glc.bindFramebuffer(glc.FRAMEBUFFER, writeFbo);
      glc.viewport(0, 0, SIM_SIZE, SIM_SIZE);
      bindPosAttrib(clearWavesProgram!);

      glc.activeTexture(glc.TEXTURE0);
      glc.bindTexture(glc.TEXTURE_2D, readTex);
      glc.uniform1i(glc.getUniformLocation(clearWavesProgram!, "uState"), 0);

      glc.drawArrays(glc.TRIANGLES, 0, 3);

      [readTex, writeTex] = [writeTex, readTex];
      [readFbo, writeFbo] = [writeFbo, readFbo];

      glc.bindFramebuffer(glc.FRAMEBUFFER, frameReadFbo);
      glc.viewport(0, 0, frameTexW, frameTexH);
      glc.clearColor(0, 0, 0, 1);
      glc.clear(glc.COLOR_BUFFER_BIT);
      glc.bindFramebuffer(glc.FRAMEBUFFER, frameWriteFbo);
      glc.viewport(0, 0, frameTexW, frameTexH);
      glc.clearColor(0, 0, 0, 1);
      glc.clear(glc.COLOR_BUFFER_BIT);
    }

    function applyObstaclePreset(id: number) {
      glc.useProgram(presetProgram);
      glc.bindFramebuffer(glc.FRAMEBUFFER, writeFbo);
      glc.viewport(0, 0, SIM_SIZE, SIM_SIZE);
      bindPosAttrib(presetProgram!);

      glc.activeTexture(glc.TEXTURE0);
      glc.bindTexture(glc.TEXTURE_2D, readTex);
      glc.uniform1i(glc.getUniformLocation(presetProgram!, "uState"), 0);
      glc.uniform1i(glc.getUniformLocation(presetProgram!, "uPresetId"), id);

      glc.drawArrays(glc.TRIANGLES, 0, 3);

      [readTex, writeTex] = [writeTex, readTex];
      [readFbo, writeFbo] = [writeFbo, readFbo];
    }

    seed(seedRequestRef.current + Math.random() * 1000);

    function pluck(uv: { x: number; y: number }, strength: number) {
      glc.useProgram(pluckProgram);
      glc.bindFramebuffer(glc.FRAMEBUFFER, writeFbo);
      glc.viewport(0, 0, SIM_SIZE, SIM_SIZE);
      bindPosAttrib(pluckProgram!);
      glc.activeTexture(glc.TEXTURE0);
      glc.bindTexture(glc.TEXTURE_2D, readTex);
      glc.uniform1i(glc.getUniformLocation(pluckProgram!, "uState"), 0);
      glc.uniform2f(
        glc.getUniformLocation(pluckProgram!, "uPluckPos"),
        uv.x,
        uv.y,
      );
      glc.uniform1f(
        glc.getUniformLocation(pluckProgram!, "uPluckStrength"),
        strength,
      );
      glc.drawArrays(glc.TRIANGLES, 0, 3);

      [readTex, writeTex] = [writeTex, readTex];
      [readFbo, writeFbo] = [writeFbo, readFbo];
    }

    function stampObstacle(uv: { x: number; y: number }, radius: number) {
      glc.useProgram(obstacleProgram);
      glc.bindFramebuffer(glc.FRAMEBUFFER, writeFbo);
      glc.viewport(0, 0, SIM_SIZE, SIM_SIZE);
      bindPosAttrib(obstacleProgram!);
      glc.activeTexture(glc.TEXTURE0);
      glc.bindTexture(glc.TEXTURE_2D, readTex);
      glc.uniform1i(glc.getUniformLocation(obstacleProgram!, "uState"), 0);
      glc.uniform2f(
        glc.getUniformLocation(obstacleProgram!, "uObstaclePos"),
        uv.x,
        uv.y,
      );
      glc.uniform1f(
        glc.getUniformLocation(obstacleProgram!, "uObstacleRadius"),
        radius,
      );
      glc.drawArrays(glc.TRIANGLES, 0, 3);

      [readTex, writeTex] = [writeTex, readTex];
      [readFbo, writeFbo] = [writeFbo, readFbo];
    }

    const simUniforms = {
      uState: glc.getUniformLocation(simProgram, "uState"),
      uTexel: glc.getUniformLocation(simProgram, "uTexel"),
      uWaveSpeed: glc.getUniformLocation(simProgram, "uWaveSpeed"),
      uDamping: glc.getUniformLocation(simProgram, "uDamping"),
      uDt: glc.getUniformLocation(simProgram, "uDt"),
    };

    const displayUniforms = {
      uSimState: glc.getUniformLocation(displayProgram, "uSimState"),
      uPrevFrame: glc.getUniformLocation(displayProgram, "uPrevFrame"),
      uResolution: glc.getUniformLocation(displayProgram, "uResolution"),
      uGridDensity: glc.getUniformLocation(displayProgram, "uGridDensity"),
      uGlow: glc.getUniformLocation(displayProgram, "uGlow"),
      uNotchSize: glc.getUniformLocation(displayProgram, "uNotchSize"),
      uTime: glc.getUniformLocation(displayProgram, "uTime"),
      uTrail: glc.getUniformLocation(displayProgram, "uTrail"),
      uTint: glc.getUniformLocation(displayProgram, "uTint"),
      uHueShift: glc.getUniformLocation(displayProgram, "uHueShift"),
      uGlyphSet: glc.getUniformLocation(displayProgram, "uGlyphSet"),
      uActivityMode: glc.getUniformLocation(displayProgram, "uActivityMode"),
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
    let lastSeedRequest = seedRequestRef.current;
    let lastResetRequest = resetRequestRef.current;
    let lastClearWavesRequest = clearWavesRequestRef.current;
    let lastPresetNonce = -1;
    let cycleT = 0;

    function stepSim(waveSpeed: number, damping: number) {
      glc.useProgram(simProgram);
      glc.bindFramebuffer(glc.FRAMEBUFFER, writeFbo);
      glc.viewport(0, 0, SIM_SIZE, SIM_SIZE);
      bindPosAttrib(simProgram!);

      glc.activeTexture(glc.TEXTURE0);
      glc.bindTexture(glc.TEXTURE_2D, readTex);
      glc.uniform1i(simUniforms.uState, 0);
      glc.uniform2f(simUniforms.uTexel, 1 / SIM_SIZE, 1 / SIM_SIZE);

      glc.uniform1f(simUniforms.uWaveSpeed, waveSpeed);
      glc.uniform1f(simUniforms.uDamping, damping);
      glc.uniform1f(simUniforms.uDt, 1.0);

      glc.drawArrays(glc.TRIANGLES, 0, 3);

      [readTex, writeTex] = [writeTex, readTex];
      [readFbo, writeFbo] = [writeFbo, readFbo];
    }

    function frame(now: number) {
      if (cancelled) return;
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      elapsed += dt;

      if (resetRequestRef.current !== lastResetRequest) {
        lastResetRequest = resetRequestRef.current;
        clearObstacles();
      }

      if (clearWavesRequestRef.current !== lastClearWavesRequest) {
        lastClearWavesRequest = clearWavesRequestRef.current;
        clearWaves();
      }

      if (
        presetRequestRef.current &&
        presetRequestRef.current.nonce !== lastPresetNonce
      ) {
        lastPresetNonce = presetRequestRef.current.nonce;
        clearObstacles();
        if (presetRequestRef.current.active) {
          const idMap: Record<string, number> = {
            spiral: 1,
            doubleSlit: 2,
            rings: 3,
            labyrinth: 4,
          };
          const presetId = idMap[presetRequestRef.current.id] || 1;
          applyObstaclePreset(presetId);
        }
      }

      if (seedRequestRef.current !== lastSeedRequest) {
        lastSeedRequest = seedRequestRef.current;
        seed(lastSeedRequest + Math.random() * 1000);
      }

      if (pointerRef.current.pending) {
        pointerRef.current.pending = false;
        const uv = {
          x: pointerRef.current.x,
          y: pointerRef.current.y,
        };
        if (pointerRef.current.placingObstacle) {
          stampObstacle(uv, 0.035);
        } else {
          pluck(uv, 0.85);
        }
      }

      const p = { ...paramsRef.current };

      if (autoCycleRef.current) {
        cycleT += dt;
        const legT = cycleT / AUTO_CYCLE_SECONDS_PER_LEG;
        const n = AUTO_CYCLE_WAYPOINTS.length;
        const idx = Math.floor(legT) % n;
        const nextIdx = (idx + 1) % n;
        const localT = legT - Math.floor(legT);
        const smooth = localT * localT * (3 - 2 * localT);
        const a = AUTO_CYCLE_WAYPOINTS[idx];
        const b = AUTO_CYCLE_WAYPOINTS[nextIdx];
        p.waveSpeed = a.waveSpeed + (b.waveSpeed - a.waveSpeed) * smooth;
        p.damping = a.damping + (b.damping - a.damping) * smooth;
      }

      for (let i = 0; i < p.stepsPerFrame; i++) {
        stepSim(p.waveSpeed, p.damping);
      }

      const { w, h } = sizeRef.current;
      resizeFrameTexIfNeeded(w, h);

      glc.bindFramebuffer(glc.FRAMEBUFFER, frameWriteFbo);
      glc.viewport(0, 0, w, h);
      glc.useProgram(displayProgram);
      bindPosAttrib(displayProgram!);

      glc.activeTexture(glc.TEXTURE0);
      glc.bindTexture(glc.TEXTURE_2D, readTex);
      glc.uniform1i(displayUniforms.uSimState, 0);

      glc.activeTexture(glc.TEXTURE1);
      glc.bindTexture(glc.TEXTURE_2D, frameReadTex);
      glc.uniform1i(displayUniforms.uPrevFrame, 1);

      glc.uniform2f(displayUniforms.uResolution, w, h);
      glc.uniform1f(displayUniforms.uGridDensity, p.gridDensity);
      glc.uniform1f(displayUniforms.uGlow, p.glow);
      glc.uniform1f(displayUniforms.uNotchSize, p.notchSize);
      glc.uniform1f(displayUniforms.uTime, elapsed);
      glc.uniform1f(displayUniforms.uTrail, p.trail);
      glc.uniform1f(displayUniforms.uTint, p.tint);
      glc.uniform1f(displayUniforms.uHueShift, p.hueShift);
      glc.uniform1i(displayUniforms.uGlyphSet, Math.round(p.glyphSet));
      glc.uniform1i(displayUniforms.uActivityMode, Math.round(p.activityMode));

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
      glc.deleteProgram(seedProgram);
      glc.deleteProgram(clearObstaclesProgram);
      glc.deleteProgram(clearWavesProgram);
      glc.deleteProgram(presetProgram);
      glc.deleteProgram(pluckProgram);
      glc.deleteProgram(obstacleProgram);
      glc.deleteProgram(displayProgram);
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
