"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Mycelium, { MyceliumParams } from "./Mycelium";
import ControlPanel, { Control } from "../_lib/ControlPanel";
import { BACKDROP, backLink, pill } from "../_lib/chrome";

const PALETTE_PRESETS: { name: string; rgb: [number, number, number] }[] = [
  { name: "ash", rgb: [208, 205, 209] },
  { name: "bone", rgb: [232, 230, 226] },
  { name: "ice", rgb: [206, 224, 250] },
  { name: "sunset", rgb: [255, 173, 122] },
  { name: "moss", rgb: [190, 235, 160] },
];

const DEFAULTS: {
  [K in
    | "attractorSpacing"
    | "maxInfluenceDist"
    | "killDist"
    | "stepLength"
    | "tipSpacing"
    | "rootTips"
    | "inertia"
    | "wander"
    | "branchChance"
    | "growthSpeed"
    | "maxNodes"
    | "maxPerTick"
    | "headRadius"
    | "strands"
    | "strandSpread"
    | "dotSize"
    | "threadAlpha"
    | "trunkThickness"
    | "stalledHeads"
    | "grain"
    | "stopAt"]: number;
} & { seedMode: MyceliumParams["seedMode"]; palette: string; loop: boolean } = {
  attractorSpacing: 13,
  maxInfluenceDist: 55,
  killDist: 9,
  stepLength: 2.5,
  tipSpacing: 10.5,
  seedMode: "diagonal",
  rootTips: 9,
  inertia: 0.7,
  wander: 0.12,
  branchChance: 0.3,
  growthSpeed: 0.5,
  maxNodes: 60000,
  maxPerTick: 400,
  headRadius: 6.2,
  strands: 7,
  strandSpread: 6,
  dotSize: 1.3,
  threadAlpha: 0.7,
  trunkThickness: 0.6,
  stalledHeads: 0.08,
  grain: 0.05,
  palette: "ash",
  loop: false,
  stopAt: 1,
};

const STAGE_ASPECT = "720 / 926";

export default function MyceliumPage() {
  const [attractorSpacing, setAttractorSpacing] = useState(
    DEFAULTS.attractorSpacing,
  );
  const [maxInfluenceDist, setMaxInfluenceDist] = useState(
    DEFAULTS.maxInfluenceDist,
  );
  const [killDist, setKillDist] = useState(DEFAULTS.killDist);
  const [stepLength, setStepLength] = useState(DEFAULTS.stepLength);
  const [tipSpacing, setTipSpacing] = useState(DEFAULTS.tipSpacing);
  const [seedMode, setSeedMode] = useState<MyceliumParams["seedMode"]>(
    DEFAULTS.seedMode,
  );
  const [rootTips, setRootTips] = useState(DEFAULTS.rootTips);
  const [inertia, setInertia] = useState(DEFAULTS.inertia);
  const [wander, setWander] = useState(DEFAULTS.wander);
  const [branchChance, setBranchChance] = useState(DEFAULTS.branchChance);
  const [growthSpeed, setGrowthSpeed] = useState(DEFAULTS.growthSpeed);
  const [maxNodes, setMaxNodes] = useState(DEFAULTS.maxNodes);
  const [maxPerTick, setMaxPerTick] = useState(DEFAULTS.maxPerTick);

  const [headRadius, setHeadRadius] = useState(DEFAULTS.headRadius);
  const [strands, setStrands] = useState(DEFAULTS.strands);
  const [strandSpread, setStrandSpread] = useState(DEFAULTS.strandSpread);
  const [dotSize, setDotSize] = useState(DEFAULTS.dotSize);
  const [threadAlpha, setThreadAlpha] = useState(DEFAULTS.threadAlpha);
  const [trunkThickness, setTrunkThickness] = useState(DEFAULTS.trunkThickness);
  const [stalledHeads, setStalledHeads] = useState(DEFAULTS.stalledHeads);
  const [grain, setGrain] = useState(DEFAULTS.grain);
  const [paletteName, setPaletteName] = useState(DEFAULTS.palette);

  const [loop, setLoop] = useState(DEFAULTS.loop);
  const [stopAt, setStopAt] = useState(DEFAULTS.stopAt);
  const [stopped, setStopped] = useState(false);
  const [paused, setPaused] = useState(false);
  const [resetToken, setResetToken] = useState(0);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onFs = () => setIsFullscreen(document.fullscreenElement != null);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  function resetDefaults() {
    setAttractorSpacing(DEFAULTS.attractorSpacing);
    setMaxInfluenceDist(DEFAULTS.maxInfluenceDist);
    setKillDist(DEFAULTS.killDist);
    setStepLength(DEFAULTS.stepLength);
    setTipSpacing(DEFAULTS.tipSpacing);
    setSeedMode(DEFAULTS.seedMode);
    setRootTips(DEFAULTS.rootTips);
    setInertia(DEFAULTS.inertia);
    setWander(DEFAULTS.wander);
    setBranchChance(DEFAULTS.branchChance);
    setGrowthSpeed(DEFAULTS.growthSpeed);
    setMaxNodes(DEFAULTS.maxNodes);
    setMaxPerTick(DEFAULTS.maxPerTick);
    setHeadRadius(DEFAULTS.headRadius);
    setStrands(DEFAULTS.strands);
    setStrandSpread(DEFAULTS.strandSpread);
    setDotSize(DEFAULTS.dotSize);
    setThreadAlpha(DEFAULTS.threadAlpha);
    setTrunkThickness(DEFAULTS.trunkThickness);
    setStalledHeads(DEFAULTS.stalledHeads);
    setGrain(DEFAULTS.grain);
    setPaletteName(DEFAULTS.palette);
    setLoop(DEFAULTS.loop);
    setStopAt(DEFAULTS.stopAt);
    setStopped(false);
    setPaused(false);
    setResetToken((t) => t + 1);
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await stageRef.current?.requestFullscreen();
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "f" || e.key === "F") toggleFullscreen();
      else if (e.key === "h" || e.key === "H") setUiHidden((v) => !v);
      else if (e.key === "s" || e.key === "S") setStopped((v) => !v);
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
    attractorSpacing,
    maxInfluenceDist,
    killDist,
    stepLength,
    tipSpacing,
    seedMode,
    rootTips,
    inertia,
    wander,
    branchChance,
    idleLimit: 6,
    maxNodes,
    maxPerTick,
    growthSpeed,
    headRadius,
    strands,
    strandSpread,
    dotSize,
    threadAlpha,
    trunkThickness,
    stalledHeads,
    grain,
    color: activeColor,
    paused,
    loop,
    holdSeconds: 6,
    stopAt,
    stopped,
  };

  const slider = (
    key: string,
    label: string,
    min: number,
    max: number,
    step: number,
    value: number,
    onChange: (v: number) => void,
  ): Control => ({
    type: "slider",
    key,
    label,
    min,
    max,
    step,
    value,
    onChange,
  });

  const controls: Control[] = [
    {
      type: "buttonGroup",
      key: "actions",
      buttons: [
        {
          label: paused ? "play" : "pause",
          onClick: () => setPaused((v) => !v),
        },
        {
          label: stopped ? "resume" : "stop here",
          onClick: () => setStopped((v) => !v),
        },
        { label: "reset defaults", onClick: resetDefaults },
        {
          label: "regrow",
          onClick: () => {
            setStopped(false);
            setResetToken((t) => t + 1);
          },
        },
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
          options: ["diagonal", "corners", "center", "bottom"],
          onChange: (v) => setSeedMode(v as MyceliumParams["seedMode"]),
        },
        {
          type: "select",
          key: "loop",
          label: "when finished",
          value: loop ? "regrow" : "hold",
          options: ["regrow", "hold"],
          onChange: (v) => setLoop(v === "regrow"),
        },
        slider(
          "stopAt",
          "stop point (1 = run on)",
          0.1,
          1,
          0.05,
          stopAt,
          setStopAt,
        ),
        slider(
          "growthSpeed",
          "growth speed",
          0.1,
          3,
          0.1,
          growthSpeed,
          setGrowthSpeed,
        ),
        slider("rootTips", "tips per seed", 3, 16, 1, rootTips, setRootTips),
        slider(
          "branchChance",
          "branching",
          0,
          0.6,
          0.02,
          branchChance,
          setBranchChance,
        ),
        slider(
          "tipSpacing",
          "tip spacing",
          6,
          20,
          0.5,
          tipSpacing,
          setTipSpacing,
        ),
        slider(
          "attractorSpacing",
          "food spacing",
          8,
          24,
          1,
          attractorSpacing,
          setAttractorSpacing,
        ),
        slider(
          "maxInfluenceDist",
          "influence dist",
          25,
          120,
          5,
          maxInfluenceDist,
          setMaxInfluenceDist,
        ),
        slider("killDist", "kill dist", 3, 20, 1, killDist, setKillDist),
        slider(
          "stepLength",
          "step length",
          1,
          6,
          0.5,
          stepLength,
          setStepLength,
        ),
        slider("inertia", "heading inertia", 0, 0.9, 0.02, inertia, setInertia),
        slider("wander", "wander", 0, 0.6, 0.02, wander, setWander),
        slider(
          "maxNodes",
          "node budget",
          10000,
          80000,
          5000,
          maxNodes,
          setMaxNodes,
        ),
        slider(
          "maxPerTick",
          "max new / step",
          50,
          600,
          50,
          maxPerTick,
          setMaxPerTick,
        ),
      ],
    },
    {
      type: "group",
      key: "lookGroup",
      label: "Look",
      defaultOpen: false,
      controls: [
        slider(
          "headRadius",
          "head size",
          3,
          10,
          0.2,
          headRadius,
          setHeadRadius,
        ),
        slider("strands", "fibres per tip", 1, 10, 1, strands, setStrands),
        slider(
          "strandSpread",
          "fibre spread",
          0,
          14,
          0.5,
          strandSpread,
          setStrandSpread,
        ),
        slider("dotSize", "fibre dot size", 0.6, 3, 0.1, dotSize, setDotSize),
        slider(
          "threadAlpha",
          "fibre brightness",
          0.1,
          1,
          0.05,
          threadAlpha,
          setThreadAlpha,
        ),
        slider(
          "trunkThickness",
          "trunk thickness",
          0,
          1.5,
          0.05,
          trunkThickness,
          setTrunkThickness,
        ),
        slider(
          "stalledHeads",
          "lone heads",
          0,
          0.5,
          0.01,
          stalledHeads,
          setStalledHeads,
        ),
        slider("grain", "grain", 0, 0.2, 0.01, grain, setGrain),
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

  const stageStyle: React.CSSProperties = isFullscreen
    ? {
        width: "min(100%, 1100px, calc((100vh - 150px) * 16 / 10))",
        height: "100vh",
        position: "relative",
        background: "#171318",
      }
    : {
        position: "relative",
        width: "min(100%, 560px, calc((100vh - 150px) * 720 / 926))",
        aspectRatio: STAGE_ASPECT,
        borderRadius: 14,
        overflow: "hidden",
        background: "#171318",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
      };

  return (
    <main
      style={{
        minHeight: "100vh",
        position: "relative",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "72px 16px 56px",
        background: BACKDROP,
      }}
    >
      <div ref={stageRef} style={stageStyle}>
        <div style={{ position: "absolute", inset: 0 }}>
          <Mycelium params={params} resetToken={resetToken} />
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 12,
            right: 12,
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
      </div>

      {!uiHidden && <ControlPanel title="Mycelium" controls={controls} />}

      {!uiHidden && (
        <Link href="/experiments" style={backLink}>
          ← EXPERIMENTS
        </Link>
      )}
    </main>
  );
}
