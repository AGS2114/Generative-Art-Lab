import { mulberry32 } from "../_lib/noise";

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
}

export interface AttractionPoint {
  x: number;
  y: number;
  alive: boolean;
}

export interface EngineParams {
  attractionCount: number;
  maxInfluenceDist: number;
  killDist: number;
  stepLength: number;
  seedMode: "corners" | "center" | "bottom";
  inertia: number;
  wander: number;
  maxNodes: number;
  maxPerTick: number;
}

/** Space-colonization growth - Pure simulation, no drawing. Positions are in CSS-agnostic canvas px. */
export class MyceliumEngine {
  nodes: MyceliumNode[] = [];
  points: AttractionPoint[] = [];
  step = 0;
  width: number;
  height: number;
  p: EngineParams;
  private rand: () => number;
  private grid = new Map<number, number[]>();
  private gridCell = 40;
  private activeList: number[] = [];

  constructor(width: number, height: number, p: EngineParams, seed: number) {
    this.width = width;
    this.height = height;
    this.p = p;
    this.rand = mulberry32(seed);
    this.reset();
  }

  reset() {
    this.nodes = [];
    this.points = [];
    this.activeList = [];
    this.step = 0;
    const { width: w, height: h, p } = this;

    for (let i = 0; i < p.attractionCount; i++) {
      this.points.push({
        x: this.rand() * w,
        y: this.rand() * h,
        alive: true,
      });
    }

    const seeds: [number, number][] =
      p.seedMode === "corners"
        ? [
            [0, 0],
            [w, 0],
            [0, h],
            [w, h],
          ]
        : p.seedMode === "bottom"
          ? [
              [w * 0.25, h],
              [w * 0.5, h],
              [w * 0.75, h],
            ]
          : [[w / 2, h / 2]];

    for (const [sx, sy] of seeds) {
      this.activeList.push(this.nodes.length);
      const ax = w / 2 - sx;
      const ay = h / 2 - sy;
      const m = Math.hypot(ax, ay) || 1;
      this.nodes.push({
        x: sx,
        y: sy,
        parent: -1,
        birth: 0,
        traffic: 0,
        idle: 0,
        dx: ax / m,
        dy: ay / m,
        active: true,
      });
    }
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.reset();
  }

  private key(cx: number, cy: number) {
    return cx * 100003 + cy;
  }

  private rebuildGrid() {
    this.grid.clear();
    const c = this.gridCell;
    for (const i of this.activeList) {
      const k = this.key(
        Math.floor(this.nodes[i].x / c),
        Math.floor(this.nodes[i].y / c),
      );
      const arr = this.grid.get(k);
      if (arr) arr.push(i);
      else this.grid.set(k, [i]);
    }
  }

  tick(): number[] {
    const { p } = this;
    if (this.nodes.length >= p.maxNodes) {
      this.step++;
      return [];
    }
    this.gridCell = Math.max(20, p.maxInfluenceDist);
    this.rebuildGrid();
    const c = this.gridCell;
    const R2 = p.maxInfluenceDist * p.maxInfluenceDist;
    const kill2 = p.killDist * p.killDist;

    const accX = new Map<number, number>();
    const accY = new Map<number, number>();
    const cnt = new Map<number, number>();

    let aliveCount = 0;
    for (const pt of this.points) {
      if (!pt.alive) continue;
      aliveCount++;
      const cx = Math.floor(pt.x / c);
      const cy = Math.floor(pt.y / c);
      let best = -1;
      let bestD = Infinity;
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          const arr = this.grid.get(this.key(gx, gy));
          if (!arr) continue;
          for (const ni of arr) {
            const n = this.nodes[ni];
            const dx = pt.x - n.x;
            const dy = pt.y - n.y;
            const d = dx * dx + dy * dy;
            if (d < kill2) {
              pt.alive = false;
              best = -1;
              break;
            }
            if (d < R2 && d < bestD) {
              bestD = d;
              best = ni;
            }
          }
          if (!pt.alive) break;
        }
        if (!pt.alive) break;
      }
      if (!pt.alive || best < 0) continue;
      const n = this.nodes[best];
      const dx = pt.x - n.x;
      const dy = pt.y - n.y;
      const m = Math.hypot(dx, dy) || 1;
      accX.set(best, (accX.get(best) ?? 0) + dx / m);
      accY.set(best, (accY.get(best) ?? 0) + dy / m);
      cnt.set(best, (cnt.get(best) ?? 0) + 1);
    }

    this.step++;
    const created: number[] = [];

    if (this.nodes.length >= p.maxNodes) return created;

    let entries = Array.from(cnt.entries());
    if (entries.length > p.maxPerTick) {
      const off = (this.step * 7919) % entries.length;
      entries = entries
        .slice(off)
        .concat(entries.slice(0, off))
        .slice(0, p.maxPerTick);
    }
    const hot = new Set<number>(entries.map(([ni]) => ni));

    for (const [ni, cn] of entries) {
      if (this.nodes.length >= p.maxNodes) break;
      const n = this.nodes[ni];
      n.idle = 0;
      let dx = accX.get(ni)! / cn;
      let dy = accY.get(ni)! / cn;
      dx =
        dx * (1 - p.inertia) +
        n.dx * p.inertia +
        (this.rand() - 0.5) * p.wander;
      dy =
        dy * (1 - p.inertia) +
        n.dy * p.inertia +
        (this.rand() - 0.5) * p.wander;
      const m = Math.hypot(dx, dy) || 1;
      dx /= m;
      dy /= m;
      const nx = n.x + dx * p.stepLength;
      const ny = n.y + dy * p.stepLength;
      if (nx < -20 || ny < -20 || nx > this.width + 20 || ny > this.height + 20)
        continue;

      const idx = this.nodes.length;
      this.nodes.push({
        x: nx,
        y: ny,
        parent: ni,
        birth: this.step,
        traffic: 0,
        idle: 0,
        dx,
        dy,
        active: true,
      });
      created.push(idx);

      let a = ni;
      let depth = 0;
      while (a >= 0 && depth < 40) {
        this.nodes[a].traffic++;
        a = this.nodes[a].parent;
        depth++;
      }
    }

    for (let i = this.activeList.length - 1; i >= 0; i--) {
      const ni = this.activeList[i];
      const n = this.nodes[ni];
      if (!hot.has(ni)) n.idle++;
      if (n.idle > 4 || n.traffic > 3) {
        n.active = false;
        this.activeList[i] = this.activeList[this.activeList.length - 1];
        this.activeList.pop();
      }
    }
    for (const ni of created) this.activeList.push(ni);

    if (this.step % 60 === 0)
      this.points = this.points.filter((pt) => pt.alive);

    return aliveCount === 0 ? [] : created;
  }

  get done() {
    return (
      this.nodes.length >= this.p.maxNodes ||
      !this.points.some((pt) => pt.alive)
    );
  }

  get progress() {
    return Math.min(1, this.nodes.length / this.p.maxNodes);
  }
}
