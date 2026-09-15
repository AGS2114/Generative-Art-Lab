"use client";

import { ReactNode, useState } from "react";

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
  /** Hex string, e.g. "#ff8a65". */
  value: string;
  onChange: (hex: string) => void;
}

interface ButtonGroupControl {
  type: "buttonGroup";
  key: string;
  /** Optional label above the button row (omit for a bare row, e.g. a lone reset). */
  label?: string;
  buttons: { label: string; onClick: () => void }[];
}

interface GroupControl {
  type: "group";
  key: string;
  label: string;
  /** Collapsed by default unless this is true. */
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
  /** Extra freeform content, for anything not covered by the control types above. */
  children?: ReactNode;
}

const panelStyle: React.CSSProperties = {
  position: "absolute",
  top: 60,
  right: 16,
  width: 280,
  background: "rgba(4, 4, 4, 0.6)",
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: 4,
  padding: "18px 20px",
  fontFamily: "monospace",
  color: "#e8e8e8",
  maxHeight: "calc(100vh - 96px)",
  overflowY: "auto",
};

const labelRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 4,
};

const labelStyle: React.CSSProperties = { fontSize: 12, color: "#d8d8d8" };
const valueStyle: React.CSSProperties = { fontSize: 11, color: "#b5b5b5" };

const pillButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #3a3a3a",
  color: "#d0d0d0",
  fontFamily: "monospace",
  fontSize: 11,
  letterSpacing: "0.04em",
  padding: "6px 10px",
  borderRadius: 2,
  cursor: "pointer",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  background: "#111",
  color: "#c9c9c9",
  border: "1px solid #3a3a3a",
  borderRadius: 2,
  padding: "4px 6px",
  fontFamily: "monospace",
  fontSize: 11,
};

/** One control row. Recursive: a `group` renders nested ControlRows. */
function ControlRow({ c }: { c: Control }) {
  const [open, setOpen] = useState(
    c.type === "group" ? (c.defaultOpen ?? false) : false,
  );

  if (c.type === "group") {
    return (
      <div
        style={{
          marginBottom: 12,
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 3,
          padding: open ? "10px 12px 2px" : "8px 12px",
        }}
      >
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontFamily: "monospace",
            fontSize: 12,
            color: "#d8d8d8",
          }}
        >
          <span>{c.label}</span>
          <span style={{ fontSize: 10, color: "#8a8a8a" }}>
            {open ? "\u2212" : "+"}
          </span>
        </button>

        {open && (
          <div style={{ marginTop: 12 }}>
            {c.controls.map((child) => (
              <ControlRow key={child.key} c={child} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 14 }}>
      {c.type === "slider" && (
        <>
          <div style={labelRowStyle}>
            <span style={labelStyle}>{c.label}</span>
            <span style={valueStyle}>{c.value}</span>
          </div>
          <input
            type="range"
            min={c.min}
            max={c.max}
            step={c.step ?? (c.max - c.min) / 100}
            value={c.value}
            onChange={(e) => c.onChange(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </>
      )}

      {c.type === "toggle" && (
        <div style={labelRowStyle}>
          <span style={labelStyle}>{c.label}</span>
          <input
            type="checkbox"
            checked={c.value}
            onChange={(e) => c.onChange(e.target.checked)}
          />
        </div>
      )}

      {c.type === "select" && (
        <>
          <div style={labelRowStyle}>
            <span style={labelStyle}>{c.label}</span>
          </div>
          <select
            value={c.value}
            onChange={(e) => c.onChange(e.target.value)}
            style={selectStyle}
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
              type="color"
              value={c.value}
              onChange={(e) => c.onChange(e.target.value)}
              style={{
                width: 28,
                height: 20,
                border: "1px solid #3a3a3a",
                borderRadius: 2,
                background: "none",
                padding: 0,
                cursor: "pointer",
              }}
            />
            <span
              style={{
                fontSize: 11,
                color: "#b5b5b5",
                minWidth: 60,
                textAlign: "right",
              }}
            >
              {c.value}
            </span>
          </div>
        </div>
      )}

      {c.type === "buttonGroup" && (
        <>
          {c.label && (
            <div style={{ ...labelRowStyle, marginBottom: 10 }}>
              <span style={labelStyle}>{c.label}</span>
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {c.buttons.map((btn) => (
              <button
                key={btn.label}
                onClick={btn.onClick}
                style={pillButtonStyle}
              >
                {btn.label.toUpperCase()}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * ControlPanel: the single shared control surface for every /experiments
 * sketch. Sketches declare controls as data (sliders, toggles, selects,
 * colour swatches, button rows, and collapsible groups) so each one gets
 * identical chrome, spacing, and show/hide behaviour. Groups keep long
 * parameter lists from turning the panel into one endless scroll.
 */
export default function ControlPanel({
  title,
  controls = [],
  children,
}: ControlPanelProps) {
  const [visible, setVisible] = useState(true);

  return (
    <>
      <button
        onClick={() => setVisible((v) => !v)}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          background: "transparent",
          border: "none",
          color: "black",
          fontFamily: "monospace",
          fontSize: 11,
          letterSpacing: "0.08em",
          cursor: "pointer",
          padding: 4,
        }}
      >
        {visible ? "HIDE CONTROLS" : "SHOW CONTROLS"}
      </button>

      {visible && (
        <div style={panelStyle}>
          <div
            style={{
              fontSize: 12,
              letterSpacing: "0.12em",
              color: "#e8e8e8",
              marginBottom: 16,
            }}
          >
            {title.toUpperCase()}
          </div>

          {controls.map((c) => (
            <ControlRow key={c.key} c={c} />
          ))}

          {children}
        </div>
      )}
    </>
  );
}
