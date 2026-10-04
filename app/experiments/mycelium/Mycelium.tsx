"use client";

import { useRef } from "react";
import { useCanvasLoop } from "../_lib/useCanvasLoop";
import { useResizeObserver } from "../_lib/useResizeObserver";
import { mulberry32 } from "../_lib/noise";
import { MyceliumEngine, EngineParams } from "./engine";

export interface MyceliumParams extends EngineParams {
  growthSpeed: number; // sim steps per frame
  tipDots: number; // dots per tip cluster
  tipRadius: number; // px
  dotSize: number; // px
  threadAlpha: number; // 0..1 faint wake threads
  threadSpread: number; // px, width of the hairline bundle
  trunkThickness: number; // 0..1 how strongly traffic thickens trunks
  jitter: number; // px scatter for stamped dots
  color: [number, number, number];
  maxNodes: number;
  maxPerTick: number;
  paused: boolean;
}

interface MyceliumProps {
  params: MyceliumParams;
  resetToken: number;
}

const FIELD_SEED = 4242;
const BG = "#0f0d10"; // matches the near-black, faintly warm ground in the reference

function engineKey(p: MyceliumParams) {
  return [
    p.attractionCount,
    p.maxInfluenceDist,
    p.killDist,
    p.stepLength,
    p.seedMode,
    p.inertia,
    p.wander,
    p.maxNodes,
    p.maxPerTick,
  ].join("|");
}

export default function Mycelium({ params, resetToken }: MyceliumProps) {
  const canvasRef = useCanvasLoop((ctx) => draw(ctx));
  const propsRef = useRef({ params, resetToken });
  propsRef.current = { params, resetToken };

  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });
  const accumRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<MyceliumEngine | null>(null);
  const keyRef = useRef("");
  const tokenRef = useRef(-1);
  const stampRand = useRef(mulberry32(FIELD_SEED));
  // per-node bookkeeping: last traffic level already stamped, so trunks only re-stamp when they thicken
  const stampedTraffic = useRef<number[]>([]);

  useResizeObserver(canvasRef, (width, height, dpr) => {
    sizeRef.current = { width, height, dpr };
    const acc = accumRef.current ?? document.createElement("canvas");
    acc.width = width;
    acc.height = height;
    accumRef.current = acc;
    engineRef.current = null; // rebuild for new size
  });

  function ensureEngine(): MyceliumEngine | null {
    const { width, height } = sizeRef.current;
    if (!width || !height) return null;
    const { params: p, resetToken: tok } = propsRef.current;
    const k = engineKey(p);
    const scale = sizeRef.current.dpr;
    const ep: EngineParams = {
      ...p,
      maxInfluenceDist: p.maxInfluenceDist * scale,
      killDist: p.killDist * scale,
      stepLength: p.stepLength * scale,
    };
    if (
      !engineRef.current ||
      k !== keyRef.current ||
      tok !== tokenRef.current
    ) {
      engineRef.current = new MyceliumEngine(width, height, ep, FIELD_SEED);
      keyRef.current = k;
      tokenRef.current = tok;
      stampedTraffic.current = [];
      stampRand.current = mulberry32(FIELD_SEED + 7);
      const acc = accumRef.current!;
      const actx = acc.getContext("2d")!;
      actx.fillStyle = BG;
      actx.fillRect(0, 0, acc.width, acc.height);
    } else {
      engineRef.current.p = ep;
    }
    return engineRef.current;
  }

  function draw(ctx: CanvasRenderingContext2D) {
    const engine = ensureEngine();
    const acc = accumRef.current;
    const { width, height, dpr } = sizeRef.current;
    if (!engine || !acc) return;
    const { params: p } = propsRef.current;
    const actx = acc.getContext("2d")!;
    const [r, g, b] = p.color;
    const rand = stampRand.current;

    const dot = (x: number, y: number, size: number, alpha: number) => {
      actx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      actx.beginPath();
      actx.arc(x, y, size, 0, Math.PI * 2);
      actx.fill();
    };

    if (!p.paused && !engine.done) {
      for (let s = 0; s < p.growthSpeed; s++) {
        const created = engine.tick();
        // Draw-call budget: ~1600 stamps per tick. Big ticks get proportionally lighter nodes.
        const detail = Math.min(1, 220 / Math.max(1, created.length));
        const threads = Math.max(1, Math.round(4 * detail));
        for (const ni of created) {
          const n = engine.nodes[ni];
          const par = engine.nodes[n.parent];
          if (!par) continue;

          // 1) wake threads: a small bundle of offset hairlines (parent -> node), very low alpha.
          //    This is the hazy filament haze trailing behind each tip in the reference.
          const tx = -(n.y - par.y);
          const ty = n.x - par.x;
          const tl = Math.hypot(tx, ty) || 1;
          actx.lineWidth = Math.max(0.5, dpr * 0.5);
          for (let h = 0; h < threads; h++) {
            const off = (rand() - 0.5) * p.threadSpread * dpr;
            actx.strokeStyle = `rgba(${r},${g},${b},${p.threadAlpha * (0.4 + rand() * 0.9)})`;
            actx.beginPath();
            actx.moveTo(par.x + (tx / tl) * off, par.y + (ty / tl) * off);
            actx.lineTo(n.x + (tx / tl) * off, n.y + (ty / tl) * off);
            actx.stroke();
          }

          // 2) tip cluster: bright fat blob of jittered dots at the growing edge
          const cnt = Math.max(1, Math.round(p.tipDots * detail));
          for (let i = 0; i < cnt; i++) {
            const a = rand() * Math.PI * 2;
            const rr = Math.sqrt(rand()) * p.tipRadius * dpr;
            dot(
              n.x + Math.cos(a) * rr,
              n.y + Math.sin(a) * rr,
              p.dotSize * dpr * (0.55 + rand() * 0.6),
              0.35 + rand() * 0.45,
            );
          }
        }
      }

      // 3) trunk thickening: re-stamp dots along nodes whose traffic grew, rope-like
      if (p.trunkThickness > 0) {
        const nodes = engine.nodes;
        const st = stampedTraffic.current;
        const batch = 400; // cap per frame
        let done = 0;
        for (let i = nodes.length - 1; i >= 0 && done < batch; i--) {
          const n = nodes[i];
          const prev = st[i] ?? 0;
          if (n.traffic < 3 || n.traffic <= prev + 2 || n.parent < 0) continue;
          st[i] = n.traffic;
          done++;
          const par = nodes[n.parent];
          const weight = Math.min(1, n.traffic / 60) * p.trunkThickness;
          const spread = (0.4 + weight * 2.6) * dpr;
          const along = 2;
          for (let k = 0; k < along; k++) {
            const t = rand();
            const x =
              par.x +
              (n.x - par.x) * t +
              (rand() - 0.5) * (p.jitter * dpr + spread);
            const y =
              par.y +
              (n.y - par.y) * t +
              (rand() - 0.5) * (p.jitter * dpr + spread);
            dot(
              x,
              y,
              p.dotSize * dpr * (0.7 + weight * 0.9),
              0.5 + weight * 0.4,
            );
          }
        }
      }
    }

    ctx.drawImage(acc, 0, 0, width, height);
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
