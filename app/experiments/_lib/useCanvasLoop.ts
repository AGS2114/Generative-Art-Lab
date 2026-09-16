"use client";

import { useEffect, useRef } from "react";

/**
 * useCanvasLoop - a requestAnimationFrame loop hook shared across every sketch under /experiments. Clamps delta-time so a backgrounded tab
 * or a dropped frame never causes a visible pop/jump when it resumes - build this in once rather than retrofitting it into every sketch.
 *
 * `draw` receives the 2D context, the clamped delta (seconds) since the last frame, and the total elapsed time (seconds).
 */
export function useCanvasLoop(
  draw: (ctx: CanvasRenderingContext2D, dt: number, t: number) => void,
) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let elapsed = 0;
    let cancelled = false;

    const tick = (now: number) => {
      if (cancelled) return;
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      elapsed += dt;
      drawRef.current(ctx, dt, elapsed);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  return ref;
}
