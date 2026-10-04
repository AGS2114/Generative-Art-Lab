"use client";

import { ReactNode, useEffect } from "react";
import { RippleMark } from "./icons";

interface DialogButton {
  label: string;
  onClick?: () => void;
  default?: boolean;
}

interface MacDialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  buttons?: DialogButton[];
}

export default function MacDialog({
  open,
  onClose,
  children,
  buttons = [{ label: "OK", default: true }],
}: MacDialogProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") {
        const d = buttons.find((b) => b.default);
        d?.onClick?.();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, buttons]);

  if (!open) return null;

  return (
    <div className="mac-modal" onPointerDown={(e) => e.stopPropagation()}>
      <div className="mac-alert" role="alertdialog">
        {children}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
            marginTop: 14,
          }}
        >
          {buttons.map((b) => (
            <button
              key={b.label}
              className={`mac-btn${b.default ? " default" : ""}`}
              onClick={() => {
                b.onClick?.();
                onClose();
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AboutContent() {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <RippleMark size={48} />
      <div style={{ lineHeight: 1.5 }}>
        <div style={{ fontSize: 15 }}>Generative Art Lab</div>
        <div>Version 1.0</div>
        <div style={{ marginTop: 8 }}>
          Next.js · Canvas · WebGL2 · Web Audio
        </div>
        <div>Pixels and math. No frameworks.</div>
      </div>
    </div>
  );
}
