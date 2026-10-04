"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import WaveField, { RenderMode, RampMode, WaveFieldParams } from "./WaveField";
import ControlPanel, { Control } from "../_lib/ControlPanel";
import { BACKDROP, backLink, pill } from "../_lib/chrome";

const PALETTE_PRESETS: { name: string; rgb: [number, number, number] }[] = [
  { name: "ice", rgb: [214, 232, 255] },
  { name: "mono", rgb: [235, 235, 235] },
  { name: "sunset", rgb: [255, 173, 122] },
  { name: "aegean", rgb: [122, 200, 255] },
  { name: "citrus", rgb: [214, 255, 122] },
];

export default function WaveFieldPage() {
  const [renderMode, setRenderMode] = useState<RenderMode>("glyphs");

  const [bandCount, setBandCount] = useState(3);
  const [frequencyMul, setFrequencyMul] = useState(1);
  const [speedMul, setSpeedMul] = useState(1);
  const [bandWidth, setBandWidth] = useState(0.42);

  const [noiseAmount, setNoiseAmount] = useState(0.55);
  const [noiseScale, setNoiseScale] = useState(1.4);

  const [cellSize, setCellSize] = useState(12);
  const [rampMode, setRampMode] = useState<RampMode>("mixed");
  const [flickerRate, setFlickerRate] = useState(0.15);
  const [paletteName, setPaletteName] = useState("ice");

  const [angleSpread, setAngleSpread] = useState(0.5);
  const [pointSourceMix, setPointSourceMix] = useState(0);
  const [groupiness, setGroupiness] = useState(0);
  const [shoaling, setShoaling] = useState(0);
  const [shading, setShading] = useState(0);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(document.fullscreenElement != null);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  async function toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await containerRef.current?.requestFullscreen();
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      } else if (e.key === "h" || e.key === "H") {
        setUiHidden((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const activeColor =
    PALETTE_PRESETS.find((p) => p.name === paletteName)?.rgb ??
    PALETTE_PRESETS[0].rgb;

  const params: WaveFieldParams = {
    bandCount,
    frequencyMul,
    speedMul,
    bandWidth,
    noiseAmount,
    noiseScale,
    cellSize,
    rampMode,
    flickerRate,
    color: activeColor,
    angleSpread,
    pointSourceMix,
    groupiness,
    shoaling,
    shading,
  };

  const controls: Control[] = [
    {
      type: "group",
      key: "waveGroup",
      label: "Wave",
      defaultOpen: true,
      controls: [
        {
          type: "select",
          key: "renderMode",
          label: "render mode",
          value: renderMode,
          options: ["glyphs", "dots"],
          onChange: (v) => setRenderMode(v as RenderMode),
        },
        {
          type: "slider",
          key: "bandCount",
          label: "wave bands",
          min: 1,
          max: 4,
          step: 1,
          value: bandCount,
          onChange: setBandCount,
        },
        {
          type: "slider",
          key: "frequencyMul",
          label: "frequency",
          min: 0.2,
          max: 3,
          step: 0.05,
          value: frequencyMul,
          onChange: setFrequencyMul,
        },
        {
          type: "slider",
          key: "speedMul",
          label: "speed",
          min: 0,
          max: 3,
          step: 0.05,
          value: speedMul,
          onChange: setSpeedMul,
        },
        {
          type: "slider",
          key: "bandWidth",
          label: "band width",
          min: 0.1,
          max: 1.5,
          step: 0.02,
          value: bandWidth,
          onChange: setBandWidth,
        },
      ],
    },
    {
      type: "group",
      key: "physicsGroup",
      label: "Physics",
      defaultOpen: false,
      controls: [
        {
          type: "slider",
          key: "angleSpread",
          label: "angle spread",
          min: 0,
          max: 1.2,
          step: 0.02,
          value: angleSpread,
          onChange: setAngleSpread,
        },
        {
          type: "slider",
          key: "pointSourceMix",
          label: "point source mix",
          min: 0,
          max: 1,
          step: 0.02,
          value: pointSourceMix,
          onChange: setPointSourceMix,
        },
        {
          type: "slider",
          key: "groupiness",
          label: "groupiness",
          min: 0,
          max: 1,
          step: 0.02,
          value: groupiness,
          onChange: setGroupiness,
        },
        {
          type: "slider",
          key: "shoaling",
          label: "shoaling",
          min: 0,
          max: 1,
          step: 0.02,
          value: shoaling,
          onChange: setShoaling,
        },
        {
          type: "slider",
          key: "shading",
          label: "shading",
          min: 0,
          max: 1,
          step: 0.02,
          value: shading,
          onChange: setShading,
        },
      ],
    },
    {
      type: "group",
      key: "noiseGroup",
      label: "Noise",
      defaultOpen: false,
      controls: [
        {
          type: "slider",
          key: "noiseAmount",
          label: "noise amount",
          min: 0,
          max: 1.5,
          step: 0.02,
          value: noiseAmount,
          onChange: setNoiseAmount,
        },
        {
          type: "slider",
          key: "noiseScale",
          label: "noise scale",
          min: 0.2,
          max: 4,
          step: 0.05,
          value: noiseScale,
          onChange: setNoiseScale,
        },
      ],
    },
    {
      type: "group",
      key: "renderGroup",
      label: "Rendering",
      defaultOpen: false,
      controls: [
        {
          type: "slider",
          key: "cellSize",
          label: "cell / dot spacing",
          min: 4,
          max: 28,
          step: 1,
          value: cellSize,
          onChange: setCellSize,
        },
        ...(renderMode === "glyphs"
          ? ([
              {
                type: "select",
                key: "rampMode",
                label: "character ramp",
                value: rampMode,
                options: ["gradient", "mixed"],
                onChange: (v) => setRampMode(v as RampMode),
              },
              {
                type: "slider",
                key: "flickerRate",
                label: "flicker rate",
                min: 0,
                max: 1,
                step: 0.02,
                value: flickerRate,
                onChange: setFlickerRate,
              },
            ] as Control[])
          : []),
        {
          type: "select",
          key: "palette",
          label: "palette",
          value: paletteName,
          options: PALETTE_PRESETS.map((p) => p.name),
          onChange: setPaletteName,
        },
      ],
    },
  ];

  return (
    <main
      ref={containerRef}
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BACKDROP,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <WaveField renderMode={renderMode} params={params} />
      </div>

      {!uiHidden && <ControlPanel title="Wave Field" controls={controls} />}

      {!uiHidden && (
        <Link href="/experiments" style={backLink}>
          ← EXPERIMENTS
        </Link>
      )}

      <div
        style={{
          position: "absolute",
          bottom: 16,
          right: 16,
          display: "flex",
          gap: 8,
        }}
      >
        <button
          onClick={() => setUiHidden((v) => !v)}
          style={pill}
          title="Toggle UI (H)"
        >
          {uiHidden ? "SHOW UI" : "HIDE UI"}
        </button>
        <button
          onClick={toggleFullscreen}
          style={pill}
          title="Toggle fullscreen (F)"
        >
          {isFullscreen ? "EXIT FULLSCREEN" : "FULLSCREEN"}
        </button>
      </div>
    </main>
  );
}
