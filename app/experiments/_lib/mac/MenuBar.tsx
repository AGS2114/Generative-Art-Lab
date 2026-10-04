"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { EXPERIMENTS } from "../experiments";
import MacDialog, { AboutContent } from "./Dialog";
import { RippleMark } from "./icons";
import { applyWallpaperVars, loadWallpaperSettings } from "../Wallpaper";
import { BACKDROP } from "../chrome";

interface Item {
  label?: string;
  shortcut?: string;
  disabled?: boolean;
  checked?: boolean;
  separator?: boolean;
  onSelect?: () => void;
}

interface Menu {
  key: string;
  title: React.ReactNode;
  items: Item[];
}

export default function MenuBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [about, setAbout] = useState(false);
  const [crt, setCrt] = useState(false);
  const [time, setTime] = useState("");
  const barRef = useRef<HTMLDivElement>(null);

  const slug = pathname.startsWith("/experiments/")
    ? pathname.split("/")[2]
    : null;
  const current = EXPERIMENTS.find((e) => e.slug === slug);

  useEffect(() => {
    try {
      setCrt(localStorage.getItem("mac-crt") === "on");
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.dataset.crt = crt ? "on" : "off";
    try {
      localStorage.setItem("mac-crt", crt ? "on" : "off");
    } catch {}
  }, [crt]);

  useEffect(() => {
    applyWallpaperVars(loadWallpaperSettings());
  }, []);

  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        }),
      );
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!openKey) return;
    const down = (e: PointerEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setOpenKey(null);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpenKey(null);
    document.addEventListener("pointerdown", down);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      window.removeEventListener("keydown", key);
    };
  }, [openKey]);

  function goFullscreen() {
    const el = document.querySelector<HTMLElement>(".mac-stage main");
    if (document.fullscreenElement) document.exitFullscreen();
    else el?.requestFullscreen();
  }

  const menus: Menu[] = [
    {
      key: "apple",
      title: <RippleMark />,
      items: [
        { label: "About Generative Art Lab…", onSelect: () => setAbout(true) },
        { separator: true },
        {
          label: "Experiments Index",
          onSelect: () => router.push("/experiments"),
        },
        { label: "Welcome Screen", onSelect: () => router.push("/") },
      ],
    },
    {
      key: "file",
      title: "File",
      items: [
        {
          label: "Close Experiment",
          shortcut: "esc",
          disabled: !current,
          onSelect: () => router.push("/experiments"),
        },
        { separator: true },
        { label: "Restart", onSelect: () => window.location.reload() },
      ],
    },
    {
      key: "experiments",
      title: "Experiments",
      items: EXPERIMENTS.map((e) => ({
        label: e.name,
        checked: e.slug === slug,
        disabled: e.status === "todo",
        onSelect: () => router.push(`/experiments/${e.slug}`),
      })),
    },
    {
      key: "view",
      title: "View",
      items: [
        {
          label: "Hide UI",
          shortcut: "H",
          disabled: !current?.hideUi,
          onSelect: () =>
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "h" })),
        },
        {
          label: "Full Screen",
          shortcut: "F",
          disabled: !current,
          onSelect: goFullscreen,
        },
      ],
    },
    {
      key: "special",
      title: "Special",
      items: [
        {
          label: "CRT Scanlines",
          checked: crt,
          onSelect: () => setCrt((v) => !v),
        },
      ],
    },
  ];

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        !openKey &&
        !about &&
        !document.fullscreenElement
      )
        router.push("/experiments");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, openKey, about, router]);

  return (
    <>
      <div
        className="mac-menubar"
        ref={barRef}
        style={{ background: BACKDROP }}
      >
        {menus.map((m) => (
          <div className="mac-menu" key={m.key}>
            <button
              className={`mac-menu-title${openKey === m.key ? " open" : ""}`}
              onClick={() => setOpenKey(openKey === m.key ? null : m.key)}
              onMouseEnter={() => openKey && setOpenKey(m.key)}
            >
              {m.title}
            </button>
            {openKey === m.key && (
              <div className="mac-dropdown">
                {m.items.map((it, i) =>
                  it.separator ? (
                    <div className="mac-sep" key={i} />
                  ) : (
                    <button
                      key={i}
                      className="mac-item"
                      disabled={it.disabled}
                      onClick={() => {
                        setOpenKey(null);
                        it.onSelect?.();
                      }}
                    >
                      {it.checked && <span className="tick">✓</span>}
                      <span>{it.label}</span>
                      {it.shortcut && (
                        <span className="kbd">{it.shortcut}</span>
                      )}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        ))}
        <div className="mac-clock">{time}</div>
      </div>
      <MacDialog open={about} onClose={() => setAbout(false)}>
        <AboutContent />
      </MacDialog>
    </>
  );
}
