"use client";

import { RefObject, useEffect } from "react";

interface ResizeOptions {
  maxDpr?: number;
}

/**
 * useResizeObserver: keeps a <canvas> element's backing-store size (canvas.width/height) in sync with its CSS-rendered size and the
 * device pixel ratio. Calls `onResize(width, height, dpr)` once on mount and again on every resize.
 */
export function useResizeObserver(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  onResize: (width: number, height: number, dpr: number) => void,
  { maxDpr = 1.5 }: ResizeOptions = {},
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      const width = Math.max(1, Math.floor(rect.width * dpr));
      const height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.width = width;
      canvas.height = height;
      onResize(width, height, dpr);
    };

    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener("resize", resize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [canvasRef, maxDpr]);
}
