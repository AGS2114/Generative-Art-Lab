"use client";

import { useState } from "react";
import Link from "next/link";
import RippleInterferenceShader, {
  FieldMode,
  FIELD_MODES,
  RippleSource,
} from "./RippleInterferenceShader";
import ControlPanel, { Control } from "../_lib/ControlPanel";
import {
  PALETTES,
  DEFAULT_PALETTE,
  DEFAULT_SOURCES,
  DEFAULTS,
} from "./defaults";

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
  const [paletteName, setPaletteName] = useState<string>(DEFAULT_PALETTE);
  const [sources, setSources] = useState<RippleSource[]>(DEFAULT_SOURCES);
  const [rippleStrength, setRippleStrength] = useState(DEFAULTS.rippleStrength);
  const [driftSpeed, setDriftSpeed] = useState(DEFAULTS.driftSpeed);
  const [causticStrength, setCausticStrength] = useState(
    DEFAULTS.causticStrength,
  );
  const [grainAmount, setGrainAmount] = useState(DEFAULTS.grainAmount);
  const [sourceCount, setSourceCount] = useState(DEFAULT_SOURCES.length);

  const [fieldMode, setFieldMode] = useState<FieldMode>(DEFAULTS.fieldMode);
  const [axisMix, setAxisMix] = useState(DEFAULTS.axisMix);
  const [contrast, setContrast] = useState(DEFAULTS.contrast);
  const [causticColor, setCausticColor] = useState<[number, number, number]>(
    DEFAULTS.causticColor,
  );
  const [falloff, setFalloff] = useState(DEFAULTS.falloff);
  const [timeScale, setTimeScale] = useState(DEFAULTS.timeScale);
  const [vignette, setVignette] = useState(DEFAULTS.vignette);

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
