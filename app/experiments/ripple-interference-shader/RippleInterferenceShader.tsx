"use client";

import { useEffect, useRef } from "react";
import { useResizeObserver } from "../_lib/useResizeObserver";

export interface IQPalette {
  a: [number, number, number];
  b: [number, number, number];
  c: [number, number, number];
  d: [number, number, number];
}

export interface RippleSource {
  x: number;
  y: number;
  frequency: number;
  speed: number;
  amplitude: number;
}

/** Matches the CPU version's FieldMode; index order must match FIELD_MODES below */
export type FieldMode = "sine" | "cosine" | "abs" | "squared" | "decay";

export const FIELD_MODES: FieldMode[] = [
  "sine",
  "cosine",
  "abs",
  "squared",
  "decay",
];

interface RippleShaderProps {
  palette?: IQPalette;
  sources?: RippleSource[];
  /** How strongly the summed ripple field displaces the palette sample point. */
  rippleStrength?: number;
  /** Slow overall gradient drift, independent of the ripple. */
  driftSpeed?: number;
  /** Brightens pixels where the field's local gradient is steep. */
  causticStrength?: number;
  /** 0-1 amount of per-pixel luminance grain overlaid on the result. */
  grainAmount?: number;
  /** Wave shape used per source before summing. */
  fieldMode?: FieldMode;
  /** 0 = gradient runs top-to-bottom, 1 = left-to-right, 0.5 = diagonal. */
  axisMix?: number;
  /** Power curve on the eased displacement. >1 flattens, <1 exaggerates banding. */
  contrast?: number;
  /** Normalised 0-1 RGB the caustic highlights blend toward. */
  causticColor?: [number, number, number];
  /** Distance attenuation used by the `decay` field mode. */
  falloff?: number;
  /** Global multiplier on animation speed. 0 freezes the frame. */
  timeScale?: number;
  /** 0-1 edge darkening. 0 disables. */
  vignette?: number;
}

const MAX_SOURCES = 8;

const DEFAULT_PALETTE: IQPalette = {
  a: [0.45, 0.42, 0.38],
  b: [0.45, 0.4, 0.35],
  c: [1.0, 0.9, 0.7],
  d: [0.0, 0.15, 0.35],
};

const DEFAULT_SOURCES: RippleSource[] = [
  { x: 0.68, y: 0.22, frequency: 0.055, speed: 0.5, amplitude: 1 },
  { x: 0.28, y: 0.86, frequency: 0.048, speed: -0.4, amplitude: 0.85 },
];

const VERTEX_SRC = `#version 300 es
in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

// Every pixel is computed independently, in parallel, on the GPU - no step/downsample hack needed the way the CPU canvas version
// required to stay smooth at full resolution.
const FRAGMENT_SRC = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform float uRippleStrength;
uniform float uDriftSpeed;
uniform float uCausticStrength;
uniform float uGrainAmount;
uniform int uSourceCount;
uniform vec4 uSources[${MAX_SOURCES}]; // x, y (pixels), frequency, speed
uniform float uAmplitudes[${MAX_SOURCES}];
uniform float uMaxAmp;
uniform vec3 uPalA;
uniform vec3 uPalB;
uniform vec3 uPalC;
uniform vec3 uPalD;
uniform int uFieldMode;
uniform float uAxisMix;
uniform float uContrast;
uniform vec3 uCausticColor;
uniform float uFalloff;
uniform float uVignette;

out vec4 fragColor;

// Inigo Quilez cosine-based palette: a + b * cos(2*pi*(c*t + d))
vec3 iqPalette(float t) {
  return uPalA + uPalB * cos(6.28318530718 * (uPalC * t + uPalD));
}

// Wave shape per source. Index order matches FIELD_MODES in the TS file
float shape(float phase, float dist) {
  if (uFieldMode == 1) return cos(phase);
  if (uFieldMode == 2) return abs(sin(phase)) * 2.0 - 1.0;
  if (uFieldMode == 3) { float s = sin(phase); return s * s * 2.0 - 1.0; }
  if (uFieldMode == 4) return sin(phase) / (1.0 + dist * uFalloff);
  return sin(phase);
}

float field(vec2 p, float t) {
  float sum = 0.0;
  for (int i = 0; i < ${MAX_SOURCES}; i++) {
    if (i >= uSourceCount) break;
    vec4 s = uSources[i];
    float dist = distance(p, s.xy);
    sum += shape(dist * s.z - t * s.w, dist) * uAmplitudes[i];
  }
  return sum;
}

// Cheap hash for per-pixel, per-frame grain
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
  vec2 fragPx = gl_FragCoord.xy;
  float t = uTime;

  float drift = sin(t * uDriftSpeed) * 0.05
    + sin(t * uDriftSpeed * 0.47 + 1.3) * 0.02;

  float raw = field(fragPx, t);
  float norm = raw / max(uMaxAmp, 0.0001);

  float eased01 = norm * 0.5 + 0.5;
  float eased = eased01 * eased01 * (3.0 - 2.0 * eased01);
  if (abs(uContrast - 1.0) > 0.001) {
    float centred = eased - 0.5;
    eased = 0.5 + sign(centred) * pow(abs(centred) * 2.0, uContrast) * 0.5;
  }
  float displacement = (eased - 0.5) * 2.0 * uRippleStrength;

  // gl_FragCoord.y has its origin at the bottom of the viewport and increases upward, whereas the CPU canvas version's y is a top-down
  // pixel coordinate. Flip here so baseT=0 is the top of the frame in both versions and the palette isn't read upside-down.
  float vertical = 1.0 - fragPx.y / uResolution.y;
  float horizontal = fragPx.x / uResolution.x;
  float baseT = mix(vertical, horizontal, uAxisMix) + drift;
  vec3 col = iqPalette(baseT + displacement);

  // Caustic term: steep local slope of the field => bright cusp
  float sampleStep = 3.0;
  float fx1 = field(fragPx + vec2(sampleStep, 0.0), t);
  float fy1 = field(fragPx + vec2(0.0, sampleStep), t);
  float gradMag = abs(fx1 - raw) + abs(fy1 - raw);
  float caustic = min(1.0, gradMag * 0.35) * uCausticStrength;

  col = mix(col, uCausticColor, caustic);

  if (uVignette > 0.0) {
    vec2 centred = (fragPx / uResolution) - 0.5;
    float d = length(centred) / 0.7071;
    col *= 1.0 - uVignette * d * d;
  }

  if (uGrainAmount > 0.0) {
    float n = (hash(fragPx + fract(t) * 97.0) - 0.5) * uGrainAmount;
    col += n;
  }

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
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

/**
 * RippleInterferenceShader: the same summed multi-source ripple field, caustic pass, grain, and vignette as the CPU canvas version, but
 * evaluated per-pixel on the GPU via a WebGL2 fragment shader instead of a JS loop over an ImageData buffer. Every pixel is independent, so
 * there's no need for the CPU version's step=2 block-fill downsampling - it renders at full backing-store resolution every frame.
 *
 * Color comes from an Inigo Quilez-style cosine palette (a + b*cos(2*pi*(c*t+d))) rather than interpolated gradient stops,
 * which is what lets it wrap and wash between hues continuously instead of being locked to a handful of fixed stops.
 */
export default function RippleInterferenceShader({
  palette = DEFAULT_PALETTE,
  sources = DEFAULT_SOURCES,
  rippleStrength = 0.16,
  driftSpeed = 0.12,
  causticStrength = 0.5,
  grainAmount = 0.06,
  fieldMode = "sine",
  axisMix = 0,
  contrast = 1,
  causticColor = [1, 1, 1],
  falloff = 0.004,
  timeScale = 1,
  vignette = 0,
}: RippleShaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const uniformsRef = useRef<Record<string, WebGLUniformLocation | null>>({});
  const sizeRef = useRef({ w: 1, h: 1 });

  // Keep latest prop values available inside the rAF loop without re-creating the GL program on every render.
  const propsRef = useRef({
    palette,
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
  });
  propsRef.current = {
    palette,
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
  };

  useResizeObserver(canvasRef, (w, h) => {
    sizeRef.current = { w, h };
    const gl = glRef.current;
    if (gl) gl.viewport(0, 0, w, h);
  });

  // One-time GL setup.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", { antialias: false });
    if (!gl) {
      console.error("WebGL2 is not available in this browser.");
      return;
    }
    glRef.current = gl;

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    // Full-screen triangle - no vertex buffer of quads needed, the fragment shader does all the work.
    const posLoc = gl.getAttribLocation(program, "aPos");
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const names = [
      "uResolution",
      "uTime",
      "uRippleStrength",
      "uDriftSpeed",
      "uCausticStrength",
      "uGrainAmount",
      "uSourceCount",
      "uSources",
      "uAmplitudes",
      "uMaxAmp",
      "uPalA",
      "uPalB",
      "uPalC",
      "uPalD",
      "uFieldMode",
      "uAxisMix",
      "uContrast",
      "uCausticColor",
      "uFalloff",
      "uVignette",
    ];
    const u: Record<string, WebGLUniformLocation | null> = {};
    for (const n of names) u[n] = gl.getUniformLocation(program, n);
    uniformsRef.current = u;

    let rafId = 0;
    let cancelled = false;
    // Same dt-clamp approach as useCanvasLoop (cap at 1/30s so a backgrounded tab or dropped frame never pops on resume),
    // reimplemented here rather than reused directly because useCanvasLoop hands back a 2D context - this sketch owns a
    // WebGL2 context and drives its own uniform uploads per frame.
    let last = performance.now();
    let elapsed = 0;

    const sourceVec = new Float32Array(MAX_SOURCES * 4);
    const amps = new Float32Array(MAX_SOURCES);

    function frame(now: number) {
      if (cancelled) return;
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;

      const p = propsRef.current;
      elapsed += dt * p.timeScale;

      const { w, h } = sizeRef.current;
      const uu = uniformsRef.current;

      gl!.uniform2f(uu.uResolution, w, h);
      gl!.uniform1f(uu.uTime, elapsed);
      gl!.uniform1f(uu.uRippleStrength, p.rippleStrength);
      gl!.uniform1f(uu.uDriftSpeed, p.driftSpeed);
      gl!.uniform1f(uu.uCausticStrength, p.causticStrength);
      gl!.uniform1f(uu.uGrainAmount, p.grainAmount);
      gl!.uniform1i(
        uu.uFieldMode,
        Math.max(0, FIELD_MODES.indexOf(p.fieldMode)),
      );
      gl!.uniform1f(uu.uAxisMix, p.axisMix);
      gl!.uniform1f(uu.uContrast, p.contrast);
      gl!.uniform3f(
        uu.uCausticColor,
        p.causticColor[0],
        p.causticColor[1],
        p.causticColor[2],
      );
      gl!.uniform1f(uu.uFalloff, p.falloff);
      gl!.uniform1f(uu.uVignette, p.vignette);

      const count = Math.min(p.sources.length, MAX_SOURCES);
      sourceVec.fill(0);
      amps.fill(0);
      let maxAmp = 0;
      for (let i = 0; i < count; i++) {
        const s = p.sources[i];
        sourceVec[i * 4 + 0] = s.x * w;
        sourceVec[i * 4 + 1] = (1 - s.y) * h;
        sourceVec[i * 4 + 2] = s.frequency;
        sourceVec[i * 4 + 3] = s.speed;
        amps[i] = s.amplitude ?? 1;
        maxAmp += s.amplitude ?? 1;
      }
      gl!.uniform1i(uu.uSourceCount, count);
      gl!.uniform4fv(uu.uSources, sourceVec);
      gl!.uniform1fv(uu.uAmplitudes, amps);
      gl!.uniform1f(uu.uMaxAmp, maxAmp);

      const pal = p.palette;
      gl!.uniform3f(uu.uPalA, pal.a[0], pal.a[1], pal.a[2]);
      gl!.uniform3f(uu.uPalB, pal.b[0], pal.b[1], pal.b[2]);
      gl!.uniform3f(uu.uPalC, pal.c[0], pal.c[1], pal.c[2]);
      gl!.uniform3f(uu.uPalD, pal.d[0], pal.d[1], pal.d[2]);

      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(vbo);
    };
    // Intentionally run once - per-frame values are read from propsRef.
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block" }}
      aria-hidden
    />
  );
}
