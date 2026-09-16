"use client";

import { useState } from "react";
import Link from "next/link";
import RippleInterferenceShader, {
  FieldMode,
  FIELD_MODES,
  IQPalette,
  RippleSource,
} from "./RippleInterferenceShader";
import ControlPanel, { Control } from "../_lib/ControlPanel";

const PALETTES: Record<string, IQPalette> = {
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

const DEFAULT_SOURCES: RippleSource[] = [
  { x: 0.68, y: 0.22, frequency: 0.055, speed: 0.5, amplitude: 1 },
  { x: 0.28, y: 0.86, frequency: 0.048, speed: -0.4, amplitude: 0.85 },
];

function rgbToHex([r, g, b]: [number, number, number]) {
  const h = (n: number) =>
    Math.round(Math.max(0, Math.min(1, n)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function hexToRgb01(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [
    parseInt(c.substring(0, 2), 16) / 255,
    parseInt(c.substring(2, 4), 16) / 255,
    parseInt(c.substring(4, 6), 16) / 255,
  ];
}

export default function RippleInterferenceShaderPage() {
  const [paletteName, setPaletteName] = useState<string>("coral");
  const [sources, setSources] = useState<RippleSource[]>(DEFAULT_SOURCES);
  const [rippleStrength, setRippleStrength] = useState(0.16);
  const [driftSpeed, setDriftSpeed] = useState(0.12);
  const [causticStrength, setCausticStrength] = useState(0.5);
  const [grainAmount, setGrainAmount] = useState(0.06);
  const [sourceCount, setSourceCount] = useState(2);

  const [fieldMode, setFieldMode] = useState<FieldMode>("sine");
  const [axisMix, setAxisMix] = useState(0);
  const [contrast, setContrast] = useState(1);
  const [causticColor, setCausticColor] = useState<[number, number, number]>([
    1, 1, 1,
  ]);
  const [falloff, setFalloff] = useState(0.004);
  const [timeScale, setTimeScale] = useState(1);
  const [vignette, setVignette] = useState(0);

  function updateSource(index: number, patch: Partial<RippleSource>) {
    setSources((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
  }

  function setCount(n: number) {
    setSourceCount(n);
    setSources((prev) => {
      const next = [...prev];
      while (next.length < n) {
        next.push({
          x: Math.random(),
          y: Math.random(),
          frequency: 0.04 + Math.random() * 0.03,
          speed: (Math.random() - 0.5) * 1.2,
          amplitude: 0.7 + Math.random() * 0.3,
        });
      }
      return next.slice(0, n);
    });
  }

  const controls: Control[] = [
    {
      type: "select",
      key: "palette",
      label: "palette",
      value: paletteName,
      options: Object.keys(PALETTES),
      onChange: setPaletteName,
    },
    {
      type: "select",
      key: "fieldMode",
      label: "field mode",
      value: fieldMode,
      options: FIELD_MODES,
      onChange: (v: string) => setFieldMode(v as FieldMode),
    },
    {
      type: "slider",
      key: "sourceCount",
      label: "sources",
      min: 1,
      max: 8,
      step: 1,
      value: sourceCount,
      onChange: setCount,
    },
    {
      type: "slider",
      key: "timeScale",
      label: "time scale",
      min: 0,
      max: 3,
      step: 0.05,
      value: timeScale,
      onChange: setTimeScale,
    },
    {
      type: "group",
      key: "shape",
      label: "shape",
      controls: [
        {
          type: "slider",
          key: "rippleStrength",
          label: "ripple strength",
          min: 0,
          max: 0.4,
          step: 0.01,
          value: rippleStrength,
          onChange: setRippleStrength,
        },
        {
          type: "slider",
          key: "contrast",
          label: "contrast",
          min: 0.3,
          max: 3,
          step: 0.05,
          value: contrast,
          onChange: setContrast,
        },
        {
          type: "slider",
          key: "axisMix",
          label: "axis (vert to horiz)",
          min: 0,
          max: 1,
          step: 0.01,
          value: axisMix,
          onChange: setAxisMix,
        },
        {
          type: "slider",
          key: "driftSpeed",
          label: "drift speed",
          min: 0,
          max: 0.6,
          step: 0.01,
          value: driftSpeed,
          onChange: setDriftSpeed,
        },
        {
          type: "slider",
          key: "falloff",
          label: "falloff (decay mode)",
          min: 0,
          max: 0.02,
          step: 0.0005,
          value: falloff,
          onChange: setFalloff,
        },
      ],
    },
    {
      type: "group",
      key: "finish",
      label: "finish",
      controls: [
        {
          type: "slider",
          key: "causticStrength",
          label: "caustic brightness",
          min: 0,
          max: 1.5,
          step: 0.05,
          value: causticStrength,
          onChange: setCausticStrength,
        },
        {
          type: "color",
          key: "causticColor",
          label: "caustic colour",
          value: rgbToHex(causticColor),
          onChange: (hex: string) => setCausticColor(hexToRgb01(hex)),
        },
        {
          type: "slider",
          key: "grainAmount",
          label: "grain",
          min: 0,
          max: 0.2,
          step: 0.005,
          value: grainAmount,
          onChange: setGrainAmount,
        },
        {
          type: "slider",
          key: "vignette",
          label: "vignette",
          min: 0,
          max: 1,
          step: 0.02,
          value: vignette,
          onChange: setVignette,
        },
      ],
    },
    {
      type: "buttonGroup",
      key: "randomise",
      buttons: [
        {
          label: "randomise sources",
          onClick: () =>
            setSources((prev) =>
              prev.map(() => ({
                x: Math.random(),
                y: Math.random(),
                frequency: 0.02 + Math.random() * 0.07,
                speed: (Math.random() - 0.5) * 3,
                amplitude: 0.6 + Math.random() * 0.4,
              })),
            ),
        },
      ],
    },
    ...sources.map<Control>((s, i) => ({
      type: "group",
      key: `source-group-${i}`,
      label: `source ${i + 1}`,
      defaultOpen: false,
      controls: [
        {
          type: "slider",
          key: `s${i}-x`,
          label: "x",
          min: 0,
          max: 1,
          step: 0.01,
          value: s.x,
          onChange: (v: number) => updateSource(i, { x: v }),
        },
        {
          type: "slider",
          key: `s${i}-y`,
          label: "y",
          min: 0,
          max: 1,
          step: 0.01,
          value: s.y,
          onChange: (v: number) => updateSource(i, { y: v }),
        },
        {
          type: "slider",
          key: `s${i}-freq`,
          label: "frequency",
          min: 0.02,
          max: 0.09,
          step: 0.001,
          value: s.frequency,
          onChange: (v: number) => updateSource(i, { frequency: v }),
        },
        {
          type: "slider",
          key: `s${i}-speed`,
          label: "speed",
          min: -1.5,
          max: 1.5,
          step: 0.05,
          value: s.speed,
          onChange: (v: number) => updateSource(i, { speed: v }),
        },
        {
          type: "slider",
          key: `s${i}-amplitude`,
          label: "amplitude",
          min: 0.1,
          max: 1.5,
          step: 0.05,
          value: s.amplitude,
          onChange: (v: number) => updateSource(i, { amplitude: v }),
        },
      ],
    })),
  ];

  return (
    <main style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <RippleInterferenceShader
        palette={PALETTES[paletteName]}
        sources={sources}
        rippleStrength={rippleStrength}
        driftSpeed={driftSpeed}
        causticStrength={causticStrength}
        grainAmount={grainAmount}
        fieldMode={fieldMode}
        axisMix={axisMix}
        contrast={contrast}
        causticColor={causticColor}
        falloff={falloff}
        timeScale={timeScale}
        vignette={vignette}
      />
      <ControlPanel title="Ripple Interference (shader)" controls={controls} />
      <Link
        href="/experiments"
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          color: "black",
          fontFamily: "monospace",
          fontSize: 11,
          letterSpacing: "0.08em",
          textDecoration: "none",
        }}
      >
        ← EXPERIMENTS
      </Link>
    </main>
  );
}
