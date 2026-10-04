"use client";

import { useRef } from "react";
import { useCanvasLoop } from "../_lib/useCanvasLoop";
import { useResizeObserver } from "../_lib/useResizeObserver";
import { MyceliumRenderer, MyceliumParams } from "./renderer";

export type { MyceliumParams } from "./renderer";

interface MyceliumProps {
  params: MyceliumParams;
  resetToken: number;
}

/* Self-contained - fills whatever box its parent gives it (100% x 100%). Size, position and chrome are the page's job, not this component's */
export default function Mycelium({ params, resetToken }: MyceliumProps) {
  const propsRef = useRef({ params, resetToken });
  propsRef.current = { params, resetToken };

  const rendererRef = useRef<MyceliumRenderer | null>(null);
  if (!rendererRef.current) rendererRef.current = new MyceliumRenderer();

  const canvasRef = useCanvasLoop((ctx) => {
    const { params: p, resetToken: tok } = propsRef.current;
    rendererRef.current!.frame(ctx, p, tok, performance.now());
  });

  // the renderer also notices size changes on its own; this just makes it immediate
  useResizeObserver(canvasRef, () => rendererRef.current?.invalidate());

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
