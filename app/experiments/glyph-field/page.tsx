"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import GlyphField, { GlyphFieldParams } from "./GlyphField";
import ControlPanel, { Control } from "../_lib/ControlPanel";

const PRESETS: Record<string, Partial<GlyphFieldParams>> = {
  ripple: { waveSpeed: 0.5, damping: 0.002 },
  calm: { waveSpeed: 0.3, damping: 0.01 },
  frantic: { waveSpeed: 0.9, damping: 0.001 },
  lingering: { waveSpeed: 0.5, damping: 0.0005 },
};

const GLYPH_SETS: Record<string, number> = {
  geometric: 0,
  alphanumeric: 1,
  organic: 2,
  "dots & lines": 3,
};

export default function GlyphFieldPage() {
  const [preset, setPreset] = useState("ripple");
  const [waveSpeed, setWaveSpeed] = useState(PRESETS.ripple.waveSpeed!);
  const [damping, setDamping] = useState(PRESETS.ripple.damping!);
  const [gridDensity, setGridDensity] = useState(46);
  const [glow, setGlow] = useState(0.08);
  const [notchSize, setNotchSize] = useState(0.28);
  const [stepsPerFrame, setStepsPerFrame] = useState(2);
  const [trail, setTrail] = useState(0.35);
  const [tint, setTint] = useState(0.5);
  const [hueShift, setHueShift] = useState(0);
  const [glyphSetName, setGlyphSetName] = useState("geometric");
  const [activityMode, setActivityMode] = useState(0);
  const [autoCycle, setAutoCycle] = useState(false);
  const [seedToken, setSeedToken] = useState(0);
  const [resetToken, setResetToken] = useState(0);
  const [clearWavesToken, setClearWavesToken] = useState(0);
  const [activeObstaclePreset, setActiveObstaclePreset] = useState<
    string | null
  >(null);
  const [presetObstacleToken, setPresetObstacleToken] = useState<{
    id: string;
    active: boolean;
    nonce: number;
  }>({ id: "", active: false, nonce: 0 });
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

  function applyPreset(name: string) {
    setPreset(name);
    const p = PRESETS[name];
    if (p.waveSpeed !== undefined) setWaveSpeed(p.waveSpeed);
    if (p.damping !== undefined) setDamping(p.damping);
  }

  function toggleObstaclePreset(id: string) {
    if (activeObstaclePreset === id) {
      setActiveObstaclePreset(null);
      setPresetObstacleToken({ id, active: false, nonce: Date.now() });
    } else {
      setActiveObstaclePreset(id);
      setPresetObstacleToken({ id, active: true, nonce: Date.now() });
    }
  }

  function handleClearWalls() {
    setActiveObstaclePreset(null);
    setResetToken((t) => t + 1);
  }

  function handleResetBoard() {
    setClearWavesToken((t) => t + 1);
  }

  function handleShuffleColors() {
    setHueShift(Math.random());
    setTint(0.35 + Math.random() * 0.55);
    setGlow(0.05 + Math.random() * 0.1);
  }

  const controls: Control[] = [
    {
      type: "group",
      key: "simGroup",
      label: "Simulation",
      defaultOpen: true,
      controls: [
        {
          type: "select",
          key: "preset",
          label: "pattern preset",
          value: preset,
          options: Object.keys(PRESETS),
          onChange: applyPreset,
        },
        {
          type: "slider",
          key: "waveSpeed",
          label: "wave speed",
          min: 0.1,
          max: 1.2,
          step: 0.01,
          value: waveSpeed,
          onChange: setWaveSpeed,
        },
        {
          type: "slider",
          key: "damping",
          label: "damping",
          min: 0.0002,
          max: 0.02,
          step: 0.0002,
          value: damping,
          onChange: setDamping,
        },
        {
          type: "slider",
          key: "stepsPerFrame",
          label: "sim speed",
          min: 1,
          max: 8,
          step: 1,
          value: stepsPerFrame,
          onChange: setStepsPerFrame,
        },
        {
          type: "buttonGroup",
          key: "autoCycle",
          buttons: [
            {
              label: autoCycle ? "auto-cycle: on" : "auto-cycle: off",
              onClick: () => setAutoCycle((v) => !v),
            },
          ],
        },
      ],
    },
    {
      type: "group",
      key: "glyphGroup",
      label: "Grid & Glyphs",
      defaultOpen: false,
      controls: [
        {
          type: "select",
          key: "glyphSet",
          label: "glyph set",
          value: glyphSetName,
          options: Object.keys(GLYPH_SETS),
          onChange: setGlyphSetName,
        },
        {
          type: "slider",
          key: "gridDensity",
          label: "grid density",
          min: 30,
          max: 160,
          step: 1,
          value: gridDensity,
          onChange: setGridDensity,
        },
        {
          type: "slider",
          key: "notchSize",
          label: "notch size",
          min: 0,
          max: 0.6,
          step: 0.02,
          value: notchSize,
          onChange: setNotchSize,
        },
        {
          type: "buttonGroup",
          key: "activityMode",
          buttons: [
            {
              label: activityMode === 1 ? "field: busy" : "field: sparse",
              onClick: () => setActivityMode((v) => (v === 1 ? 0 : 1)),
            },
          ],
        },
      ],
    },
    {
      type: "group",
      key: "visualGroup",
      label: "Visual Style",
      defaultOpen: false,
      controls: [
        {
          type: "slider",
          key: "glow",
          label: "glyph glow",
          min: 0.02,
          max: 0.2,
          step: 0.005,
          value: glow,
          onChange: setGlow,
        },
        {
          type: "slider",
          key: "trail",
          label: "trail persistence",
          min: 0,
          max: 0.85,
          step: 0.01,
          value: trail,
          onChange: setTrail,
        },
        {
          type: "slider",
          key: "tint",
          label: "color tint",
          min: 0,
          max: 1,
          step: 0.02,
          value: tint,
          onChange: setTint,
        },
        {
          type: "slider",
          key: "hueShift",
          label: "hue shift",
          min: 0,
          max: 1,
          step: 0.01,
          value: hueShift,
          onChange: setHueShift,
        },
        {
          type: "buttonGroup",
          key: "colorActions",
          buttons: [
            {
              label: "shuffle colours",
              onClick: handleShuffleColors,
            },
          ],
        },
      ],
    },
    {
      type: "group",
      key: "actionsGroup",
      label: "Field Actions",
      defaultOpen: true,
      controls: [
        {
          type: "buttonGroup",
          key: "presetWalls",
          buttons: [
            {
              label:
                activeObstaclePreset === "spiral"
                  ? "[spiral galaxy]"
                  : "spiral galaxy",
              onClick: () => toggleObstaclePreset("spiral"),
            },
            {
              label:
                activeObstaclePreset === "doubleSlit"
                  ? "[double slit]"
                  : "double slit",
              onClick: () => toggleObstaclePreset("doubleSlit"),
            },
            {
              label: activeObstaclePreset === "rings" ? "[rings]" : "rings",
              onClick: () => toggleObstaclePreset("rings"),
            },
            {
              label:
                activeObstaclePreset === "labyrinth"
                  ? "[labyrinth]"
                  : "labyrinth",
              onClick: () => toggleObstaclePreset("labyrinth"),
            },
          ],
        },
        {
          type: "buttonGroup",
          key: "actions",
          buttons: [
            {
              label: "reseed field",
              onClick: () => setSeedToken((t) => t + 1),
            },
            {
              label: "reset board (waves only)",
              onClick: handleResetBoard,
            },
            {
              label: "clear walls",
              onClick: handleClearWalls,
            },
          ],
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
        background: "#050505",
      }}
    >
      <div
        style={{
          width: "45vw",
          height: "80vh",
          maxWidth: "45vw",
          maxHeight: "80vh",
          position: "relative",
          overflow: "hidden",
          borderRadius: 4,
          boxShadow: "0 0 0 1px rgba(255,255,255,0.08)",
        }}
      >
        <GlyphField
          seedToken={seedToken}
          resetToken={resetToken}
          clearWavesToken={clearWavesToken}
          presetObstacleToken={presetObstacleToken}
          autoCycle={autoCycle}
          params={{
            waveSpeed,
            damping,
            gridDensity,
            glow,
            notchSize,
            stepsPerFrame,
            trail,
            tint,
            hueShift,
            glyphSet: GLYPH_SETS[glyphSetName],
            activityMode,
          }}
        />
      </div>
      {!uiHidden && (
        <ControlPanel
          title="Glyph Field (wave interference)"
          controls={controls}
        />
      )}

      {!uiHidden && (
        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: 16,
            color: "rgba(255,255,255,0.35)",
            fontFamily: "monospace",
            fontSize: 10,
            letterSpacing: "0.06em",
          }}
        >
          click / drag to pluck · shift+click / drag to place a wall
        </div>
      )}

      {!uiHidden && (
        <Link
          href="/experiments"
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            color: "rgba(255,255,255,0.35)",
            fontFamily: "monospace",
            fontSize: 11,
            letterSpacing: "0.08em",
            textDecoration: "none",
          }}
        >
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
          style={{
            background: "transparent",
            border: "1px solid rgba(0,0,0,0.25)",
            color: "black",
            fontFamily: "monospace",
            fontSize: 10,
            letterSpacing: "0.06em",
            padding: "6px 10px",
            borderRadius: 2,
            cursor: "pointer",
          }}
          title="Toggle UI (H)"
        >
          {uiHidden ? "SHOW UI" : "HIDE UI"}
        </button>
        <button
          onClick={toggleFullscreen}
          style={{
            background: "transparent",
            border: "1px solid rgba(0,0,0,0.25)",
            color: "black",
            fontFamily: "monospace",
            fontSize: 10,
            letterSpacing: "0.06em",
            padding: "6px 10px",
            borderRadius: 2,
            cursor: "pointer",
          }}
          title="Toggle fullscreen (F)"
        >
          {isFullscreen ? "EXIT FULLSCREEN" : "FULLSCREEN"}
        </button>
      </div>
    </main>
  );
}
