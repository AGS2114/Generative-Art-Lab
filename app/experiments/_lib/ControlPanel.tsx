"use client";

import { ReactNode, useState } from "react";
import MacWindow from "./mac/Window";

interface SliderControl {
  type: "slider";
  key: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
}

interface ToggleControl {
  type: "toggle";
  key: string;
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

interface SelectControl {
  type: "select";
  key: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

interface ColorControl {
  type: "color";
  key: string;
  label: string;
  value: string;
  onChange: (hex: string) => void;
}

interface ButtonGroupControl {
  type: "buttonGroup";
  key: string;
  label?: string;
  buttons: { label: string; onClick: () => void }[];
}

interface GroupControl {
  type: "group";
  key: string;
  label: string;
  defaultOpen?: boolean;
  controls: Control[];
}

export type Control =
  | SliderControl
  | ToggleControl
  | SelectControl
  | ColorControl
  | ButtonGroupControl
  | GroupControl;

interface ControlPanelProps {
  title: string;
  controls?: Control[];
  children?: ReactNode;
}

const labelRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 4,
};

const labelStyle: React.CSSProperties = { fontSize: 13, color: "var(--text)" };
const valueStyle: React.CSSProperties = {
  fontSize: 12,
  fontFamily: "var(--font-mono)",
  color: "var(--text-muted)",
};

function Triangle({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="currentColor"
      style={{ flex: "none", opacity: 0.6 }}
    >
      {open ? <path d="M0 2h10L5 9z" /> : <path d="M2 0v10l7-5z" />}
    </svg>
  );
}

function ControlRow({ c }: { c: Control }) {
  const [open, setOpen] = useState(
    c.type === "group" ? (c.defaultOpen ?? false) : false,
  );

  if (c.type === "group") {
    return (
      <div
        className="mac-group"
        style={{ padding: open ? "10px 12px 0" : "8px 12px" }}
      >
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            font: "inherit",
            fontSize: 14,
            color: "inherit",
          }}
        >
          <Triangle open={open} />
          <span>{c.label}</span>
        </button>

        {open && (
          <div style={{ marginTop: 10 }}>
            {c.controls.map((child) => (
              <ControlRow key={child.key} c={child} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 12 }}>
      {c.type === "slider" && (
        <>
          <div style={labelRowStyle}>
            <span style={labelStyle}>{c.label}</span>
            <span style={valueStyle}>{c.value}</span>
          </div>
          <input
            className="mac-range"
            style={
              {
                "--pct": `${((c.value - c.min) / (c.max - c.min)) * 100}%`,
              } as React.CSSProperties
            }
            type="range"
            min={c.min}
            max={c.max}
            step={c.step ?? (c.max - c.min) / 100}
            value={c.value}
            onChange={(e) => c.onChange(Number(e.target.value))}
          />
        </>
      )}

      {c.type === "toggle" && (
        <label style={{ ...labelRowStyle, cursor: "pointer" }}>
          <span style={labelStyle}>{c.label}</span>
          <input
            className="mac-check"
            type="checkbox"
            checked={c.value}
            onChange={(e) => c.onChange(e.target.checked)}
          />
        </label>
      )}

      {c.type === "select" && (
        <>
          <div style={labelRowStyle}>
            <span style={labelStyle}>{c.label}</span>
          </div>
          <select
            className="mac-select"
            value={c.value}
            onChange={(e) => c.onChange(e.target.value)}
          >
            {c.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </>
      )}

      {c.type === "color" && (
        <div style={labelRowStyle}>
          <span style={labelStyle}>{c.label}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              className="mac-swatch"
              type="color"
              value={c.value}
              onChange={(e) => c.onChange(e.target.value)}
            />
            <span style={{ ...valueStyle, minWidth: 60, textAlign: "right" }}>
              {c.value}
            </span>
          </div>
        </div>
      )}

      {c.type === "buttonGroup" && (
        <>
          {c.label && (
            <div style={{ ...labelRowStyle, marginBottom: 8 }}>
              <span style={labelStyle}>{c.label}</span>
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {c.buttons.map((btn) => (
              <button
                key={btn.label}
                className="mac-btn"
                onClick={btn.onClick}
                style={{ fontSize: 13, padding: "5px 11px" }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * ControlPanel - the single shared control surface for every /experiments sketch.
 * Sketches declare controls as data (sliders, toggles, selects, colour swatches,
 * button rows, collapsible groups). Rendered as a draggable classic-Mac window:
 * drag the title bar, double-click it to roll the window up, close box to hide.
 */
export default function ControlPanel({
  title,
  controls = [],
  children,
}: ControlPanelProps) {
  const [visible, setVisible] = useState(true);

  if (!visible) {
    return (
      <button
        className="mac-btn"
        onClick={() => setVisible(true)}
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 20,
          fontSize: 13,
          boxShadow: "0 6px 18px rgba(0,0,0,0.45)",
        }}
      >
        Control Panel
      </button>
    );
  }

  return (
    <MacWindow
      title="Control Panel"
      onClose={() => setVisible(false)}
      style={{ top: 12, right: 16, width: 300 }}
      bodyStyle={{ padding: "16px 16px 4px", maxHeight: "calc(100vh - 110px)" }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
        {title}
      </div>
      {controls.map((c) => (
        <ControlRow key={c.key} c={c} />
      ))}
      {children}
    </MacWindow>
  );
}
