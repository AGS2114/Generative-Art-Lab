"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Mycelium, { MyceliumParams } from "./Mycelium";
import ControlPanel, { Control } from "../_lib/ControlPanel";
import { BACKDROP, backLink, pill } from "../_lib/chrome";

const PALETTE_PRESETS: { name: string; rgb: [number, number, number] }[] = [
  { name: "bone", rgb: [232, 230, 226] },
  { name: "ice", rgb: [214, 232, 255] },
  { name: "sunset", rgb: [255, 173, 122] },
  { name: "moss", rgb: [190, 235, 160] },
];

export default function MyceliumPage() {
  // growth
  const [attractionCount, setAttractionCount] = useState(2000);
  const [maxInfluenceDist, setMaxInfluenceDist] = useState(150);
  const [killDist, setKillDist] = useState(12);
  const [stepLength, setStepLength] = useState(2.5);
  const [seedMode, setSeedMode] =
    useState<MyceliumParams["seedMode"]>("corners");
  const [inertia, setInertia] = useState(0.82);
  const [wander, setWander] = useState(0.14);
  const [growthSpeed, setGrowthSpeed] = useState(1);
  const [maxNodes, setMaxNodes] = useState(30000);
  const [maxPerTick, setMaxPerTick] = useState(200);

  // look
  const [tipDots, setTipDots] = useState(7);
  const [tipRadius, setTipRadius] = useState(7);
  const [dotSize, setDotSize] = useState(1.2);
  const [threadAlpha, setThreadAlpha] = useState(0.22);
  const [threadSpread, setThreadSpread] = useState(7);
  const [trunkThickness, setTrunkThickness] = useState(0.8);
  const [jitter, setJitter] = useState(1.2);
  const [paletteName, setPaletteName] = useState("bone");

  const [paused, setPaused] = useState(false);
  const [resetToken, setResetToken] = useState(0);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onFs = () => setIsFullscreen(document.fullscreenElement != null);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  async function toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await containerRef.current?.requestFullscreen();
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "f" || e.key === "F") toggleFullscreen();
      else if (e.key === "h" || e.key === "H") setUiHidden((v) => !v);
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((v) => !v);
      } else if (e.key === "r" || e.key === "R") setResetToken((t) => t + 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const activeColor =
    PALETTE_PRESETS.find((p) => p.name === paletteName)?.rgb ??
    PALETTE_PRESETS[0].rgb;

  const params: MyceliumParams = {
    attractionCount,
    maxInfluenceDist,
    killDist,
    stepLength,
    seedMode,
    inertia,
    wander,
    growthSpeed,
    maxNodes,
    maxPerTick,
    tipDots,
    tipRadius,
    dotSize,
    threadAlpha,
    threadSpread,
    trunkThickness,
    jitter,
    color: activeColor,
    paused,
  };

  const controls: Control[] = [
    {
      type: "buttonGroup",
      key: "actions",
      buttons: [
        {
          label: paused ? "play" : "pause",
          onClick: () => setPaused((v) => !v),
        },
        { label: "regrow", onClick: () => setResetToken((t) => t + 1) },
      ],
    },
    {
      type: "group",
      key: "growthGroup",
      label: "Growth",
      defaultOpen: true,
      controls: [
        {
          type: "select",
          key: "seedMode",
          label: "seed layout",
          value: seedMode,
          options: ["corners", "center", "bottom"],
          onChange: (v) => setSeedMode(v as MyceliumParams["seedMode"]),
        },
        {
          type: "slider",
          key: "maxNodes",
          label: "node budget",
          min: 5000,
          max: 80000,
          step: 5000,
          value: maxNodes,
          onChange: setMaxNodes,
        },
        {
          type: "slider",
          key: "maxPerTick",
          label: "max new / step",
          min: 20,
          max: 600,
          step: 20,
          value: maxPerTick,
          onChange: setMaxPerTick,
        },
        {
          type: "slider",
          key: "growthSpeed",
          label: "growth speed",
          min: 1,
          max: 8,
          step: 1,
          value: growthSpeed,
          onChange: setGrowthSpeed,
        },
        {
          type: "slider",
          key: "attractionCount",
          label: "attraction points",
          min: 400,
          max: 4000,
          step: 100,
          value: attractionCount,
          onChange: setAttractionCount,
        },
        {
          type: "slider",
          key: "maxInfluenceDist",
          label: "influence dist",
          min: 30,
          max: 160,
          step: 5,
          value: maxInfluenceDist,
          onChange: setMaxInfluenceDist,
        },
        {
          type: "slider",
          key: "killDist",
          label: "kill dist",
          min: 2,
          max: 30,
          step: 1,
          value: killDist,
          onChange: setKillDist,
        },
        {
          type: "slider",
          key: "stepLength",
          label: "step length",
          min: 1,
          max: 8,
          step: 0.5,
          value: stepLength,
          onChange: setStepLength,
        },
        {
          type: "slider",
          key: "inertia",
          label: "heading inertia",
          min: 0,
          max: 0.9,
          step: 0.02,
          value: inertia,
          onChange: setInertia,
        },
        {
          type: "slider",
          key: "wander",
          label: "wander",
          min: 0,
          max: 0.6,
          step: 0.02,
          value: wander,
          onChange: setWander,
        },
      ],
    },
    {
      type: "group",
      key: "lookGroup",
      label: "Look",
      defaultOpen: false,
      controls: [
        {
          type: "slider",
          key: "tipDots",
          label: "tip dots",
          min: 1,
          max: 14,
          step: 1,
          value: tipDots,
          onChange: setTipDots,
        },
        {
          type: "slider",
          key: "tipRadius",
          label: "tip radius",
          min: 1,
          max: 14,
          step: 0.5,
          value: tipRadius,
          onChange: setTipRadius,
        },
        {
          type: "slider",
          key: "dotSize",
          label: "dot size",
          min: 0.6,
          max: 4,
          step: 0.1,
          value: dotSize,
          onChange: setDotSize,
        },
        {
          type: "slider",
          key: "threadAlpha",
          label: "wake threads",
          min: 0,
          max: 0.9,
          step: 0.02,
          value: threadAlpha,
          onChange: setThreadAlpha,
        },
        {
          type: "slider",
          key: "threadSpread",
          label: "thread spread",
          min: 0,
          max: 20,
          step: 0.5,
          value: threadSpread,
          onChange: setThreadSpread,
        },
        {
          type: "slider",
          key: "trunkThickness",
          label: "trunk thickening",
          min: 0,
          max: 1,
          step: 0.02,
          value: trunkThickness,
          onChange: setTrunkThickness,
        },
        {
          type: "slider",
          key: "jitter",
          label: "dot jitter",
          min: 0,
          max: 4,
          step: 0.1,
          value: jitter,
          onChange: setJitter,
        },
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
        <Mycelium params={params} resetToken={resetToken} />
      </div>

      {!uiHidden && <ControlPanel title="Mycelium" controls={controls} />}

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
