"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import SonicField, { NoteEvent } from "./SonicField";
import { SynthEngine, ScaleName, MoodName } from "./synthEngine";
import ControlPanel, { Control } from "../_lib/ControlPanel";

const SCALES: { value: ScaleName; label: string }[] = [
  { value: "major", label: "major" },
  { value: "minor", label: "minor" },
  { value: "dorian", label: "dorian" },
  { value: "phrygian", label: "phrygian" },
  { value: "lydian", label: "lydian" },
  { value: "pentatonic", label: "pentatonic" },
  { value: "wholeTone", label: "whole tone" },
];

const MOODS: { value: MoodName; label: string }[] = [
  { value: "calm", label: "calm" },
  { value: "bright", label: "bright" },
  { value: "tense", label: "tense" },
  { value: "dark", label: "dark" },
  { value: "playful", label: "playful" },
];

const ROOT_NOTES: { value: number; label: string }[] = [
  { value: 60, label: "C" },
  { value: 61, label: "C#" },
  { value: 62, label: "D" },
  { value: 63, label: "D#" },
  { value: 64, label: "E" },
  { value: 65, label: "F" },
  { value: 66, label: "F#" },
  { value: 67, label: "G" },
  { value: 68, label: "G#" },
  { value: 69, label: "A" },
  { value: 70, label: "A#" },
  { value: 71, label: "B" },
];

const GLYPH_SET_VALUES: Record<
  "geometric" | "rings" | "crosses" | "organic",
  number
> = {
  geometric: 0,
  rings: 1,
  crosses: 2,
  organic: 3,
};

const PALETTE_PRESETS: {
  name: string;
  hueShift: number;
  tint: number;
  glow: number;
}[] = [
  { name: "default", hueShift: 0, tint: 0.6, glow: 0.055 },
  { name: "aurora", hueShift: 0.42, tint: 0.75, glow: 0.07 },
  { name: "ember", hueShift: 0.92, tint: 0.7, glow: 0.08 },
  { name: "mono", hueShift: 0, tint: 0.08, glow: 0.05 },
  { name: "ultraviolet", hueShift: 0.68, tint: 0.8, glow: 0.075 },
  { name: "citrus", hueShift: 0.14, tint: 0.65, glow: 0.065 },
];

export default function SonicFieldPage() {
  const engineRef = useRef<SynthEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new SynthEngine();
  }

  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(96);
  const [rootNote, setRootNote] = useState(60);
  const [scale, setScale] = useState<ScaleName>("major");
  const [mood, setMood] = useState<MoodName>("calm");

  const [waveSpeed, setWaveSpeed] = useState(0.5);
  const [damping, setDamping] = useState(0.012);
  const [stepsPerFrame, setStepsPerFrame] = useState(2);
  const [gridDensity, setGridDensity] = useState(38);
  const [glow, setGlow] = useState(0.055);
  const [notchSize, setNotchSize] = useState(0.26);
  const [trail, setTrail] = useState(0.45);
  const [tint, setTint] = useState(0.6);
  const [hueShift, setHueShift] = useState(0);
  const [glyphSetName, setGlyphSetName] = useState<
    "geometric" | "rings" | "crosses" | "organic"
  >("geometric");
  const [paletteName, setPaletteName] = useState("default");
  const [renderMode, setRenderMode] = useState<"glyphs" | "soft">("glyphs");

  const [currentSeed, setCurrentSeed] = useState<number | null>(null);
  const [seedInput, setSeedInput] = useState("");
  const [seedCopied, setSeedCopied] = useState(false);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    engineRef.current?.setParams({ bpm, rootNote, scale, mood });
  }, [bpm, rootNote, scale, mood]);

  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
    };
  }, []);

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
      } else if (e.key === " ") {
        e.preventDefault();
        void togglePlay();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  async function togglePlay() {
    const engine = engineRef.current!;
    if (isPlaying) {
      engine.stop();
      setIsPlaying(false);
    } else {
      await engine.start();
      setIsPlaying(true);
    }
  }

  function shuffleMelodySeed() {
    // Rolls a fresh chord progression, rhythm cell, and melody walk for the current key/scale/mood - a real "new phrase", not a mood change.
    engineRef.current?.newPhrase();
  }

  function handleLoadSeed() {
    const parsed = Number(seedInput.trim());
    if (!Number.isFinite(parsed) || parsed < 0) return;
    engineRef.current?.loadSeed(Math.floor(parsed));
  }

  async function handleCopySeed() {
    if (currentSeed === null) return;
    try {
      await navigator.clipboard.writeText(String(currentSeed));
      setSeedCopied(true);
      window.setTimeout(() => setSeedCopied(false), 1200);
    } catch {}
  }

  // Poll the engine's current phrase seed while playing so it can be shown and copied - the seed is only known once the scheduler actually
  // generates a phrase, which happens inside the audio callback rather than through a React-visible event.
  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => {
      const seed = engineRef.current?.getCurrentSeed() ?? null;
      setCurrentSeed((prev) => (seed !== prev ? seed : prev));
    }, 250);
    return () => window.clearInterval(id);
  }, [isPlaying]);

  function handleManualPluck(x: number, y: number, strength: number) {
    // Sound a soft tone for the click too, so a user pluck and a generative pluck feel like the same kind of event rather than one
    // being silent. Pitch follows vertical position (higher on screen = higher note) so clicking has an audible, legible mapping.
    engineRef.current?.injectPluck(y, strength, x);
  }

  function handleShuffleColors() {
    setPaletteName("custom");
    setHueShift(Math.random());
    setTint(0.4 + Math.random() * 0.5);
    setGlow(0.045 + Math.random() * 0.09);
  }

  function applyPalette(name: string) {
    const preset = PALETTE_PRESETS.find((p) => p.name === name);
    if (!preset) return;
    setPaletteName(name);
    setHueShift(preset.hueShift);
    setTint(preset.tint);
    setGlow(preset.glow);
  }

  const drainNotes = (): NoteEvent[] => engineRef.current?.drainNotes() ?? [];
  const getAmbientEnergy = (): number =>
    engineRef.current?.getAmbientEnergy() ?? 0;

  const controls: Control[] = [
    {
      type: "group",
      key: "musicGroup",
      label: "Music",
      defaultOpen: true,
      controls: [
        {
          type: "buttonGroup",
          key: "transport",
          buttons: [
            {
              label: isPlaying ? "pause" : "play",
              onClick: () => void togglePlay(),
            },
            {
              label: "new phrase",
              onClick: shuffleMelodySeed,
            },
          ],
        },
        {
          type: "slider",
          key: "bpm",
          label: "tempo (bpm)",
          min: 50,
          max: 160,
          step: 1,
          value: bpm,
          onChange: setBpm,
        },
        {
          type: "select",
          key: "rootNote",
          label: "key",
          value: String(rootNote),
          options: ROOT_NOTES.map((r) => String(r.value)),
          onChange: (v) => setRootNote(Number(v)),
        },
        {
          type: "select",
          key: "scale",
          label: "scale",
          value: scale,
          options: SCALES.map((s) => s.value),
          onChange: (v) => setScale(v as ScaleName),
        },
        {
          type: "select",
          key: "mood",
          label: "mood",
          value: mood,
          options: MOODS.map((m) => m.value),
          onChange: (v) => setMood(v as MoodName),
        },
      ],
    },
    {
      type: "group",
      key: "simGroup",
      label: "Field Physics",
      defaultOpen: false,
      controls: [
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
          min: 0.0005,
          max: 0.02,
          step: 0.0005,
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
      ],
    },
    {
      type: "group",
      key: "visualGroup",
      label: "Visual Style",
      defaultOpen: false,
      controls: [
        {
          type: "buttonGroup",
          key: "renderMode",
          label: "visualisation",
          buttons: [
            {
              label: renderMode === "glyphs" ? "[glyphs]" : "glyphs",
              onClick: () => setRenderMode("glyphs"),
            },
            {
              label: renderMode === "soft" ? "[soft field]" : "soft field",
              onClick: () => setRenderMode("soft"),
            },
          ],
        },
        ...(renderMode === "glyphs"
          ? ([
              {
                type: "select",
                key: "glyphSet",
                label: "glyph set",
                value: glyphSetName,
                options: ["geometric", "rings", "crosses", "organic"],
                onChange: (v) =>
                  setGlyphSetName(
                    v as "geometric" | "rings" | "crosses" | "organic",
                  ),
              },
              {
                type: "slider",
                key: "gridDensity",
                label: "grid density",
                min: 30,
                max: 140,
                step: 1,
                value: gridDensity,
                onChange: setGridDensity,
              },
            ] as Control[])
          : []),
        {
          type: "select",
          key: "palette",
          label: "palette",
          value: paletteName,
          options: [
            ...PALETTE_PRESETS.map((p) => p.name),
            ...(paletteName === "custom" ? ["custom"] : []),
          ],
          onChange: applyPalette,
        },
        {
          type: "slider",
          key: "glow",
          label: renderMode === "soft" ? "glow" : "glyph glow",
          min: 0.02,
          max: 0.2,
          step: 0.005,
          value: glow,
          onChange: (v) => {
            setPaletteName("custom");
            setGlow(v);
          },
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
          onChange: (v) => {
            setPaletteName("custom");
            setTint(v);
          },
        },
        {
          type: "slider",
          key: "hueShift",
          label: "hue shift",
          min: 0,
          max: 1,
          step: 0.01,
          value: hueShift,
          onChange: (v) => {
            setPaletteName("custom");
            setHueShift(v);
          },
        },
        {
          type: "buttonGroup",
          key: "colorActions",
          buttons: [{ label: "shuffle colours", onClick: handleShuffleColors }],
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
        <SonicField
          waveSpeed={waveSpeed}
          damping={damping}
          stepsPerFrame={stepsPerFrame}
          drainNotes={drainNotes}
          getAmbientEnergy={getAmbientEnergy}
          onManualPluck={handleManualPluck}
          params={{
            gridDensity,
            glow,
            notchSize,
            trail,
            tint,
            hueShift,
            glyphSet: GLYPH_SET_VALUES[glyphSetName],
            renderMode,
          }}
        />

        {!isPlaying && (
          <button
            onClick={() => void togglePlay()}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              background: "rgba(0,0,0,0.35)",
              border: "none",
              color: "#e8e8e8",
              fontFamily: "monospace",
              fontSize: 13,
              letterSpacing: "0.08em",
              cursor: "pointer",
            }}
          >
            ▶ PLAY
          </button>
        )}
      </div>

      {!uiHidden && (
        <ControlPanel title="Sonic Field (generative)" controls={controls} />
      )}

      {!uiHidden && (
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 316,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 6,
            fontFamily: "monospace",
            fontSize: 10,
            letterSpacing: "0.04em",
            color: "rgba(255,255,255,0.5)",
          }}
        >
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span>seed</span>
            <span style={{ color: "#e8e8e8" }}>
              {currentSeed !== null ? currentSeed : "—"}
            </span>
            <button
              onClick={() => void handleCopySeed()}
              disabled={currentSeed === null}
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#d0d0d0",
                fontFamily: "monospace",
                fontSize: 10,
                padding: "3px 8px",
                borderRadius: 2,
                cursor: currentSeed === null ? "default" : "pointer",
                opacity: currentSeed === null ? 0.4 : 1,
              }}
            >
              {seedCopied ? "copied" : "copy"}
            </button>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              placeholder="load seed…"
              style={{
                width: 96,
                background: "#111",
                color: "#c9c9c9",
                border: "1px solid #3a3a3a",
                borderRadius: 2,
                padding: "4px 6px",
                fontFamily: "monospace",
                fontSize: 10,
              }}
            />
            <button
              onClick={handleLoadSeed}
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#d0d0d0",
                fontFamily: "monospace",
                fontSize: 10,
                padding: "3px 8px",
                borderRadius: 2,
                cursor: "pointer",
              }}
            >
              load
            </button>
          </div>
        </div>
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
            maxWidth: 360,
          }}
        >
          an original generative piece, synthesized live from the tempo / key /
          mood you pick — not a recording of any real song — driving ripples
          across the field · click / drag to pluck along with it · space to
          play/pause
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
