import { mulberry32 } from "../_lib/noise";

/**
 * Space-colonization growth, tuned for the "colony front" look:
 * many evenly spaced tips sweep across a field of attraction points, fork into free space, merge when they collide, and stall into lone heads when the food
 * runs out. Pure simulation, no drawing.
 *
 * All distances are in *reference pixels* (a canvas 720 wide). The renderer scales them, so the look is identical at any container size or DPR.
 */

/** Leaf-count thresholds at which a node gets thicker "rope" stamping. */
export const TRUNK_LEVELS = [8, 20, 45, 100, 220, 450];

export interface MyceliumNode {
  x: number;
  y: number;
  parent: number;
  birth: number;
  traffic: number;
  idle: number;
  dx: number;
  dy: number;
  active: boolean;
  s: number;
  ph: number;
  imm: number;
  lvl: number;
  died: number;
  ax: number;
  ay: number;
  cnt: number;
}

export interface EngineParams {
  attractorSpacing: number;
  maxInfluenceDist: number;
  killDist: number;
  stepLength: number;
  tipSpacing: number;
  seedMode: "diagonal" | "corners" | "center" | "bottom";
  rootTips: number;
  inertia: number;
  wander: number;
  branchChance: number;
  idleLimit: number;
  maxNodes: number;
  maxPerTick: number;
}

const PT_CELL = 12;

export class MyceliumEngine {
  nodes: MyceliumNode[] = [];
  activeList: number[] = [];
  stalled: number[] = [];
  trunkQueue: number[] = [];
  initial: number[] = [];
  step = 0;
  width: number;
  height: number;
  p: EngineParams;

  private seed: number;
  private rand: () => number;
  private px = new Float32Array(0);
  private py = new Float32Array(0);
  private dead = new Uint8Array(0);
  private alive: number[] = [];
  private totalPoints = 1;
  private ptGrid: number[][] = [];
  private ptCols = 0;
  private ptRows = 0;
  private tipGrid = new Map<number, number[]>();
  private cell = 60;

  constructor(width: number, height: number, p: EngineParams, seed: number) {
    this.width = width;
    this.height = height;
    this.p = p;
    this.seed = seed;
    this.rand = mulberry32(seed);
    this.reset();
  }

  reset() {
    this.rand = mulberry32(this.seed);
    this.nodes = [];
    this.activeList = [];
    this.stalled = [];
    this.trunkQueue = [];
    this.initial = [];
    this.step = 0;
    this.scatterPoints();
    this.plantSeeds();
  }

  /** Jittered-grid scatter - random, but without the big holes pure uniform noise leaves. */
  private scatterPoints() {
    const { width: w, height: h, p, rand } = this;
    const sp = Math.max(4, p.attractorSpacing);
    const cols = Math.ceil(w / sp);
    const rows = Math.ceil(h / sp);
    const xs: number[] = [];
    const ys: number[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c + rand()) * sp;
        const y = (r + rand()) * sp;
        if (x <= w && y <= h) {
          xs.push(x);
          ys.push(y);
        }
      }
    }
    this.px = Float32Array.from(xs);
    this.py = Float32Array.from(ys);
    this.dead = new Uint8Array(xs.length);
    this.alive = xs.map((_, i) => i);
    this.totalPoints = Math.max(1, xs.length);

    this.ptCols = Math.ceil(w / PT_CELL) + 1;
    this.ptRows = Math.ceil(h / PT_CELL) + 1;
    this.ptGrid = Array.from({ length: this.ptCols * this.ptRows }, () => []);
    for (let i = 0; i < xs.length; i++) {
      const cx = Math.floor(xs[i] / PT_CELL);
      const cy = Math.floor(ys[i] / PT_CELL);
      this.ptGrid[cy * this.ptCols + cx].push(i);
    }
  }

  private plantSeeds() {
    const { width: w, height: h, p, rand } = this;
    const quarter = (Math.PI / 2) * 0.92;
    const toCentre = (x: number, y: number) => Math.atan2(h / 2 - y, w / 2 - x);
    const seeds: { x: number; y: number; centre: number; span: number }[] = [];

    if (p.seedMode === "diagonal") {
      seeds.push({ x: w, y: 0, centre: toCentre(w, 0), span: quarter });
      seeds.push({ x: 0, y: h, centre: toCentre(0, h), span: quarter });
    } else if (p.seedMode === "corners") {
      for (const [x, y] of [
        [0, 0],
        [w, 0],
        [0, h],
        [w, h],
      ] as const)
        seeds.push({ x, y, centre: toCentre(x, y), span: quarter });
    } else if (p.seedMode === "bottom") {
      for (const f of [0.25, 0.5, 0.75])
        seeds.push({
          x: w * f,
          y: h,
          centre: -Math.PI / 2,
          span: Math.PI * 0.7,
        });
    } else {
      seeds.push({ x: w / 2, y: h / 2, centre: 0, span: Math.PI * 2 });
    }

    const K = Math.max(1, Math.round(p.rootTips));
    const L = p.stepLength;
    for (const s of seeds) {
      const hub = this.nodes.length;
      this.nodes.push(
        this.makeNode(s.x, s.y, -1, 1, 0, rand() * 6.28, 0, false),
      );
      const full = s.span >= Math.PI * 2 - 1e-6;
      const arcSteps = full ? K : Math.max(1, K - 1);
      const r0 = Math.max(
        p.tipSpacing * 1.5,
        (arcSteps * p.tipSpacing) / s.span,
      );
      for (let k = 0; k < K; k++) {
        const t = full ? k / K : K === 1 ? 0.5 : k / (K - 1);
        const a = s.centre + (t - 0.5) * s.span + (rand() - 0.5) * 0.05;
        const dx = Math.cos(a);
        const dy = Math.sin(a);
        const ph = rand() * 6.28;
        let prev = hub;
        const steps = Math.max(1, Math.round(r0 / L));
        for (let j = 1; j <= steps; j++) {
          const idx = this.nodes.length;
          const nx = Math.min(
            this.width - 1.5,
            Math.max(1.5, s.x + dx * j * L),
          );
          const ny = Math.min(
            this.height - 1.5,
            Math.max(1.5, s.y + dy * j * L),
          );
          const nd = this.makeNode(
            nx,
            ny,
            prev,
            dx,
            dy,
            ph,
            j === steps ? 30 : 0,
            j === steps,
          );
          nd.s = j * L;
          this.nodes.push(nd);
          this.initial.push(idx);
          this.killAround(nx, ny);
          prev = idx;
        }
        this.activeList.push(prev);
        this.bump(hub);
        for (let a2 = prev; a2 !== hub; a2 = this.nodes[a2].parent)
          this.nodes[a2].traffic = Math.max(this.nodes[a2].traffic, 1);
      }
    }
  }

  private makeNode(
    x: number,
    y: number,
    parent: number,
    dx: number,
    dy: number,
    ph: number,
    imm: number,
    active: boolean,
  ): MyceliumNode {
    return {
      x,
      y,
      parent,
      birth: this.step,
      traffic: active ? 1 : 0,
      idle: 0,
      dx,
      dy,
      active,
      s: 0,
      ph,
      imm,
      lvl: 0,
      died: -1,
      ax: 0,
      ay: 0,
      cnt: 0,
    };
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.reset();
  }

  // spatial helpers
  private gridKey(cx: number, cy: number) {
    return cy * 1024 + cx;
  }

  private gridAdd(i: number) {
    const n = this.nodes[i];
    const k = this.gridKey(
      Math.floor(n.x / this.cell),
      Math.floor(n.y / this.cell),
    );
    const arr = this.tipGrid.get(k);
    if (arr) arr.push(i);
    else this.tipGrid.set(k, [i]);
  }

  /* Any active tip within r of (x,y)? Skips `ignore`, and optionally fresh (immune) tips */
  private tipNear(
    x: number,
    y: number,
    r: number,
    ignore: number,
    skipImmune: boolean,
  ) {
    const c = this.cell;
    const cx = Math.floor(x / c);
    const cy = Math.floor(y / c);
    const r2 = r * r;
    for (let gy = cy - 1; gy <= cy + 1; gy++) {
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        const arr = this.tipGrid.get(this.gridKey(gx, gy));
        if (!arr) continue;
        for (const j of arr) {
          if (j === ignore) continue;
          const t = this.nodes[j];
          if (!t.active) continue;
          if (skipImmune && t.imm > 0) continue;
          const dx = t.x - x;
          const dy = t.y - y;
          if (dx * dx + dy * dy < r2) return true;
        }
      }
    }
    return false;
  }

  private killAround(x: number, y: number) {
    const r = this.p.killDist;
    const r2 = r * r;
    const c0 = Math.max(0, Math.floor((x - r) / PT_CELL));
    const c1 = Math.min(this.ptCols - 1, Math.floor((x + r) / PT_CELL));
    const r0 = Math.max(0, Math.floor((y - r) / PT_CELL));
    const r1 = Math.min(this.ptRows - 1, Math.floor((y + r) / PT_CELL));
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        for (const i of this.ptGrid[cy * this.ptCols + cx]) {
          if (this.dead[i]) continue;
          const dx = this.px[i] - x;
          const dy = this.py[i] - y;
          if (dx * dx + dy * dy < r2) this.dead[i] = 1;
        }
      }
    }
  }

  /* A new tip lineage passes through every ancestor of `idx` (and idx itself) */
  private bump(idx: number) {
    let a = idx;
    let depth = 0;
    while (a >= 0 && depth < 6000) {
      const n = this.nodes[a];
      n.traffic++;
      while (n.lvl < TRUNK_LEVELS.length && n.traffic >= TRUNK_LEVELS[n.lvl]) {
        n.lvl++;
        this.trunkQueue.push(a * 8 + n.lvl);
      }
      a = n.parent;
      depth++;
    }
  }

  private spawn(
    parent: number,
    x: number,
    y: number,
    dx: number,
    dy: number,
    imm: number,
    drift: number,
  ) {
    const par = this.nodes[parent];
    const idx = this.nodes.length;
    const n = this.makeNode(x, y, parent, dx, dy, par.ph + drift, imm, true);
    n.s = par.s + this.p.stepLength;
    this.nodes.push(n);
    this.tipGridAdd(idx);
    return idx;
  }

  private tipGridAdd(idx: number) {
    this.gridAdd(idx);
  }

  private retire(i: number, stall: boolean) {
    const n = this.nodes[i];
    n.active = false;
    n.died = this.step;
    if (stall) this.stalled.push(i);
  }

  // the growth step

  /* Advances one growth step - Returns indices of nodes created this step */
  tick(): number[] {
    const { p, nodes } = this;
    const created: number[] = [];
    if (this.done) return created;
    this.step++;

    this.cell = Math.max(12, p.maxInfluenceDist, p.tipSpacing * 1.2);
    const cell = this.cell;
    this.tipGrid.clear();
    for (const i of this.activeList) {
      const n = nodes[i];
      n.cnt = 0;
      n.ax = 0;
      n.ay = 0;
      if (n.imm > 0) n.imm--;
      this.gridAdd(i);
    }

    // 1) every attraction point votes for its nearest tip within reach
    const R2 = p.maxInfluenceDist * p.maxInfluenceDist;
    const stillAlive: number[] = [];
    for (const k of this.alive) {
      if (this.dead[k]) continue;
      stillAlive.push(k);
      const x = this.px[k];
      const y = this.py[k];
      const cx = Math.floor(x / cell);
      const cy = Math.floor(y / cell);
      let best = -1;
      let bestD = R2;
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        for (let gx = cx - 1; gx <= cx + 1; gx++) {
          const arr = this.tipGrid.get(this.gridKey(gx, gy));
          if (!arr) continue;
          for (const ni of arr) {
            const t = nodes[ni];
            const dx = x - t.x;
            const dy = y - t.y;
            const d = dx * dx + dy * dy;
            if (d < bestD) {
              bestD = d;
              best = ni;
            }
          }
        }
      }
      if (best >= 0) {
        const t = nodes[best];
        const m = Math.sqrt(bestD) || 1;
        t.ax += (x - t.x) / m;
        t.ay += (y - t.y) / m;
        t.cnt++;
      }
    }
    this.alive = stillAlive;

    // 2) tips with pull grow one step (capped per tick, rotating so it stays fair)
    let hot = this.activeList.filter((i) => nodes[i].cnt > 0);
    if (hot.length > p.maxPerTick) {
      const off = (this.step * 7919) % hot.length;
      hot = hot.slice(off).concat(hot.slice(0, off)).slice(0, p.maxPerTick);
    }

    const children: number[] = [];
    const margin = 1.5;
    const spacing = p.tipSpacing;
    const L = p.stepLength;

    for (const ni of hot) {
      if (nodes.length >= p.maxNodes) break;
      const n = nodes[ni];
      let hx =
        (n.ax / n.cnt) * (1 - p.inertia) +
        n.dx * p.inertia +
        (this.rand() - 0.5) * p.wander;
      let hy =
        (n.ay / n.cnt) * (1 - p.inertia) +
        n.dy * p.inertia +
        (this.rand() - 0.5) * p.wander;
      const m = Math.hypot(hx, hy) || 1;
      hx /= m;
      hy /= m;

      // slide along the walls instead of dying on them, which builds the border bands
      const cx = Math.min(this.width - margin, Math.max(margin, n.x + hx * L));
      const cy = Math.min(this.height - margin, Math.max(margin, n.y + hy * L));
      if (Math.hypot(cx - n.x, cy - n.y) < L * 0.35) {
        n.cnt = -1; // blocked, counts as idle
        continue;
      }

      // two tips colliding: the later one retires, which keeps the front evenly spaced
      if (n.imm <= 0 && this.tipNear(cx, cy, spacing * 0.5, ni, true)) {
        this.retire(ni, true); // leaves its head behind, which builds the front's depth
        continue;
      }

      n.active = false;
      const c = this.spawn(ni, cx, cy, hx, hy, 0, (this.rand() - 0.5) * 0.05);
      children.push(c);
      created.push(c);
      this.killAround(cx, cy);

      // fork sideways, but only into genuinely free space
      if (this.rand() < p.branchChance && nodes.length < p.maxNodes) {
        const sgn = this.rand() < 0.5 ? -1 : 1;
        const ang = (0.35 + this.rand() * 0.65) * sgn;
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        const fx = hx * ca - hy * sa;
        const fy = hx * sa + hy * ca;
        const px = n.x + fx * spacing * 0.9;
        const py = n.y + fy * spacing * 0.9;
        const inside =
          px > margin &&
          py > margin &&
          px < this.width - margin &&
          py < this.height - margin;
        if (inside && !this.tipNear(px, py, spacing * 0.8, c, false)) {
          const fxp = Math.min(
            this.width - margin,
            Math.max(margin, n.x + fx * L),
          );
          const fyp = Math.min(
            this.height - margin,
            Math.max(margin, n.y + fy * L),
          );
          const f = this.spawn(
            ni,
            fxp,
            fyp,
            fx,
            fy,
            14,
            (this.rand() - 0.5) * 1.2,
          );
          children.push(f);
          created.push(f);
          this.killAround(fxp, fyp);
          this.bump(ni); // one extra lineage now runs through this node and all its ancestors
        }
      }
    }

    // 3) everyone who didn't move: idle bookkeeping, stall the starved
    const next: number[] = [];
    for (const i of this.activeList) {
      const n = nodes[i];
      if (!n.active) continue;
      if (n.cnt <= 0) {
        n.idle++;
        if (n.idle > p.idleLimit) {
          this.retire(i, true);
          continue;
        }
      } else {
        n.idle = 0;
      }
      next.push(i);
    }
    for (const c of children) next.push(c);
    this.activeList = next;
    return created;
  }

  /* 0..1 share of the food field already consumed; used for the stop point */
  get coverage() {
    return 1 - this.alive.length / this.totalPoints;
  }

  get done() {
    return this.activeList.length === 0 || this.nodes.length >= this.p.maxNodes;
  }

  /* 0..1 fill toward the node budget, for a progress readout */
  get progress() {
    return Math.min(1, this.nodes.length / this.p.maxNodes);
  }
}
