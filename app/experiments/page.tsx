"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MacWindow from "./_lib/mac/Window";
import MacDialog, { AboutContent } from "./_lib/mac/Dialog";
import { DiskIcon, ExperimentIcon, TrashIcon } from "./_lib/mac/icons";
import { EXPERIMENTS } from "./_lib/experiments";
import Wallpaper, {
  WallpaperSettings,
  PALETTES,
  DEFAULT_WALLPAPER,
  resolvePalette,
  loadWallpaperSettings,
  saveWallpaperSettings,
  applyWallpaperVars,
} from "./_lib/Wallpaper";

type AppId = "finder" | "terminal" | "notes" | "settings";

const ACCENTS: Record<string, string> = {
  violet: "#6f5df5",
  teal: "#14b8a6",
  amber: "#f59e0b",
  rose: "#f43f5e",
  lime: "#84cc16",
};

function applyAccent(hex: string) {
  const s = document.documentElement.style;
  s.setProperty("--accent", hex);
  s.setProperty("--accent-hover", `color-mix(in srgb, ${hex} 80%, white)`);
  s.setProperty("--accent-text", `color-mix(in srgb, ${hex} 55%, white)`);
  s.setProperty("--accent-soft", `color-mix(in srgb, ${hex} 20%, transparent)`);
}

/* ───── Dock icons (simple line glyphs) ───── */
const G = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;
const DOCK: { id: AppId; label: string; icon: ReactNode }[] = [
  {
    id: "finder",
    label: "Experiments",
    icon: (
      <path
        {...G}
        d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
      />
    ),
  },
  {
    id: "terminal",
    label: "Terminal",
    icon: (
      <>
        <rect {...G} x="3" y="4" width="18" height="16" rx="3" />
        <path {...G} d="M7 10l3 2-3 2M12 15h5" />
      </>
    ),
  },
  {
    id: "notes",
    label: "Notes",
    icon: (
      <>
        <path {...G} d="M6 3h9l4 4v14H6z" />
        <path {...G} d="M9 11h7M9 15h7" />
      </>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    icon: (
      <>
        <path {...G} d="M4 7h10M18 7h2M4 17h2M10 17h10" />
        <circle {...G} cx="16" cy="7" r="2" />
        <circle {...G} cx="8" cy="17" r="2" />
      </>
    ),
  },
];

/* ───── Terminal ───── */
function Terminal({ open: openExp }: { open: (slug: string) => void }) {
  const [lines, setLines] = useState<string[]>(['Art Lab shell. Type "help".']);
  const [val, setVal] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [lines]);

  function run(raw: string) {
    const [cmd, ...rest] = raw.trim().split(/\s+/);
    const arg = rest.join(" ").toLowerCase();
    const out: string[] = [`$ ${raw}`];
    const find = () =>
      EXPERIMENTS.find(
        (e) => e.slug.includes(arg) || e.name.toLowerCase().includes(arg),
      );
    if (!cmd) return setLines((l) => [...l, "$"]);
    if (cmd === "clear") return setLines([]);
    if (cmd === "help")
      out.push(
        "ls · open <name> · theme <violet|teal|amber|rose|lime> · date · neofetch · clear",
      );
    else if (cmd === "ls")
      EXPERIMENTS.forEach((e) =>
        out.push(`${e.status === "done" ? "●" : "○"} ${e.slug}`),
      );
    else if (cmd === "open") {
      const e = arg && find();
      if (!e) out.push("no such experiment (try ls)");
      else if (e.status === "todo") out.push(`${e.name} isn't built yet`);
      else {
        out.push(`opening ${e.name}…`);
        setTimeout(() => openExp(e.slug), 350);
      }
    } else if (cmd === "theme") {
      if (ACCENTS[arg]) {
        applyAccent(ACCENTS[arg]);
        localStorage.setItem("accent", ACCENTS[arg]);
        out.push(`accent → ${arg}`);
      } else out.push("themes: " + Object.keys(ACCENTS).join(", "));
    } else if (cmd === "date") out.push(new Date().toString());
    else if (cmd === "neofetch")
      out.push(
        "Generative Art Lab",
        `${EXPERIMENTS.filter((e) => e.status === "done").length} experiments ready`,
        "Canvas · WebGL2 · Web Audio",
      );
    else out.push(`${cmd}: command not found`);
    setLines((l) => [...l, ...out]);
  }

  return (
    <div
      className="mac-term"
      ref={box}
      onClick={() => document.getElementById("term-in")?.focus()}
    >
      {lines.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(val);
          setVal("");
        }}
      >
        <span>$ </span>
        <input
          id="term-in"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          autoFocus
        />
      </form>
    </div>
  );
}

/* ───── Preferences ───── */
interface UiPrefs {
  clock: boolean;
  icons: boolean;
}
const DEFAULT_UI: UiPrefs = { clock: true, icons: true };
const UI_KEY = "desktop-prefs";

function loadUi(): UiPrefs {
  try {
    const saved = JSON.parse(localStorage.getItem(UI_KEY) ?? "{}");
    return {
      clock: typeof saved.clock === "boolean" ? saved.clock : DEFAULT_UI.clock,
      icons: typeof saved.icons === "boolean" ? saved.icons : DEFAULT_UI.icons,
    };
  } catch {
    return DEFAULT_UI;
  }
}

/* ───── Settings ───── */
type NumKey =
  | "speed"
  | "intensity"
  | "size"
  | "softness"
  | "vignette"
  | "grain";
const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontSize: 13,
};
const monoStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: "var(--text-muted)",
};

function Settings({
  wp,
  setWp,
  ui,
  setUi,
}: {
  wp: WallpaperSettings;
  setWp: (w: WallpaperSettings) => void;
  ui: UiPrefs;
  setUi: (u: UiPrefs) => void;
}) {
  const [accent, setAccent] = useState(ACCENTS.violet);
  useEffect(() => {
    setAccent(localStorage.getItem("accent") ?? ACCENTS.violet);
  }, []);
  const cur = resolvePalette(wp);

  const pickAccent = (hex: string) => {
    setAccent(hex);
    applyAccent(hex);
    localStorage.setItem("accent", hex);
  };

  const editColour = (k: "base" | "a" | "b", hex: string) =>
    setWp({
      ...wp,
      palette: "custom",
      custom: {
        base: cur.base,
        a: cur.a,
        b: cur.b,
        aOp: cur.aOp,
        bOp: cur.bOp,
        [k]: hex,
      },
    });

  const reset = () => {
    pickAccent(ACCENTS.violet);
    localStorage.removeItem("accent");
    setWp(DEFAULT_WALLPAPER);
    setUi(DEFAULT_UI);
  };

  const times = (v: number) => `${v.toFixed(2)}×`;
  const percent = (v: number) => `${Math.round(v * 100)}%`;
  const slider = (
    label: string,
    k: NumKey,
    min: number,
    max: number,
    fmt: (v: number) => string = times,
  ) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ ...rowStyle, marginBottom: 4 }}>
        <span>{label}</span>
        <span style={monoStyle}>
          {k === "speed" && wp.speed === 0 ? "paused" : fmt(wp[k])}
        </span>
      </div>
      <input
        className="mac-range"
        type="range"
        min={min}
        max={max}
        step={0.01}
        value={wp[k]}
        style={
          {
            "--pct": `${((wp[k] - min) / (max - min)) * 100}%`,
          } as React.CSSProperties
        }
        onChange={(e) => setWp({ ...wp, [k]: Number(e.target.value) })}
      />
    </div>
  );
  const colour = (label: string, k: "base" | "a" | "b") => (
    <div style={{ ...rowStyle, marginBottom: 10 }}>
      <span>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          className="mac-swatch"
          type="color"
          value={cur[k]}
          onChange={(e) => editColour(k, e.target.value)}
        />
        <span style={{ ...monoStyle, minWidth: 60, textAlign: "right" }}>
          {cur[k]}
        </span>
      </div>
    </div>
  );
  const toggle = (
    label: string,
    checked: boolean,
    onChange: (v: boolean) => void,
  ) => (
    <label style={{ ...rowStyle, marginBottom: 10, cursor: "pointer" }}>
      <span>{label}</span>
      <input
        className="mac-check"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );

  return (
    <div style={{ padding: 16 }}>
      <div className="mac-section">Accent colour</div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 20,
        }}
      >
        {Object.entries(ACCENTS).map(([name, hex]) => (
          <button
            key={name}
            title={name}
            className={`mac-dot${accent === hex ? " on" : ""}`}
            style={{ background: hex }}
            onClick={() => pickAccent(hex)}
          />
        ))}
        <input
          className="mac-swatch"
          type="color"
          title="Custom accent"
          value={accent}
          onChange={(e) => pickAccent(e.target.value)}
        />
      </div>

      <div className="mac-section">Wallpaper palette</div>
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 6 }}
      >
        {PALETTES.map((p) => (
          <button
            key={p.id}
            title={p.label}
            aria-label={p.label}
            className={`mac-dot${wp.palette === p.id ? " on" : ""}`}
            style={{
              background: `linear-gradient(135deg, ${p.a} 50%, ${p.b} 50%)`,
            }}
            onClick={() => setWp({ ...wp, palette: p.id })}
          />
        ))}
      </div>
      <div
        style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 18 }}
      >
        {cur.label}
      </div>

      <div className="mac-section">Wallpaper colours</div>
      {colour("Base", "base")}
      {colour("Glow 1 (large)", "a")}
      {colour("Glow 2 (small)", "b")}
      <div
        style={{
          fontSize: 12,
          color: "var(--text-muted)",
          margin: "-2px 0 18px",
        }}
      >
        Editing a colour starts from the selected palette and saves as Custom.
      </div>

      <div className="mac-section">Wallpaper</div>
      {slider("Drift speed", "speed", 0, 3)}
      {slider("Glow intensity", "intensity", 0.2, 2)}
      {slider("Glow size", "size", 0.5, 1.6)}
      {slider("Softness", "softness", 0.4, 2)}
      {slider("Vignette", "vignette", 0, 0.9, percent)}
      {slider("Film grain", "grain", 0, 0.4, percent)}

      <div className="mac-section">Desktop</div>
      {toggle("Clock widget", ui.clock, (v) => setUi({ ...ui, clock: v }))}
      {toggle("Desktop icons", ui.icons, (v) => setUi({ ...ui, icons: v }))}

      <div
        style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}
      >
        <button className="mac-btn" onClick={reset}>
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

const NOTES = `Welcome to the Art Lab.

• The wallpaper is two slow-drifting colour glows (CSS, no canvas). Settings has eight palettes (default: Aegean blue & chalk white), custom colour pickers, and sliders for speed, intensity, size, softness, vignette and grain. Choices are saved in this browser.
• Open experiments from the Experiments app, the Terminal ("open glyph"), or the menu bar.
• Drag windows by their title bar; double-click a title bar to roll it up.
• Press H inside a sketch to hide its UI, F for full screen, Esc to come back here.
• Try the Terminal: theme amber, neofetch, ls.`;

export default function Desktop() {
  const router = useRouter();
  const [wins, setWins] = useState<Record<AppId, boolean>>({
    finder: true,
    terminal: false,
    notes: true,
    settings: false,
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [todoAlert, setTodoAlert] = useState<string | null>(null);
  const [trash, setTrash] = useState(false);
  const [about, setAbout] = useState(false);
  const [wp, setWp] = useState<WallpaperSettings>(DEFAULT_WALLPAPER);
  const [ui, setUi] = useState<UiPrefs>(DEFAULT_UI);
  const updateWp = (w: WallpaperSettings) => {
    setWp(w);
    saveWallpaperSettings(w);
    applyWallpaperVars(w);
  };
  const updateUi = (u: UiPrefs) => {
    setUi(u);
    try {
      localStorage.setItem(UI_KEY, JSON.stringify(u));
    } catch {}
  };
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const a = localStorage.getItem("accent");
    if (a) applyAccent(a);
    const w = loadWallpaperSettings();
    setWp(w);
    applyWallpaperVars(w);
    setUi(loadUi());
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);

  const toggle = (id: AppId) => setWins((w) => ({ ...w, [id]: !w[id] }));
  const close = (id: AppId) => () => setWins((w) => ({ ...w, [id]: false }));
  const ready = EXPERIMENTS.filter((e) => e.status === "done").length;
  const sel = EXPERIMENTS.find((e) => e.slug === selected);

  function open(slug: string) {
    const exp = EXPERIMENTS.find((e) => e.slug === slug);
    if (!exp) return;
    if (exp.status === "todo") setTodoAlert(exp.name);
    else router.push(`/experiments/${slug}`);
  }

  return (
    <main
      style={{ position: "relative", minHeight: "100%" }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) setSelected(null);
      }}
    >
      <Wallpaper {...wp} />

      {/* Clock widget */}
      {now && ui.clock && (
        <div className="mac-widget">
          <div className="time">
            {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </div>
          <div className="date">
            {now.toLocaleDateString([], {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </div>
          <div className="stat">
            {ready} experiments ready · {EXPERIMENTS.length - ready} in progress
          </div>
        </div>
      )}

      {/* Windows */}
      {wins.finder && (
        <MacWindow
          title="Experiments"
          onClose={close("finder")}
          style={{ top: 150, left: 40, width: "min(640px, calc(100% - 80px))" }}
          bodyStyle={{ maxHeight: "calc(100vh - 330px)" }}
        >
          <div className="mac-bar">
            <span>{EXPERIMENTS.length} items</span>
            <span>
              {ready} ready · {EXPERIMENTS.length - ready} to do
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))",
              gap: 6,
              padding: 16,
            }}
          >
            {EXPERIMENTS.map((exp) => (
              <button
                key={exp.slug}
                className={`mac-icon${exp.status === "todo" ? " todo" : ""}${selected === exp.slug ? " selected" : ""}`}
                onClick={() => setSelected(exp.slug)}
                onDoubleClick={() => open(exp.slug)}
                onKeyDown={(e) => e.key === "Enter" && open(exp.slug)}
              >
                <ExperimentIcon slug={exp.slug} />
                <span className="label">{exp.name}</span>
              </button>
            ))}
          </div>
          <div className="mac-bar foot">
            <span>
              {sel ? sel.blurb : "Double-click an experiment to open it."}
            </span>
            <button
              className="mac-btn default"
              disabled={!sel}
              onClick={() => sel && open(sel.slug)}
            >
              Open
            </button>
          </div>
        </MacWindow>
      )}
      {wins.notes && (
        <MacWindow
          title="Notes"
          onClose={close("notes")}
          style={{ top: 56, right: 150, width: 320 }}
        >
          <div className="mac-notes">{NOTES}</div>
        </MacWindow>
      )}
      {wins.terminal && (
        <MacWindow
          title="Terminal"
          onClose={close("terminal")}
          style={{ top: 200, left: 280, width: 460 }}
        >
          <Terminal open={open} />
        </MacWindow>
      )}
      {wins.settings && (
        <MacWindow
          title="Settings"
          onClose={close("settings")}
          style={{ top: 60, left: 360, width: 360 }}
          bodyStyle={{ maxHeight: "calc(100vh - 150px)", overflowY: "auto" }}
        >
          <Settings wp={wp} setWp={updateWp} ui={ui} setUi={updateUi} />
        </MacWindow>
      )}

      {ui.icons && (
        <>
          <div
            style={{
              position: "absolute",
              top: 12,
              right: 14,
              width: 96,
              display: "flex",
              justifyContent: "center",
              zIndex: 1,
            }}
          >
            <button
              className="mac-icon on-desk"
              onDoubleClick={() => setAbout(true)}
              title="Double-click for About"
            >
              <DiskIcon />
              <span className="label">Art Lab HD</span>
            </button>
          </div>
          <div
            style={{
              position: "absolute",
              bottom: 90,
              right: 14,
              width: 96,
              display: "flex",
              justifyContent: "center",
              zIndex: 1,
            }}
          >
            <button
              className="mac-icon on-desk"
              onDoubleClick={() => setTrash(true)}
              title="Double-click to look inside"
            >
              <TrashIcon />
              <span className="label">Trash</span>
            </button>
          </div>
        </>
      )}

      {/* Dock */}
      <nav className="mac-dock">
        {DOCK.map((d) => (
          <button
            key={d.id}
            className={`mac-dock-item${wins[d.id] ? " running" : ""}`}
            onClick={() => toggle(d.id)}
            aria-label={d.label}
          >
            <svg viewBox="0 0 24 24" width="26" height="26">
              {d.icon}
            </svg>
            <span className="tip">{d.label}</span>
          </button>
        ))}
      </nav>

      <MacDialog open={!!todoAlert} onClose={() => setTodoAlert(null)}>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          “{todoAlert}” hasn’t been built yet.
        </p>
      </MacDialog>
      <MacDialog open={trash} onClose={() => setTrash(false)}>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          1 item: Gray-Scott reaction-diffusion. Retired in favour of Glyph
          Field.
        </p>
      </MacDialog>
      <MacDialog open={about} onClose={() => setAbout(false)}>
        <AboutContent />
      </MacDialog>
    </main>
  );
}
