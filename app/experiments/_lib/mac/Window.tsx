"use client";

import {
  CSSProperties,
  PointerEvent,
  ReactNode,
  useRef,
  useState,
} from "react";

let topZ = 20;

interface MacWindowProps {
  title: string;
  onClose?: () => void;
  style?: CSSProperties;
  bodyStyle?: CSSProperties;
  children: ReactNode;
}

/* Draggable System-7 style window. Drag by the title bar, click the close box to dismiss, double-click the title bar to "windowshade" it */
export default function MacWindow({
  title,
  onClose,
  style,
  bodyStyle,
  children,
}: MacWindowProps) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [shaded, setShaded] = useState(false);
  const [z, setZ] = useState(20);
  const drag = useRef<{
    sx: number;
    sy: number;
    ox: number;
    oy: number;
  } | null>(null);

  function raise() {
    setZ(++topZ);
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest(".mac-close")) return;
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    setPos({ x: d.ox + e.clientX - d.sx, y: d.oy + e.clientY - d.sy });
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  return (
    <div
      className="mac-window"
      onPointerDownCapture={raise}
      style={{
        position: "absolute",
        zIndex: z,
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        ...style,
      }}
    >
      <div
        className="mac-titlebar"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={() => setShaded((s) => !s)}
      >
        {onClose && (
          <button className="mac-close" aria-label="Close" onClick={onClose} />
        )}
        <span className="mac-title">{title}</span>
      </div>
      {!shaded && (
        <div className="mac-window-body" style={bodyStyle}>
          {children}
        </div>
      )}
    </div>
  );
}
