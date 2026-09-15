"use client";

import { useState } from "react";
import Link from "next/link";
import MultiRippleInterference, {
  FieldMode,
  GradientStop,
  RippleSource,
} from "./MultiRippleInterference";
import ControlPanel, { Control } from "../_lib/ControlPanel";

const PALETTES: Record<string, GradientStop[]> = {
  coral: [
    { pos: 0.0, color: [255, 236, 224] },
    { pos: 0.3, color: [255, 138, 101] },
    { pos: 0.55, color: [230, 57, 90] },
    { pos: 0.75, color: [173, 40, 90] },
    { pos: 1.0, color: [70, 200, 220] },
  ],
  pastel: [
    { pos: 0.0, color: [250, 230, 235] },
    { pos: 0.3, color: [230, 200, 245] },
    { pos: 0.55, color: [200, 220, 250] },
    { pos: 0.8, color: [225, 245, 220] },
    { pos: 1.0, color: [250, 240, 210] },
  ],
  flame: [
    { pos: 0.0, color: [255, 245, 230] },
    { pos: 0.3, color: [255, 170, 60] },
    { pos: 0.6, color: [235, 90, 40] },
    { pos: 1.0, color: [200, 30, 60] },
  ],
  sunset: [
    { pos: 0.0, color: [12, 38, 46] },
    { pos: 0.16, color: [22, 82, 92] },
    { pos: 0.36, color: [214, 96, 68] },
    { pos: 0.5, color: [232, 158, 96] },
    { pos: 0.66, color: [186, 156, 78] },
    { pos: 0.84, color: [224, 198, 120] },
    { pos: 1.0, color: [46, 40, 20] },
  ],
  aegean: [
    { pos: 0.0, color: [8, 16, 28] },
    { pos: 0.2, color: [18, 44, 68] },
    { pos: 0.4, color: [40, 92, 118] },
    { pos: 0.52, color: [214, 184, 128] },
    { pos: 0.65, color: [64, 100, 108] },
    { pos: 0.85, color: [14, 28, 38] },
    { pos: 1.0, color: [6, 10, 16] },
  ],
  dusk: [
    { pos: 0.0, color: [18, 14, 36] },
    { pos: 0.16, color: [58, 32, 84] },
    { pos: 0.36, color: [148, 64, 128] },
    { pos: 0.5, color: [222, 120, 140] },
    { pos: 0.66, color: [236, 168, 108] },
    { pos: 0.84, color: [178, 118, 68] },
    { pos: 1.0, color: [36, 22, 20] },
  ],
  citrus: [
    { pos: 0.0, color: [14, 40, 20] },
    { pos: 0.16, color: [64, 128, 48] },
    { pos: 0.36, color: [172, 208, 68] },
    { pos: 0.5, color: [244, 210, 84] },
    { pos: 0.66, color: [238, 150, 60] },
    { pos: 0.84, color: [210, 96, 48] },
    { pos: 1.0, color: [42, 24, 16] },
  ],
  ice: [
    { pos: 0.0, color: [10, 22, 40] },
    { pos: 0.16, color: [24, 66, 98] },
    { pos: 0.36, color: [72, 138, 168] },
    { pos: 0.5, color: [186, 224, 232] },
    { pos: 0.66, color: [128, 176, 196] },
    { pos: 0.84, color: [48, 88, 116] },
    { pos: 1.0, color: [10, 18, 28] },
  ],
  // Near-greyscale with a single warm accent band - the ripple structure
  // reads as form rather than colour, which suits the print-like stills.
  mono: [
    { pos: 0.0, color: [18, 18, 20] },
    { pos: 0.35, color: [120, 120, 124] },
    { pos: 0.55, color: [228, 228, 230] },
    { pos: 0.72, color: [196, 92, 60] },
    { pos: 1.0, color: [28, 26, 26] },
  ],
  neon: [
    { pos: 0.0, color: [18, 6, 42] },
    { pos: 0.25, color: [126, 22, 168] },
    { pos: 0.45, color: [232, 44, 142] },
    { pos: 0.65, color: [64, 224, 230] },
    { pos: 0.85, color: [126, 92, 240] },
    { pos: 1.0, color: [16, 8, 36] },
  ],
  terracotta: [
    { pos: 0.0, color: [46, 28, 22] },
    { pos: 0.22, color: [124, 62, 40] },
    { pos: 0.45, color: [196, 106, 66] },
    { pos: 0.65, color: [226, 158, 104] },
    { pos: 0.85, color: [150, 120, 86] },
    { pos: 1.0, color: [52, 36, 26] },
  ],
  nebula: [
    { pos: 0.0, color: [4, 4, 14] },
    { pos: 0.28, color: [38, 20, 78] },
    { pos: 0.5, color: [122, 44, 138] },
    { pos: 0.68, color: [226, 110, 150] },
    { pos: 0.84, color: [148, 196, 232] },
    { pos: 1.0, color: [6, 6, 18] },
  ],
};

const FIELD_MODE_OPTIONS: FieldMode[] = [
  "sine",
  "cosine",
  "abs",
  "squared",
  "decay",
];

const DEFAULT_SOURCES: RippleSource[] = [
  { x: 0.68, y: 0.22, frequency: 0.055, speed: 0.5, amplitude: 1 },
  { x: 0.28, y: 0.86, frequency: 0.048, speed: -0.4, amplitude: 0.85 },
];

function rgbToHex([r, g, b]: [number, number, number]) {
  const h = (n: number) => Math.round(n).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [
    parseInt(c.substring(0, 2), 16),
    parseInt(c.substring(2, 4), 16),
    parseInt(c.substring(4, 6), 16),
  ];
}

export default function RippleInterferenceMultiPage() {
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
    255, 255, 255,
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
      options: FIELD_MODE_OPTIONS,
      onChange: (v: string) => setFieldMode(v as FieldMode),
    },
    {
      type: "slider",
      key: "sourceCount",
      label: "sources",
      min: 1,
      max: 4,
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
          onChange: (hex: string) => setCausticColor(hexToRgb(hex)),
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
      key: "randomize",
      buttons: [
        {
          label: "randomize sources",
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
    // Each source's sliders live inside their own collapsible group,
    // collapsed by default, instead of five flat sliders per source.
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
      <MultiRippleInterference
        stops={PALETTES[paletteName]}
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
      <ControlPanel title="Ripple Interference (multi)" controls={controls} />
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
