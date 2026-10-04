import { mulberry32 } from "../_lib/noise";
import { MyceliumEngine, EngineParams } from "./engine";

export const REF_W = 720;

export interface LookParams {
  headRadius: number;
  strands: number;
  strandSpread: number;
  dotSize: number;
  threadAlpha: number;
  trunkThickness: number;
  stalledHeads: number;
  grain: number;
  color: [number, number, number];
}

export interface RunParams {
  growthSpeed: number;
  paused: boolean;
  loop: boolean;
  holdSeconds: number;
  stopAt: number;
  stopped: boolean;
}

export type MyceliumParams = EngineParams & LookParams & RunParams;

const BG: [number, number, number] = [23, 20, 24];
const MAX_TICKS_PER_FRAME = 8;
const TRUNK_STAMP_BUDGET = 1600;
const FRONT_DEPTH_TICKS = 12;

function hash01(i: number) {
  let x = (i + 1) * 2654435761;
  x ^= x >>> 15;
  x = Math.imul(x, 2246822519);
  x ^= x >>> 13;
  return ((x >>> 0) % 100000) / 100000;
}

function structuralKey(p: MyceliumParams) {
  return [p.attractorSpacing, p.seedMode, p.rootTips, p.maxNodes].join("|");
}

export class MyceliumRenderer {
  private engine: MyceliumEngine | null = null;
  private trail: HTMLCanvasElement | null = null;
  private tctx: CanvasRenderingContext2D | null = null;
  private key = "";
  private token = -1;
  private cycle = 0;
  private reseed = false;
  private w = 0;
  private h = 0;
  private lastT = 0;
  private tickAcc = 0;
  private holdUntil = 0;
  private queueHead = 0;
  private seed = Math.floor(Math.random() * 2 ** 31);
  private rand = mulberry32(1);
  private sprite: {
    key: string;
    canvas: HTMLCanvasElement;
    half: number;
  } | null = null;
  private grain: HTMLCanvasElement | null = null;

  invalidate() {
    this.engine = null;
  }

  // sprites

  private headSprite(R: number, color: [number, number, number]) {
    const key = `${Math.round(R * 4)}|${color.join(",")}`;
    if (this.sprite && this.sprite.key === key) return this.sprite;
    const half = Math.ceil(R + 2);
    const c = document.createElement("canvas");
    c.width = c.height = half * 2;
    const g = c.getContext("2d")!;
    const [r, gr, b] = color;

    // flat pale disc with a slightly soft rim, like a bead of colony
    const grad = g.createRadialGradient(half, half, 0, half, half, R + 1);
    grad.addColorStop(0, `rgba(${r},${gr},${b},0.97)`);
    grad.addColorStop(0.72, `rgba(${r},${gr},${b},0.95)`);
    grad.addColorStop(0.9, `rgba(${r},${gr},${b},0.6)`);
    grad.addColorStop(1, `rgba(${r},${gr},${b},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);
    this.sprite = { key, canvas: c, half };
    return this.sprite;
  }

  private grainTile() {
    if (this.grain) return this.grain;
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const img = g.createImageData(128, 128);
    const rnd = mulberry32(99);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = rnd() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    this.grain = c;
    return c;
  }

  // lifecycle

  private ensure(
    W: number,
    H: number,
    p: MyceliumParams,
    token: number,
    now: number,
  ) {
    const unit = W / REF_W;
    const k = structuralKey(p);
    const needNew =
      !this.engine ||
      W !== this.w ||
      H !== this.h ||
      k !== this.key ||
      token !== this.token;

    if (needNew) {
      // regrow button or auto-regrow - take a brand-new random path
      if (token !== this.token || this.reseed) {
        this.seed = Math.floor(Math.random() * 2 ** 31);
        this.reseed = false;
      }
      if (token !== this.token) this.cycle = 0;
      this.w = W;
      this.h = H;
      this.key = k;
      this.token = token;
      this.engine = new MyceliumEngine(REF_W, H / unit, p, this.seed);
      this.tickAcc = 0;
      this.queueHead = 0;
      this.holdUntil = 0;
      this.rand = mulberry32(this.seed + 7);
      const t = document.createElement("canvas");
      t.width = W;
      t.height = H;
      this.trail = t;
      this.tctx = t.getContext("2d");
      this.stampThreads(this.engine.initial, unit, p);
    } else if (this.engine) {
      this.engine.p = p;
    }
    return this.engine!;
  }

  // drawing

  /** Fibres - a bundle of dotted, gently wiggling hairlines trailing each new node. */
  private stampThreads(created: number[], unit: number, p: MyceliumParams) {
    const engine = this.engine!;
    const t = this.tctx!;
    const [r, g, b] = p.color;
    t.fillStyle = `rgb(${r},${g},${b})`;
    const rand = this.rand;
    // lighter nodes when a big wave lands in one tick, keeps the draw budget flat
    const detail = Math.min(1, 260 / Math.max(1, created.length));
    const strands = Math.max(1, Math.round(p.strands * detail));
    const size = Math.max(1, p.dotSize * unit);
    for (const ni of created) {
      const n = engine.nodes[ni];
      // perpendicular to heading
      const nx = -n.dy;
      const ny = n.dx;
      for (let k = 0; k < strands; k++) {
        const wave =
          k === 0
            ? 0.2 * Math.sin(n.s * 0.03 + n.ph)
            : Math.sin(
                n.s * (0.016 + 0.009 * k) + n.ph * (1 + 0.5 * k) + k * 1.9,
              );
        const off = wave * p.strandSpread + (rand() - 0.5) * 0.7;
        const u = (k * 0.618034) % 1;
        const par = engine.nodes[n.parent] ?? n;
        const bx = par.x + (n.x - par.x) * u;
        const by = par.y + (n.y - par.y) * u;
        const x = (bx + nx * off) * unit;
        const y = (by + ny * off) * unit;
        t.globalAlpha = p.threadAlpha * (k === 0 ? 1 : 0.55 + rand() * 0.7);
        t.fillRect(x - size / 2, y - size / 2, size, size);
      }
    }
    t.globalAlpha = 1;
  }

  /** Rope trunks - stacks of beads laid down once a node carries enough tip lineages. */
  private stampTrunks(unit: number, p: MyceliumParams) {
    const engine = this.engine!;
    const q = engine.trunkQueue;
    if (p.trunkThickness <= 0) {
      this.queueHead = q.length;
      return;
    }
    const t = this.tctx!;
    const R = p.headRadius * unit;
    const spr = this.headSprite(R, p.color);
    const bead = R * 0.82;
    let budget = TRUNK_STAMP_BUDGET;
    t.globalAlpha = 0.88;
    while (this.queueHead < q.length && budget > 0) {
      const e = q[this.queueHead++];
      const idx = (e / 8) | 0;
      const lvl = e % 8;
      const n = engine.nodes[idx];
      if (n.parent >= 0 && lvl < 3) continue;
      if (n.parent < 0) {
        // hubs - a solid colony blob around the seed
        const count = 3 + lvl * 3;
        for (let k = 0; k < count; k++) {
          const a = this.rand() * Math.PI * 2;
          const d = Math.sqrt(this.rand()) * R * (1.2 + lvl * 0.9);
          t.drawImage(
            spr.canvas,
            n.x * unit + Math.cos(a) * d - bead,
            n.y * unit + Math.sin(a) * d - bead,
            bead * 2,
            bead * 2,
          );
        }
        budget -= count;
        continue;
      }
      const half = Math.min(
        R * 3.2,
        R * (0.1 + 0.3 * (lvl - 1)) * p.trunkThickness,
      );
      const count = lvl;
      const nx = -n.dy;
      const ny = n.dx;
      for (let k = 0; k < count; k++) {
        const off = (this.rand() * 2 - 1) * half;
        const along = (this.rand() - 0.5) * R * 0.8;
        t.drawImage(
          spr.canvas,
          n.x * unit + nx * off + n.dx * along - bead,
          n.y * unit + ny * off + n.dy * along - bead,
          bead * 2,
          bead * 2,
        );
      }
      budget -= count;
    }
    t.globalAlpha = 1;
  }

  frame(
    ctx: CanvasRenderingContext2D,
    p: MyceliumParams,
    token: number,
    now: number,
  ) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    if (!W || !H) return;
    const unit = W / REF_W;
    const dt = this.lastT ? Math.min(0.05, (now - this.lastT) / 1000) : 1 / 60;
    this.lastT = now;

    let engine = this.ensure(W, H, p, token, now);

    if (!p.paused) {
      const finished = engine.done || engine.coverage >= p.stopAt;
      if (!finished && !p.stopped) {
        this.tickAcc += p.growthSpeed * dt * 60;
        const n = Math.min(MAX_TICKS_PER_FRAME, Math.floor(this.tickAcc));
        this.tickAcc = n >= MAX_TICKS_PER_FRAME ? 0 : this.tickAcc - n;
        for (
          let s = 0;
          s < n && !engine.done && engine.coverage < p.stopAt;
          s++
        ) {
          const created = engine.tick();
          this.stampThreads(created, unit, p);
        }
      }
      this.stampTrunks(unit, p);

      // regrow after a hold, with a fresh scatter each cycle
      if (
        finished &&
        !p.stopped &&
        this.queueHead >= engine.trunkQueue.length &&
        p.loop
      ) {
        if (!this.holdUntil) this.holdUntil = now + p.holdSeconds * 1000;
        else if (now > this.holdUntil) {
          this.cycle++;
          this.reseed = true;
          this.engine = null;
          engine = this.ensure(W, H, p, token, now);
        }
      } else {
        this.holdUntil = 0;
      }
    }

    // compose - ground + grain, trail layer, then live heads on top
    ctx.fillStyle = `rgb(${BG[0]},${BG[1]},${BG[2]})`;
    ctx.fillRect(0, 0, W, H);
    if (p.grain > 0) {
      const pat = ctx.createPattern(this.grainTile(), "repeat");
      if (pat) {
        ctx.globalAlpha = p.grain;
        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
    }
    if (this.trail) ctx.drawImage(this.trail, 0, 0);

    const R = p.headRadius * unit;
    const spr = this.headSprite(R, p.color);
    const size = spr.half * 2;
    for (const i of engine.activeList) {
      const n = engine.nodes[i];
      ctx.drawImage(
        spr.canvas,
        n.x * unit - spr.half,
        n.y * unit - spr.half,
        size,
        size,
      );
    }
    for (const i of engine.stalled) {
      const n = engine.nodes[i];
      const young = engine.step - n.died < FRONT_DEPTH_TICKS;
      if (!young && hash01(i) >= p.stalledHeads) continue;
      ctx.drawImage(
        spr.canvas,
        n.x * unit - spr.half,
        n.y * unit - spr.half,
        size,
        size,
      );
    }
  }
}
